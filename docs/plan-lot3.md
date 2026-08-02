Compilé et exécuté sur `net8.0-windows` (0 avertissement) : les 4 vecteurs RFC 6238 passent, le câblage `SocketsHttpHandler`/pinning/rejeu compile tel qu'écrit ci-dessous.

> **Document HISTORIQUE.** Ecrit pour la v1 en C# (WPF/.NET + LibVLCSharp), supprimee du
> depot le 28.07.2026 (decision D3). Il analyse une base de code qui n'existe plus ; ses
> conclusions sur le comportement du controleur et sur la reconnexion ont ete reportees
> dans la v2. L'application actuelle est en Electron : voir `plan-avancement.html` pour
> l'etat reel, et `decision-pile-technique.md` pour le raisonnement.

---

# LOT 3 — Plan d'implémentation : authentification, session durable et découverte

Base de code lue : `src/ProtectViewer/` (Models/CameraInfo.cs, Services/{AppConfig,SecretStore,CameraCatalog,Log,Ui}.cs, ViewModels/MainViewModel.cs, App.xaml.cs, ProtectViewer.csproj → `net8.0-windows`, `UseWPF=true`, `System.Security.Cryptography.ProtectedData 10.0.10` **déjà référencé**).

**Principe directeur du lot** : tout ce que le contrôleur sait, on le lit ; rien n'est codé en dur — ni les résolutions, ni le port RTSP (`nvr.ports.rtsp` est dans le bootstrap), ni l'index de qualité.

---

## 1. Classes à créer

Nouveau dossier `src/ProtectViewer/Protect/` (client API), plus quelques ajouts dans `Services/` et `ViewModels/`.

### 1.1 Transport et session

| Classe | Fichier | Responsabilité |
|---|---|---|
| `SpkiPinning` (static) | `Protect/SpkiPinning.cs` | Calcul du pin SPKI SHA-256, callback de validation, mode TOFU au premier appairage |
| `JwtClaims` (readonly record struct) | `Protect/JwtClaims.cs` | Décodage base64url du payload JWT → `csrfToken`, `exp` |
| `ProtectSession` | `Protect/ProtectSession.cs` | État cookie + CSRF + expiration, thread-safe **sans verrou** (un champ `volatile` sur un record immuable) |
| `SessionStore` | `Protect/SessionStore.cs` | Persistance chiffrée de la session via le `SecretStore` existant |
| `UniFiSessionHandler` | `Protect/UniFiSessionHandler.cs` | `DelegatingHandler` : estampille `Cookie` + `X-CSRF-Token`, récolte `x-updated-csrf-token`/`x-csrf-token`/`Set-Cookie` |
| `ReauthenticationHandler` | `Protect/ReauthenticationHandler.cs` | `DelegatingHandler` : un seul rejeu sur 401, anti-tempête par compteur de génération |
| `IReauthenticator` | idem | `long Generation { get; }` / `Task<bool> RefreshAsync(long observed, CancellationToken)` |
| `ProtectAuthenticator` | `Protect/ProtectAuthenticator.cs` | Login, injection TOTP, classification des erreurs, backoff, incrément de génération |
| `ProtectHttpFactory` (static) | `Protect/ProtectHttpFactory.cs` | Câblage de la chaîne, construction du `HttpClient` |

Signatures publiques principales :

```csharp
public static class SpkiPinning
{
    public static string ComputePin(X509Certificate2 certificate);
    public static RemoteCertificateValidationCallback Callback(
        IReadOnlyCollection<string> pins, Action<string>? onFirstUse = null);
}

public readonly record struct JwtClaims(string? CsrfToken, DateTimeOffset? ExpiresAt)
{
    public static JwtClaims Parse(string jwt);
    public bool IsUsable(TimeSpan margin);          // exp PRESENT et > now + margin
}

public sealed class ProtectSession
{
    public string? CookieHeader { get; }            // "TOKEN=<jwt>" ou "UOS_TOKEN=<jwt>"
    public string? CsrfToken { get; }
    public DateTimeOffset ExpiresAt { get; }
    public bool IsUsable { get; }                   // cookie + csrf + exp > now + 60 s
    public void SetCookie(string name, string value);
    public void SetCsrf(string csrf);
    public void Clear();
    public static bool TryParseSessionCookie(string setCookie, out string name, out string value);
}

public sealed class ProtectAuthenticator : IReauthenticator
{
    public long Generation { get; }
    public Task<bool> RefreshAsync(long observedGeneration, CancellationToken ct);
    public Task LoginAsync(ProtectCredentials credentials, CancellationToken ct);   // chemin explicite (assistant)
    public event Action<ProtectSession>? SessionChanged;
}
```

### 1.2 TOTP et horloge

| Classe | Fichier | Responsabilité |
|---|---|---|
| `Totp` (static) | `Protect/Totp.cs` | RFC 6238, SHA-1 / 6 chiffres / pas 30 s |
| `Base32Secret` (static) | `Protect/Base32Secret.cs` | Normalisation + décodage tolérant du seed |
| `OtpAuthUri` (static) | `Protect/OtpAuthUri.cs` | Parsing de `otpauth://totp/...` (aucune bibliothèque ne le fait) |
| `ClockProbe` / `ClockCheck` | `Protect/ClockProbe.cs` | Mesure de dérive via l'en-tête HTTP `Date` |

```csharp
public static class Totp
{
    public static string Compute(ReadOnlySpan<byte> key, DateTimeOffset utc,
                                 int step = 30, int digits = 6);
    public static int RemainingSeconds(DateTimeOffset utc, int step = 30);
}

public static class Base32Secret
{
    public static bool TryNormalize(string? raw, out string normalized, out string? error);
    public static byte[] ToKey(string raw);          // FormatException avec message francais
}

public sealed record ClockCheck(TimeSpan Offset, TimeSpan Uncertainty, bool IsSuspect);
public static class ClockProbe
{
    public static Task<ClockCheck?> ProbeAsync(HttpClient http, CancellationToken ct);
}
```

### 1.3 API et découverte

| Classe | Fichier | Responsabilité |
|---|---|---|
| `ProtectApiClient` | `Protect/ProtectApiClient.cs` | Façade des appels privés. Aujourd'hui : `GetBootstrapAsync`, `PingAsync` |
| DTO bootstrap | `Protect/Dto/BootstrapDto.cs` | `BootstrapDto`, `NvrDto`, `PortsDto`, `CameraDto`, `ChannelDto` — **uniquement les champs utilisés** |
| `CameraMapper` (static) | `Protect/CameraMapper.cs` | DTO → `CameraInfo`/`ChannelInfo` existants |
| `DiscoveryService` | `Services/DiscoveryService.cs` | Orchestration bootstrap → catalogue → config ; rafraîchissement périodique |
| `ConnectionTester` | `Services/ConnectionTester.cs` | Test de connexion à étapes typées, partagé assistant ↔ réglages |
| `ProtectCredentials` (record) | `Protect/ProtectCredentials.cs` | `Host, Username, Password, TotpSeed, RememberSession` |

```csharp
public sealed class ProtectApiClient(HttpClient http)
{
    public Task<BootstrapDto> GetBootstrapAsync(CancellationToken ct);
    public Task<bool> PingAsync(CancellationToken ct);           // GET /api/users/self, sonde SANS login
}

public sealed class DiscoveryService(ProtectApiClient api, CameraCatalog catalog, AppConfig config)
{
    public Task<DiscoveryResult> RefreshAsync(CancellationToken ct);
    public event Action<IReadOnlyList<CameraInfo>>? CamerasChanged;
}
public sealed record DiscoveryResult(IReadOnlyList<CameraInfo> Cameras,
                                     int RtspPort, string NvrName, string ProtectVersion,
                                     IReadOnlyList<string> Warnings);
```

### 1.4 Erreurs typées (règle CLAUDE.md : jamais de 500 opaque)

`Protect/ProtectExceptions.cs` :

```csharp
public abstract class ProtectException(string message, Exception? inner = null)
    : Exception(message, inner)
{
    /// <summary>Phrase affichable telle quelle a l'utilisateur, en francais.</summary>
    public abstract string UserMessage { get; }
    /// <summary>Action concrete proposee, ou null.</summary>
    public virtual string? Remedy => null;
}

public sealed class ProtectNetworkException     : ProtectException;   // DNS, TCP, timeout
public sealed class ProtectPinMismatchException : ProtectException;   // pin SPKI different
public sealed class ProtectTlsException         : ProtectException;   // handshake, port en clair
public sealed class ProtectCredentialsException : ProtectException;   // 401 INVALID_PAYLOAD -> PERMANENT
public sealed class ProtectTotpException        : ProtectException;   // code refuse (seed ou horloge)
public sealed class ProtectRateLimitedException(TimeSpan retryAfter) : ProtectException;
public sealed class ProtectForbiddenException   : ProtectException;   // 403 : role insuffisant
public sealed class ProtectApiException         : ProtectException;   // 4xx/5xx inattendu, corps tronque
```

### 1.5 Interface

| Classe | Fichier |
|---|---|
| `SetupWizardWindow` / `.xaml` | `Views/SetupWizardWindow.xaml` |
| `SetupWizardViewModel` | `ViewModels/SetupWizardViewModel.cs` |
| `ConnectionTestViewModel` | `ViewModels/ConnectionTestViewModel.cs` (réutilisé dans l'assistant **et** les réglages) |
| `SettingsWindow` / `SettingsViewModel` | `Views/SettingsWindow.xaml`, `ViewModels/SettingsViewModel.cs` |

### 1.6 Modifications de l'existant (additives)

- **`AppConfig`** : ajouter `Username` (identifiant, pas secret), `SpkiPins` (`List<string>`), `RtspPortFromBootstrap` (bool, défaut `true`), `AutoRefreshMinutes` (défaut 30), `StoreCredentials` (bool). Tout nullable/avec défaut → les fichiers `config.json` existants se désérialisent sans migration.
- **`ChannelInfo`** : ajouter `int ChannelId { get; init; }` (l'index brut du contrôleur : `Quality` est une lecture, `ChannelId` est ce qu'on renverra à `/video/export` au lot 5) et `int Fps { get; init; }`. Propriétés `init` avec défaut → compatible avec le catalogue chiffré déjà persisté.
- **`CameraInfo`** : ajouter `string? Model { get; init; }`, `bool IsOnline { get; init; }`.
- **`Log`** : ajouter la rédaction du JWT et du seed en plus de l'alias (§8).
- **`App.OnStartup`** : bascule assistant / fenêtre principale.

---

## 2. Le pipeline HTTP

### 2.1 Ordre des handlers

```
HttpClient (BaseAddress https://{host}/, Timeout 30 s)
  └─ ReauthenticationHandler        <- voit le 401, rejoue UNE fois
       └─ UniFiSessionHandler       <- estampille Cookie + CSRF, recolte les rotations
            └─ SocketsHttpHandler   <- UseCookies=false, pinning SPKI, pool 1 min

HttpMessageInvoker (login)          <- branche SOUS le ReauthenticationHandler
  └─ UniFiSessionHandler (MEME instance)
       └─ SocketsHttpHandler (MEME instance)
```

La requête de login traverse le `UniFiSessionHandler` (elle a besoin du CSRF et doit déposer le cookie) mais **jamais** le `ReauthenticationHandler` — sinon un 401 de login déclenche un login qui déclenche un login.

### 2.2 Câblage — `ProtectHttpFactory.cs`

```csharp
using System.Net;
using System.Net.Http;
using System.Net.Security;
using System.Security.Authentication;

namespace ProtectViewer.Protect;

public sealed record ProtectStack(
    HttpClient Http, ProtectApiClient Api, ProtectAuthenticator Auth, ProtectSession Session)
    : IDisposable
{
    public void Dispose() => Http.Dispose();
}

public static class ProtectHttpFactory
{
    public static ProtectStack Create(
        AppConfig config, SessionStore store, ProtectCredentials credentials,
        Action<string>? onPinDiscovered = null)
    {
        var session = store.Load() ?? new ProtectSession();

        var primary = new SocketsHttpHandler
        {
            UseCookies = false,                 // on gere le cookie a la main : voir §8
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(1),   // l'UDM reboote : pas de socket mort
            PooledConnectionIdleTimeout = TimeSpan.FromSeconds(30),
            MaxConnectionsPerServer = 8,
            ConnectTimeout = TimeSpan.FromSeconds(5),
            SslOptions = new SslClientAuthenticationOptions
            {
                TargetHost = config.ConsoleHost,
                EnabledSslProtocols = SslProtocols.Tls12 | SslProtocols.Tls13,
                RemoteCertificateValidationCallback =
                    SpkiPinning.Callback(config.SpkiPins, onPinDiscovered)
            }
        };

        var sessionHandler = new UniFiSessionHandler(session, store.Save) { InnerHandler = primary };

        // Invoker de login : SOUS le handler de reauth, donc pas de recursion possible.
        var loginInvoker = new HttpMessageInvoker(sessionHandler, disposeHandler: false);
        var auth = new ProtectAuthenticator(
            loginInvoker, new Uri($"https://{config.ConsoleHost}/"), credentials, session, store.Save);

        var reauth = new ReauthenticationHandler(auth) { InnerHandler = sessionHandler };

        var http = new HttpClient(reauth)
        {
            BaseAddress = new Uri($"https://{config.ConsoleHost}/"),
            Timeout = TimeSpan.FromSeconds(30)   // couvre 401 + relogin + rejeu (voir §8)
        };
        http.DefaultRequestHeaders.UserAgent.ParseAdd("ProtectViewer/1.1");
        http.DefaultRequestHeaders.Accept.ParseAdd("application/json");

        return new ProtectStack(http, new ProtectApiClient(http), auth, session);
    }
}
```

### 2.3 Pinning SPKI — `SpkiPinning.cs`

Pin sur la **clé publique**, pas sur le `Thumbprint` : sur UDM le certificat `unifi-core` est régénéré au redémarrage du service et aux mises à jour de firmware. Un pin par empreinte de certificat transforme chaque MAJ en panne ; le pin SPKI survit tant que la clé ne change pas (RFC 7469 §2.4).

```csharp
public static class SpkiPinning
{
    public static string ComputePin(X509Certificate2 certificate) =>
        Convert.ToBase64String(SHA256.HashData(certificate.PublicKey.ExportSubjectPublicKeyInfo()));

    public static RemoteCertificateValidationCallback Callback(
        IReadOnlyCollection<string> pins, Action<string>? onFirstUse = null)
    {
        var expected = pins.Select(Convert.FromBase64String).ToArray();   // decode une seule fois

        return (_, certificate, _, sslErrors) =>
        {
            _ = sslErrors;   // IGNORE volontairement : auto-signe => ChainErrors + NameMismatch attendus.
                             // La confiance vient EXCLUSIVEMENT du pin.
            if (certificate is null) return false;

            // Ne PAS disposer : le certificat appartient a SslStream.
            var leaf = certificate as X509Certificate2 ?? new X509Certificate2(certificate.GetRawCertData());
            var actual = SHA256.HashData(leaf.PublicKey.ExportSubjectPublicKeyInfo());

            if (expected.Length == 0) { onFirstUse?.Invoke(Convert.ToBase64String(actual)); return true; } // TOFU

            foreach (var pin in expected)
                if (CryptographicOperations.FixedTimeEquals(pin, actual)) return true;
            return false;
        };
    }
}
```

TOFU au premier appairage : l'assistant affiche le pin, l'utilisateur confirme, on l'écrit dans `AppConfig.SpkiPins`. `SpkiPins` est une **liste** pour couvrir une rotation planifiée (ancien + nouveau). Si le pin change plus tard → `ProtectPinMismatchException`, écran d'alerte ferme, jamais d'acceptation silencieuse.

### 2.4 CSRF tournant — `UniFiSessionHandler.cs`

Le corps du login renvoie `"csrf_token": ""` — toujours vide. Le vrai jeton est dans l'en-tête `x-updated-csrf-token` (priorité) ou `x-csrf-token` (repli), ou dans le claim `csrfToken` du JWT. On récolte sur **toutes** les réponses.

```csharp
public sealed class UniFiSessionHandler(ProtectSession session, Action<ProtectSession>? onChanged = null)
    : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        Stamp(request);
        var response = await base.SendAsync(request, ct).ConfigureAwait(false);
        Harvest(response);
        return response;
    }

    private void Stamp(HttpRequestMessage request)
    {
        // PIEGE CRITIQUE : sur un REJEU les en-tetes de la 1re tentative sont encore sur l'instance ;
        // TryAddWithoutValidation les CONCATENERAIT ("csrf-v0, csrf-v1") -> 401 CSRF_TOKEN_IS_INVALID en boucle.
        request.Headers.Remove("Cookie");
        request.Headers.Remove("X-CSRF-Token");

        if (session.CookieHeader is { } c) request.Headers.TryAddWithoutValidation("Cookie", c);
        if (session.CsrfToken  is { } x) request.Headers.TryAddWithoutValidation("X-CSRF-Token", x);
    }

    private void Harvest(HttpResponseMessage response)
    {
        var changed = false;

        if (TryGetHeader(response, "x-updated-csrf-token", out var csrf) ||
            TryGetHeader(response, "x-csrf-token", out csrf))
        {
            var before = session.CsrfToken;
            session.SetCsrf(csrf!);
            changed |= !string.Equals(before, csrf, StringComparison.Ordinal);
        }

        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
            foreach (var raw in setCookies)
                if (ProtectSession.TryParseSessionCookie(raw, out var n, out var v))
                { session.SetCookie(n, v); changed = true; break; }

        if (changed) onChanged?.Invoke(session);   // -> persiste sur disque
    }

    private static bool TryGetHeader(HttpResponseMessage r, string name, out string? value)
    {
        value = null;
        if (!r.Headers.TryGetValues(name, out var vals)) return false;
        value = vals.FirstOrDefault();
        return !string.IsNullOrEmpty(value);
    }
}
```

`ProtectSession` : un seul champ `volatile` pointant sur un record immuable, donc **aucun état intermédiaire observable** (cookie neuf + CSRF périmé) et pas de verrou :

```csharp
public sealed class ProtectSession
{
    private volatile State _state = State.Empty;
    private sealed record State(string? Name, string? Value, string? Csrf, DateTimeOffset ExpiresAt)
    { public static readonly State Empty = new(null, null, null, DateTimeOffset.MinValue); }

    public string? CsrfToken => _state.Csrf;
    public string? CookieHeader { get { var s = _state; return s.Name is null ? null : $"{s.Name}={s.Value}"; } }
    public DateTimeOffset ExpiresAt => _state.ExpiresAt;

    public bool IsUsable { get { var s = _state;
        return s.Value is not null && s.Csrf is not null
            && s.ExpiresAt > DateTimeOffset.UtcNow.AddSeconds(60); } }   // marge de 60 s

    public void SetCookie(string name, string value)
    {
        var c = JwtClaims.Parse(value);
        var prev = _state;
        // exp ABSENT => session refusee (DateTimeOffset.MinValue), pas acceptee : voir §8.
        _state = new State(name, value, c.CsrfToken ?? prev.Csrf, c.ExpiresAt ?? DateTimeOffset.MinValue);
    }

    public void SetCsrf(string csrf)
    {
        var prev = _state;
        if (string.Equals(prev.Csrf, csrf, StringComparison.Ordinal)) return;  // no-op = pas d'ecriture disque
        _state = prev with { Csrf = csrf };
    }

    public void Clear() => _state = State.Empty;

    public static bool TryParseSessionCookie(string setCookie, out string name, out string value)
    {
        name = string.Empty; value = string.Empty;
        var semi = setCookie.IndexOf(';');
        var pair = semi < 0 ? setCookie : setCookie[..semi];
        var eq = pair.IndexOf('=');
        if (eq <= 0) return false;
        var n = pair[..eq].Trim();
        // Le cookie s'appelle TOKEN **ou** UOS_TOKEN selon la version de UniFi OS.
        if (n is not ("TOKEN" or "UOS_TOKEN")) return false;
        name = n; value = pair[(eq + 1)..].Trim();
        return value.Length > 0;
    }
}
```

### 2.5 Re-auth sur 401 sans tempête — `ReauthenticationHandler.cs`

Fait .NET vérifié : le contrôle « already sent » est dans `HttpClient.CheckRequestBeforeSend`, **pas** dans `DelegatingHandler`. Rejouer la même instance via `base.SendAsync` fonctionne — pas besoin de cloner la requête.

```csharp
public sealed class ReauthenticationHandler(IReauthenticator auth) : DelegatingHandler
{
    public static readonly HttpRequestOptionsKey<bool> NoReauth = new("unifi.no-reauth");

    protected override async Task<HttpResponseMessage> SendAsync(
        HttpRequestMessage request, CancellationToken ct)
    {
        if (request.Options.TryGetValue(NoReauth, out var skip) && skip)
            return await base.SendAsync(request, ct).ConfigureAwait(false);

        if (request.Content is not null)
            await request.Content.LoadIntoBufferAsync().ConfigureAwait(false);
            // net8 : PAS de surcharge (CancellationToken) -> CS1503. Ajoutee en net9.

        var generation = auth.Generation;                    // photo AVANT l'envoi

        var response = await base.SendAsync(request, ct).ConfigureAwait(false);
        if (response.StatusCode != HttpStatusCode.Unauthorized) return response;

        if (!await auth.RefreshAsync(generation, ct).ConfigureAwait(false))
            return response;                                 // mdp faux / rate limit : on rend le 401 tel quel

        response.Dispose();                                  // liberer la connexion avant le rejeu
        return await base.SendAsync(request, ct).ConfigureAwait(false);   // UN seul rejeu, par construction
    }
}
```

Anti-tempête dans `ProtectAuthenticator` — le point clé est le **compteur de génération**, pas le sémaphore seul (sans lui, 20 requêtes en 401 simultanées feraient 20 logins en file indienne = 429 garanti) :

```csharp
private readonly SemaphoreSlim _gate = new(1, 1);
private long _generation;
private bool _credentialsRejected;
private DateTimeOffset _notBefore = DateTimeOffset.MinValue;
private int _consecutiveFailures;

public long Generation => Interlocked.Read(ref _generation);

public async Task<bool> RefreshAsync(long observedGeneration, CancellationToken ct)
{
    await _gate.WaitAsync(ct).ConfigureAwait(false);
    try
    {
        // Quelqu'un a deja relogue pendant qu'on attendait le semaphore : ne PAS relogger.
        if (Interlocked.Read(ref _generation) != observedGeneration) return true;
        if (_credentialsRejected) return false;
        if (DateTimeOffset.UtcNow < _notBefore) return false;   // fenetre de rate limit active
        await LoginCoreAsync(ct).ConfigureAwait(false);         // incremente _generation si succes
        return true;
    }
    catch (ProtectCredentialsException) { return false; }
    catch (ProtectRateLimitedException) { return false; }
    finally { _gate.Release(); }
}
```

### 2.6 Le login — `ProtectAuthenticator.LoginCoreAsync`

Vérifié sur l'installation : `POST https://192.168.1.1/api/auth/login` avec `{username, password, rememberMe:true, token:<TOTP>}` → **200 en une seule étape**, cookie `TOKEN`, JWT `exp` = 30 jours.

```csharp
private async Task LoginCoreAsync(CancellationToken ct)
{
    // Bootstrap du CSRF : UniFi OS protege son propre /api/auth/login par CSRF.
    if (session.CsrfToken is null) await PrimeCsrfAsync(ct).ConfigureAwait(false);

    var totp = Totp.Compute(_credentials.TotpKeySpan, DateTimeOffset.UtcNow);  // JAMAIS mis en cache
    var body = new { username = _credentials.Username, password = _credentials.Password,
                     rememberMe = true, token = totp };
    //                ^^^^^^^^^^^^^^ rememberMe:false donne exp-iat = 7200 (2 h) -> relogins quotidiens

    using var req = new HttpRequestMessage(HttpMethod.Post, new Uri(_baseUri, "api/auth/login"))
    { Content = JsonContent.Create(body) };    // using System.Net.Http.Json; -> Content-Type: application/json
    req.Options.Set(ReauthenticationHandler.NoReauth, true);

    using var resp = await _loginInvoker.SendAsync(req, ct).ConfigureAwait(false);
    var outcome = await Classify(resp, ct).ConfigureAwait(false);

    switch (outcome.Kind)
    {
        case LoginKind.Success:
            if (!session.IsUsable)     // 200 mais pas de cookie exploitable => on ne declare pas la victoire
                throw new ProtectApiException("Le controleur a accepte la connexion sans fournir de session.");
            Interlocked.Increment(ref _generation);
            _consecutiveFailures = 0;
            _onChanged?.Invoke(session);
            return;

        case LoginKind.BadCredentials:
            _credentialsRejected = true;    // chaque echec rapproche du 429 : on s'arrete NET
            throw new ProtectCredentialsException(outcome.Code);

        case LoginKind.BadTotp:
            throw new ProtectTotpException(outcome.Code);   // n'arme PAS _credentialsRejected

        case LoginKind.RateLimited:
            var delay = outcome.RetryAfter ?? NextBackoff();
            _notBefore = DateTimeOffset.UtcNow + delay;
            throw new ProtectRateLimitedException(delay);

        default:
            throw new ProtectApiException(outcome.Code ?? $"HTTP {(int)resp.StatusCode}");
    }
}

private async Task PrimeCsrfAsync(CancellationToken ct)
{
    using var req = new HttpRequestMessage(HttpMethod.Get, _baseUri);   // la RACINE, pas /api/...
    req.Options.Set(ReauthenticationHandler.NoReauth, true);
    using var _ = await _loginInvoker.SendAsync(req, ct).ConfigureAwait(false);
    // le UniFiSessionHandler a deja recolte x-csrf-token
}

private static readonly TimeSpan[] Backoff =
[
    TimeSpan.FromSeconds(30), TimeSpan.FromMinutes(2), TimeSpan.FromMinutes(5),
    TimeSpan.FromMinutes(15), TimeSpan.FromMinutes(30)
];

private TimeSpan NextBackoff()
{
    var i = Math.Min(_consecutiveFailures++, Backoff.Length - 1);
    return TimeSpan.FromMilliseconds(Backoff[i].TotalMilliseconds * (0.5 + 0.5 * Random.Shared.NextDouble()));
}
```

Table de classification (`Classify`) :

| Statut | Corps | Sens | `LoginKind` |
|---|---|---|---|
| 200 | cookie posé | succès | `Success` |
| 401 | `{"code":"INVALID_PAYLOAD"}` | identifiants faux | `BadCredentials` (**permanent**) |
| 401 | `{"code":"TOKEN_EXPIRED"}` | JWT expiré | `Retryable` |
| 401 | `{"code":"CSRF_TOKEN_IS_INVALID"}` | CSRF périmé | `CsrfStale` → repriming, **pas** de relogin |
| 429 | `{"code":"AUTHENTICATION_FAILED_LIMIT_REACHED"}` | verrouillage | `RateLimited` |
| 200 | `meta.msg="api.err.Ubic2faTokenRequired"` | 2FA locale | `BadTotp` **[NON VERIFIE sur cette installation]** |
| 499 | `data.mfaCookie` | 2FA SSO en deux temps | `BadTotp` **[NON VERIFIE ici — le login est en une étape]** |
| autre 4xx/5xx, corps non-JSON | console qui démarre | transitoire | `Retryable` |

> **[NON VERIFIE]** — le corps exact renvoyé quand le **code TOTP** est faux (par opposition au mot de passe) n'a pas été observé. Tant qu'il ne l'est pas, `Classify` doit traiter un 401 dont le `code` n'est pas `INVALID_PAYLOAD` comme `BadTotp`, jamais comme `BadCredentials` — se tromper dans ce sens coûte une tentative, l'inverse arme définitivement `_credentialsRejected`.

Côté requêtes de **données** (pas login) : réessayer 400, 404, 429, 500, 502, 503, 504 (400 et 404 sont renvoyés transitoirement pendant un reboot de la console), 5 essais, backoff 100 ms → 1500 ms, plus un disjoncteur : 10 échecs consécutifs → 300 s de refus local.

---

## 3. TOTP et détection d'horloge désynchronisée

### 3.1 Génération — `Totp.cs`

Pas de dépendance NuGet : la génération SHA-1/6 chiffres tient en 15 lignes, et le seul intérêt d'Otp.NET (vérification côté serveur, fenêtre de tolérance, anti-rejeu) ne nous concerne pas — nous sommes le client.

```csharp
public static class Totp
{
    public static string Compute(ReadOnlySpan<byte> key, DateTimeOffset utc, int step = 30, int digits = 6)
    {
        if (step <= 0)              throw new ArgumentOutOfRangeException(nameof(step));
        if (digits is < 6 or > 9)   throw new ArgumentOutOfRangeException(nameof(digits));

        var counter = utc.ToUnixTimeSeconds() / step;
        Span<byte> msg = stackalloc byte[8];
        BinaryPrimitives.WriteInt64BigEndian(msg, counter);

        Span<byte> hash = stackalloc byte[20];
        HMACSHA1.HashData(key, msg, hash);          // static one-shot, net6+

        var o = hash[19] & 0x0F;
        var bin = ((hash[o] & 0x7F) << 24) | (hash[o + 1] << 16) | (hash[o + 2] << 8) | hash[o + 3];

        var mod = 1; for (var i = 0; i < digits; i++) mod *= 10;   // PAS (int)Math.Pow : sature a digits>=10
        return (bin % mod).ToString(CultureInfo.InvariantCulture).PadLeft(digits, '0');
    }

    public static int RemainingSeconds(DateTimeOffset utc, int step = 30) =>
        step - (int)(utc.ToUnixTimeSeconds() % step);
}
```

**Vérifié à l'exécution sur `net8.0-windows`** : les 4 vecteurs RFC 6238 (SHA-1, 8 chiffres) donnent `94287082`, `07081804`, `89005924`, `69279037`. Compilation 0 avertissement.

Toujours `DateTimeOffset.UtcNow`, jamais `Now` : le calcul part d'un epoch, une heure locale produit **silencieusement** un code faux.

### 3.2 Normalisation du seed — `Base32Secret.cs`

Les seeds affichés par les services sont groupés par 4 (`JBSW Y3DP EHPK 3PXP`). Un décodeur base32 strict jette une exception sur l'espace : on normalise en silence, on ne reproche rien à l'utilisateur.

```csharp
private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

public static bool TryNormalize(string? raw, out string normalized, out string? error)
{
    normalized = string.Empty; error = null;
    if (string.IsNullOrWhiteSpace(raw)) { error = "La cle est vide."; return false; }

    var sb = new StringBuilder(raw.Length);
    foreach (var ch in raw)
    {
        if (char.IsWhiteSpace(ch) || ch is '-' or '_' or '=') continue;
        var up = char.ToUpperInvariant(ch);
        if (!Alphabet.Contains(up))
        { error = $"Caractere invalide dans la cle : « {ch} » (attendu A-Z ou 2-7)."; return false; }
        sb.Append(up);
    }
    if (sb.Length == 0) { error = "La cle ne contient aucun caractere base32."; return false; }

    // 8 caracteres base32 = 5 octets. Les restes 1, 3 et 6 sont mathematiquement impossibles.
    if (sb.Length % 8 is 1 or 3 or 6)
    { error = $"Cle tronquee : {sb.Length} caracteres, longueur impossible en base32."; return false; }

    normalized = sb.ToString(); return true;
}
```

Le champ de saisie accepte aussi une URI `otpauth://totp/...` complète (`OtpAuthUri.Parse` extrait `secret`, `issuer`, `algorithm`, `digits`, `period`). Refus explicite de `digits=5 & encoder=steam` (Steam Guard n'est pas du TOTP standard) et de tout `algorithm` autre que SHA-1/256/512, avec message clair plutôt qu'un code faux généré en silence.

### 3.3 Dérive d'horloge — `ClockProbe.cs`

Un code TOTP refusé alors que la clé est bonne, c'est presque toujours l'horloge. À diagnostiquer **préventivement**, pas en interprétant a posteriori un échec (le serveur renvoie une erreur générique).

```csharp
public static async Task<ClockCheck?> ProbeAsync(HttpClient http, CancellationToken ct)
{
    using var req = new HttpRequestMessage(HttpMethod.Head, "/");
    req.Headers.CacheControl = new CacheControlHeaderValue { NoCache = true, NoStore = true };
    req.Options.Set(ReauthenticationHandler.NoReauth, true);

    var t0 = DateTimeOffset.UtcNow;
    using var resp = await http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct)
                               .ConfigureAwait(false);
    var t1 = DateTimeOffset.UtcNow;

    if (resp.Headers.Date is not { } date) return null;                       // en-tete absent
    if (resp.Headers.Age is { } age && age > TimeSpan.Zero) return null;      // reponse de cache

    var rtt = t1 - t0;
    var localMid = t0 + TimeSpan.FromTicks(rtt.Ticks / 2);
    var offset = date - localMid;                                             // > 0 => le PC retarde
    var uncertainty = TimeSpan.FromTicks(rtt.Ticks / 2) + TimeSpan.FromSeconds(1);
    return new ClockCheck(offset, uncertainty, Math.Abs(offset.TotalSeconds) > uncertainty.TotalSeconds + 10);
}
```

Seuils (pas de 30 s) : `|offset| < 5 s` → rien ; 5–25 s → bandeau d'avertissement ; > 25 s → bandeau bloquant, le code **sera** refusé.

**Ne jamais compenser silencieusement** le décalage dans le calcul TOTP : ça masque un vrai problème système (service W32Time arrêté, pile CMOS morte, VM suspendue). On corrige **et** on affiche, avec un bouton qui ouvre `ms-settings:dateandtime` (`Process.Start(new ProcessStartInfo("ms-settings:dateandtime") { UseShellExecute = true })`).

> **[NON VERIFIE]** : l'UDM Pro renvoie-t-elle bien un en-tête `Date` sur `HEAD /` ? Si `ProbeAsync` retourne systématiquement `null`, prévoir le repli sur `GET /` (le `Date` d'une réponse complète) avant d'envisager SNTP.

---

## 4. Stockage des secrets

### 4.1 Ce qu'on chiffre (DPAPI `CurrentUser`, via le `SecretStore` existant)

| Nom du secret | Contenu | Pourquoi |
|---|---|---|
| `credentials` | `{ "username", "password" }` JSON | Nécessaire pour le re-login à J+30 et sur 401 |
| `totp` | seed base32 normalisé | L'appli génère les codes elle-même |
| `session` | `{ "cookieName", "cookieValue", "csrf" }` JSON | Évite un login à chaque démarrage → évite le 429 |
| `cameras` | inventaire JSON | **existe déjà** : les alias RTSP sont des mots de passe |

`SecretStore` est déjà correct (DPAPI `CurrentUser` + entropie applicative, `Read` retourne `null` sur `CryptographicException`). Deux ajouts :

1. **Écriture atomique** — un fichier tronqué par un crash = un relogin de plus vers le 429 :
```csharp
public void Write(string name, string value)
{
    var cipher = ProtectedData.Protect(Encoding.UTF8.GetBytes(value), Entropy, DataProtectionScope.CurrentUser);
    var final = PathFor(name);
    var tmp = final + ".tmp";                 // MEME dossier : File.Move n'est quasi-atomique que sur le meme volume
    File.WriteAllBytes(tmp, cipher);
    File.Move(tmp, final, overwrite: true);   // peut lever IOException si une autre instance verrouille
}
```
2. **`WriteBytes`/`ReadBytes`** pour ne pas faire transiter le seed par une `string` immuable non effaçable.

### 4.2 Ce qu'on **ne** stocke **pas**

- **`exp` du JWT dans le fichier** : redondant et falsifiable. On reparse le JWT au chargement (`JwtClaims.Parse`) et on applique la marge de 60 s.
- **Le CSRF comme source de vérité au repos** : il est persisté comme *dernière valeur tournée connue* (plus fraîche que le claim du JWT initial), mais ne fait jamais autorité — chaque réponse peut le remplacer, indépendamment du cookie.
- **Un code TOTP** : jamais persisté, jamais mis en cache, jamais journalisé. Recalculé au moment exact du rejeu.
- **Le pin SPKI dans le magasin chiffré** : ce n'est pas un secret, c'est un ancrage de confiance. Il va dans `config.json` (lisible et vérifiable par l'utilisateur, c'est même souhaitable).
- **Une clé API Integrations** : vérifiée inutile ici (rejetée par l'API privée : bootstrap 500, events 401).

### 4.3 Chargement de la session

Ne jamais faire confiance au fichier :

```csharp
public ProtectSession? Load()
{
    var raw = secrets.Read("session");
    if (raw is null) return null;
    var dto = JsonSerializer.Deserialize<SessionDto>(raw);
    if (dto?.CookieValue is null) return null;

    var claims = JwtClaims.Parse(dto.CookieValue);
    if (!claims.IsUsable(TimeSpan.FromSeconds(60))) return null;   // exp ABSENT => refus (voir §8)

    var s = new ProtectSession();
    s.SetCookie(dto.CookieName ?? "TOKEN", dto.CookieValue);
    if (dto.Csrf is { Length: > 0 }) s.SetCsrf(dto.Csrf);
    return s;
}
```

### 4.4 Limites à exposer honnêtement (§6.3)

- Un blob DPAPI `CurrentUser` **n'est pas portable** : autre PC, autre utilisateur, ou compte recréé avec le même nom (SID différent) → illisible. Ne jamais proposer « sauvegarder / restaurer le fichier de secrets ».
- Une **réinitialisation du mot de passe Windows par un administrateur** (ou `net user`) sur un poste hors domaine détruit les clés maîtresses : tous les blobs deviennent illisibles, sans récupération. Un changement fait *par* l'utilisateur est transparent. → chemin de re-saisie obligatoire, message clair au lieu d'une exception.
- L'entropie applicative n'est **pas** un secret (elle est en clair dans le binaire) : c'est de l'obfuscation, elle empêche une autre appli de déchiffrer par négligence, elle n'arrête pas un infostealer.
- `SecureString` n'apporte rien en .NET moderne et est déconseillé par Microsoft : `byte[]` + `CryptographicOperations.ZeroMemory`.

---

## 5. La découverte

### 5.1 Appel

`GET /proxy/protect/api/bootstrap` (`ProtectApiClient.GetBootstrapAsync`). Réponse ~280 Ko sur une installation de 12 caméras → `HttpCompletionOption.ResponseHeadersRead` + `JsonSerializer.DeserializeAsync` sur le flux, jamais de `ReadAsStringAsync`.

DTO minimal (`JsonSerializerOptions { PropertyNameCaseInsensitive = true }`, tout le reste ignoré) :

```csharp
public sealed record BootstrapDto(NvrDto? Nvr, CameraDto[]? Cameras, string? LastUpdateId);
public sealed record NvrDto(string? Name, string? Version, PortsDto? Ports);
public sealed record PortsDto(int? Rtsp, int? Rtsps);
public sealed record CameraDto(string? Id, string? Name, string? Type, string? State,
                               bool IsAdopted, ChannelDto[]? Channels);
public sealed record ChannelDto(int Id, bool Enabled, bool IsRtspEnabled, string? RtspAlias,
                                int Width, int Height, int Fps, int Bitrate);
```

Schéma confirmé sur un bootstrap réel : `channels[].id` **est** l'index de qualité (0 High, 1 Medium, 2 Low, **3 Package** sur une G4 Doorbell Pro — 4 canaux, pas 3), `isRtspEnabled=false` ⇒ `rtspAlias=null`, `nvr.ports.rtsp=7447`.

### 5.2 Mapping — `CameraMapper.cs`

```csharp
public static CameraInfo Map(CameraDto dto) => new()
{
    Id = dto.Id!,
    Name = dto.Name ?? "Camera sans nom",
    Model = dto.Type,
    IsOnline = string.Equals(dto.State, "CONNECTED", StringComparison.OrdinalIgnoreCase),
    Channels = (dto.Channels ?? [])
        .Where(c => c.Enabled)
        .Select(c => new ChannelInfo
        {
            ChannelId = c.Id,
            Quality   = MapQuality(c.Id),
            Width     = c.Width,
            Height    = c.Height,
            Fps       = c.Fps,
            Bitrate   = c.Bitrate,                                  // cible annoncee, pas le debit reel
            RtspAlias = c.IsRtspEnabled ? c.RtspAlias : null        // IsAvailable en decoule
        })
        .OrderBy(c => c.Quality)
        .ToList()
};

// Ne PAS caster : un id inattendu doit degrader proprement, pas produire une enum invalide.
private static StreamQuality MapQuality(int id) => id switch
{
    0 => StreamQuality.High, 1 => StreamQuality.Medium,
    2 => StreamQuality.Low,  3 => StreamQuality.Package,
    _ => StreamQuality.Low
};
```

Filtrage : garder `IsAdopted == true`, garder les caméras `DISCONNECTED` (elles existent, elles sont juste hors ligne — la tuile affichera l'état), écarter celles dont **aucun** canal n'a d'alias avec un avertissement nommé.

### 5.3 Orchestration — `DiscoveryService.RefreshAsync`

1. `GetBootstrapAsync`
2. `config.PlainRtspPort = nvr.ports.rtsp ?? 7447` si `RtspPortFromBootstrap` (ne jamais coder 7447 en dur — c'est un réglage de console)
3. Mapper les caméras, collecter les avertissements :
   - « *Nom* : le RTSP est désactivé sur tous ses canaux. Activez-le dans Protect → Caméra → Avancé → RTSP. »
   - « *Nom* : hors ligne (`DISCONNECTED`). »
   - Aucune caméra exploitable → avertissement global bloquant dans l'assistant.
4. `catalog.Replace(cameras)` (chiffre déjà), `config.Save()`
5. `CamerasChanged` → `Ui.Post(() => mainVm.LoadCameras(...))`

### 5.4 Rafraîchissement

- **Au démarrage** : le catalogue chiffré est chargé et affiché *immédiatement* (déjà le cas dans `App.OnStartup`), puis `RefreshAsync` part en arrière-plan. Aucune attente réseau avant la première image.
- **Périodique** : toutes les `AutoRefreshMinutes` (défaut 30). Peu coûteux, et **l'alias RTSP peut changer** (désactivation/réactivation du RTSP côté caméra).
- **Sur échec de flux** : quand une tuile enchaîne les erreurs LibVLC, forcer un `RefreshAsync` avant de conclure à une panne — un alias périmé produit exactement le même symptôme qu'une caméra morte.
- **À la demande** : bouton « Actualiser les caméras » dans les réglages.
- **Diff plutôt que remplacement brut** : si la liste d'identifiants et les alias sont identiques, ne pas appeler `LoadCameras` (qui `Dispose()` toutes les tuiles et coupe la vidéo). Comparer sur `(Id, Channels[].RtspAlias, Channels[].Width)`.

---

## 6. Écran de première configuration

### 6.1 Étapes

Trois écrans fixes, le reste conditionnel — l'assistant est piloté par les réponses du contrôleur, pas par un formulaire statique. `Stack<string>` d'historique pour que « Précédent » revienne à l'écran réellement affiché.

| # | Écran | Champs | Conditionnel ? |
|---|---|---|---|
| 1 | **Trouver le contrôleur** | Adresse (défaut `192.168.1.1`), `Expander` « Avancé » replié : port HTTPS 443 | non |
| 1b | **Faire confiance au certificat** | Pin SPKI affiché, bouton « Faire confiance » | oui — si aucun pin connu |
| 2 | **S'identifier** | Identifiant, mot de passe | non |
| 2b | **Code à usage unique** | Champ multi-format (seed base32 **ou** URI `otpauth://`) | oui — si le contrôleur réclame un second facteur |
| 2c | **Horloge** | Écart mesuré + bouton « Ouvrir les réglages Windows » | oui — si `IsSuspect` |
| 3 | **Vérification et caméras** | Liste de contrôle + caméras découvertes + divulgation du stockage | non |

Champ « adresse » : normaliser en silence (`192.168.1.1`, `192.168.1.1:443`, `https://192.168.1.1`, nom d'hôte) plutôt que reprocher un « format invalide ».

### 6.2 Test de connexion — modèle de données

Jamais un booléen. Une séquence d'étapes observables, affichées en liste de contrôle grise dès le lancement, qui passent en cours (spinner) / vert / rouge au fil de l'eau.

```csharp
public enum TestStep { Resolution, Tcp, Tls, Csrf, Login, Bootstrap, Rtsp }
public enum StepState { Pending, Running, Ok, Failed, Skipped }

public sealed record StepResult(TestStep Step, StepState State, string Message,
                                string? Remedy = null, string? Technical = null);

public sealed class ConnectionTester
{
    public Task<bool> RunAsync(ProtectCredentials creds, IProgress<StepResult> progress,
                               CancellationToken ct);
}
```

Trois règles : (a) l'échec d'une étape arrête la chaîne et met les suivantes en `Skipped` (gris, pas rouge — elles n'ont pas échoué) ; (b) chaque ligne rouge porte son bouton d'action ; (c) `CancellationToken` + bouton Annuler visible, plus `Task.WhenAny(test, Task.Delay(3000))` pour afficher « C'est plus long que prévu… » au lieu d'un spinner muet.

**Le même `ConnectionTester` sert dans l'assistant et dans les réglages.** C'est le seul moyen de garantir que les messages ne divergent pas.

### 6.3 Messages d'erreur par cause

| Cause | Message | Remède proposé |
|---|---|---|
| `SocketException.HostNotFound` | « Le nom « *x* » n'a pas pu être résolu sur votre réseau. » | Saisir l'adresse IP directement |
| `ConnectionRefused` | « L'appareil répond à *IP*, mais rien n'écoute sur le port 443. Le service est peut-être arrêté. » | *(prouve que le réseau va bien — ne pas fusionner avec le timeout)* |
| `TimedOut` / `HostUnreachable` | « Aucune réponse de *IP*. L'appareil est peut-être éteint, ou votre PC n'est pas sur le même réseau. » | Vérifier le VLAN / le VPN |
| `RemoteCertificateNotAvailable` | « Ce port ne parle pas en HTTPS. » | Basculer sur le port 443 |
| Pin inconnu (TOFU) | « Votre console utilise un certificat qu'elle a généré elle-même — c'est normal pour un appareil local. Empreinte : *A1B2…* » | « Faire confiance à cet appareil » + « Où vérifier cette empreinte ? » |
| Pin **différent** | « L'identité de la console a changé depuis le dernier appairage. Cela arrive après une mise à jour de firmware, mais aussi en cas d'interception. » | Comparer l'empreinte dans l'interface UniFi avant d'accepter — **jamais** d'acceptation en un clic |
| 401 `INVALID_PAYLOAD` | « Identifiant ou mot de passe refusé par la console. » | **Ne pas vider le champ.** Ne pas réessayer automatiquement |
| Code TOTP refusé | « Le code à usage unique a été refusé. » + si `ClockCheck.IsSuspect` : « L'horloge de ce PC *retarde/avance* d'environ *N* secondes par rapport à la console : c'est très probablement la cause. » | Ouvrir les réglages date/heure Windows |
| 429 | « Trop de tentatives : la console bloque temporairement les connexions. Réessayez dans *N* minutes. » | Bouton Réessayer **désactivé** jusqu'à `_notBefore` — chaque tentative prolonge la fenêtre glissante |
| 403 sur bootstrap | « Connexion réussie, mais ce compte n'a pas le droit de lire les caméras. » | Donner le rôle Administrateur ou Visionneuse dans Protect |
| 404 sur bootstrap | « Cet appareil répond, mais ne semble pas exposer UniFi Protect. » | Vérifier que Protect est installé |
| Aucun alias RTSP | « *N* caméras trouvées, mais le RTSP est désactivé sur toutes. » | Protect → Caméra → Avancé → RTSP |

Règles de rédaction : jamais de code d'erreur en premier plan, jamais de vocabulaire accusateur (« invalide », « incorrect »), toujours un remède, saisie préservée, détail technique **repliable et sélectionnable** (pour être collé dans un mail de support).

### 6.4 Divulgation honnête du stockage

Sur l'écran 3, sans bandeau rouge ni icône d'avertissement — le stockage volontaire n'est pas une erreur :

> **Rester connecté**
>
> Pour se reconnecter seule après un redémarrage, l'application conserve sur ce PC votre mot de passe et la clé qui produit vos codes à usage unique, chiffrés par Windows pour votre compte Windows uniquement.
>
> Concrètement : une personne qui ouvre une session sous votre compte Windows peut se connecter à la console sans avoir votre téléphone. Votre compte reste protégé contre quelqu'un qui ne connaîtrait que votre mot de passe.
>
> Ces données sont liées à ce PC et à ce compte Windows : elles ne sont ni transférables ni récupérables ailleurs.
>
> `[ Rester connecté (recommandé sur un PC personnel) ]`  `[ Me demander à chaque démarrage ]`

Puis, dans les réglages, en permanence : « **Effacer les identifiants enregistrés** » — ce qui rend une divulgation honnête, c'est le bouton pour revenir en arrière.

Deux garde-fous sur la saisie du seed :
- « Où trouver cette clé ? » replié, avec le chemin exact et le rappel qu'il faut choisir « Impossible de scanner le QR code / saisie manuelle » pour voir la clé en texte.
- Le seed doit **rester enrôlé sur le téléphone**. Si ProtectViewer devient l'unique détenteur, la perte du PC verrouille le compte Ubiquiti. À dire explicitement.

### 6.5 Champs de mot de passe (WPF)

`PasswordBox` WPF **n'a pas** de `PasswordRevealMode` (c'est du WinUI/UWP) et n'expose pas `Password` en `DependencyProperty` : superposer `PasswordBox` + `TextBox` pilotés par un booléen `Revele` dans le VM, via un **comportement attaché**, en préservant focus et position du curseur à la bascule. `AutomationProperties.Name` qui change d'état (« Afficher le mot de passe » / « Masquer le mot de passe »). Collage **jamais** bloqué. Champ large, tolérant aux espaces de fin — les gestionnaires de mots de passe remplissent très mal les applications WPF natives.

### 6.6 Réglages après coup

Fenêtre **non modale** redimensionnable, sections Connexion / Caméras / Transport / Avancé / À propos. Texte sélectionnable. Conformément au CLAUDE.md : **aucune modale de saisie ne se ferme au clic extérieur**.

Deux flux distincts, séparés (modèle Home Assistant) :
- **Ré-authentification** : déclenchée automatiquement quand la session ne passe plus. Bannière non bloquante en haut de la fenêtre principale (« Reconnexion nécessaire »), qui ouvre **uniquement** l'étape fautive, hôte et identifiant déjà connus.
- **Reconfiguration** : déclenchée par l'utilisateur (l'IP a changé). Met à jour la configuration existante, ne recrée jamais tout.

Le secret déjà enregistré s'affiche `•••••••• (enregistré)` + bouton « Remplacer ». Ne jamais pré-remplir un vrai secret dans un champ, ne l'écraser que si l'utilisateur saisit quelque chose.

---

## 7. Ordre d'implémentation

Chaque étape est vérifiable seule. Ne pas enchaîner sans le critère de réussite.

| # | Étape | Critère de réussite |
|---|---|---|
| **1** | `Totp` + `Base32Secret` + tests | Les 4 vecteurs RFC 6238 passent ; `"jbsw y3dp-EHPK3pxp"` et `"JBSWY3DPEHPK3PXP===="` donnent la même clé ; `"A"` et `"JBSW1"` échouent avec un message français **(déjà fait ci-dessus : vecteurs OK sur net8.0-windows)** |
| **2** | `JwtClaims` + `ProtectSession` | Un JWT réel de la console donne `csrfToken` et `exp` = +30 j ; un JWT **sans** `exp` est **rejeté** ; `TryParseSessionCookie` accepte `TOKEN=` et `UOS_TOKEN=`, refuse `Path=/` seul |
| **3** | `SpkiPinning` | `ComputePin` sur le certificat réel de 192.168.1.1 donne une valeur stable entre deux exécutions ; un pin faux fait échouer le handshake ; le mode TOFU renvoie le pin découvert |
| **4** | `UniFiSessionHandler` seul | Sur un `HttpMessageHandler` factice : `Cookie` et `X-CSRF-Token` présents **une seule fois** après deux envois de la même instance ; `x-updated-csrf-token` l'emporte sur `x-csrf-token` ; `onChanged` n'est **pas** appelé si le CSRF est inchangé |
| **5** | `ProtectAuthenticator` + login réel | `POST /api/auth/login` renvoie 200, `session.IsUsable == true`, `ExpiresAt ≈ now + 30 j`. **Un seul essai** — pas de boucle de test, le 429 est à 5 échecs |
| **6** | `ReauthenticationHandler` + anti-tempête | Sur handler factice : 401 → rejeu → 200 en exactement 2 envois et **1** login ; corps rejoué intact ; 20 requêtes concurrentes toutes en 401 → **1 seul login** ; 401 persistant → 2 envois max ; requête `NoReauth` → 1 envoi, 0 relogin |
| **7** | `SessionStore` + redémarrage | Fermer l'appli, la relancer : **aucun** appel à `/api/auth/login` dans le journal, le bootstrap passe directement. Corrompre 1 octet du fichier → message clair, pas d'exception non gérée |
| **8** | `ProtectApiClient.GetBootstrapAsync` + DTO | La réponse réelle se désérialise ; `nvr.ports.rtsp == 7447` ; les 2 caméras remontent avec leurs canaux et `isRtspEnabled` conforme à l'interface Protect |
| **9** | `CameraMapper` + `DiscoveryService` | `catalog.Replace` écrit, l'appli redémarre et affiche les tuiles **sans réseau** ; les résolutions correspondent à `contraintes-verifiees.md` (3840×2160 / 2688×1512) ; un canal RTSP désactivé produit un avertissement, pas une tuile morte |
| **10** | Flux de bout en bout | Les alias découverts alimentent `StreamUrlBuilder` et **la vidéo s'affiche** sans aucune saisie manuelle d'alias |
| **11** | `ClockProbe` | Avancer l'horloge Windows de 60 s → `IsSuspect == true` et offset ≈ −60 s ; remettre à l'heure → `IsSuspect == false`. **Remettre l'horloge avant de continuer** |
| **12** | `ConnectionTester` | Chaque cause du tableau §6.3 est reproductible et produit le bon message : mauvais hôte, mauvais port, mauvais mot de passe, mauvais seed, horloge décalée |
| **13** | `SetupWizardWindow` | Sur une machine vierge (renommer `%APPDATA%\ProtectViewer`), l'assistant s'ouvre, se termine, et le lancement suivant va directement au mur d'images |
| **14** | `SettingsWindow` + bannière de ré-auth | Effacer la session à la main → la bannière apparaît en cours d'usage, le bouton ouvre l'étape fautive et pré-remplit le reste ; « Effacer les identifiants » ramène à l'assistant |
| **15** | Auto-revue du diff complet | Relecture intégrale : fuite de secret dans le journal, `Dispose` manquant, `ConfigureAwait`, accès UI hors dispatcher, chemins d'exception non typés |

Étape 5 : **un seul essai de login par session de développement.** Le seuil est à ~5 échecs, la fenêtre est glissante et chaque tentative la prolonge. Un mot de passe mal recopié dans un test peut verrouiller l'accès pour ~3 minutes… et le verrouillage frappe aussi les bons identifiants.

---

## 8. Pièges

**Transport / cookies**
1. `UseCookies = false` obligatoire. `CookieContainer` jette **silencieusement** un cookie dont `Expires` est déjà passé (0 cookie stocké, `GetCookieHeader` vide, aucune exception) — un logout partiel ou une horloge désynchronisée fait perdre la session sans bruit.
2. Le cookie s'appelle `TOKEN` **ou** `UOS_TOKEN` selon la version de UniFi OS. Un parseur codé en dur sur `TOKEN` perd la session après une MAJ.
3. `PooledConnectionLifetime` par défaut est **infini**. La console redémarre, un socket keepalive survit à l'événement, la requête suivante échoue de façon opaque. 1 minute.
4. Pendant un reboot de console, l'API renvoie transitoirement **400 et 404**, pas seulement des 5xx. Ne pas traiter un 404 comme « endpoint inexistant » sans réessai.

**Rejeu et en-têtes**
5. Sur le second envoi, l'instance `HttpRequestMessage` porte encore les en-têtes du premier. `TryAddWithoutValidation` les **concatène** (`"v0, v1"`) au lieu de remplacer → `CSRF_TOKEN_IS_INVALID` en boucle. Toujours `Headers.Remove(...)` avant d'estampiller.
6. `LoadIntoBufferAsync(CancellationToken)` **n'existe pas en net8** (ajoutée en net9) : le compilateur résout vers la surcharge `long maxBufferSize` et sort `CS1503`. Utiliser `LoadIntoBufferAsync()`.
7. `JsonContent.Create` exige `using System.Net.Http.Json;` — **erreur rencontrée à la compilation de ce plan** (`CS0103`), le `using System.Net.Http.Headers` ne suffit pas.
8. `HttpClient.Timeout` couvre **tout** `SendAsync`, donc 401 + relogin + rejeu. 5 s ferait échouer une reauth qui aurait abouti. ≥ 30 s.

**Session**
9. `exp` **absent** du JWT : `ExpiresAt` est `DateTimeOffset?`, et `null <= now+60s` vaut **false** — une règle naïve `if (exp <= now+60) rejeter;` **accepte** le jeton. Tester la présence explicitement (`c.ExpiresAt is { } exp && exp > …`).
10. `exp` valide ne garantit rien : UniFi OS peut couper une session avant l'expiration du cookie, le claim `passwordRevision` invalide le jeton à tout changement de mot de passe, et les clés de signature tournent quotidiennement. **Le chemin `401 → relogin → rejeu` est obligatoire**, pas une optimisation.
11. `rememberMe: false` donne 2 h (`exp - iat = 7200`) : plusieurs relogins par jour, puis verrouillage. Toujours `true`.

**Rate limit**
12. Le 429 ne garde **que** `/api/auth/login`. Une session établie continue de fonctionner pendant le verrouillage. Corollaire : ne jamais relancer un login « pour vérifier l'état » — sonder avec la session en cache.
13. La fenêtre est **glissante et chaque tentative la prolonge**. Un backoff linéaire (+1 s) prolonge le verrouillage indéfiniment. Exponentiel + jitter plein + `_notBefore` qui refuse **localement** sans toucher au réseau.
14. Un mot de passe faux ne doit **jamais** être retenté automatiquement : drapeau `_credentialsRejected` permanent jusqu'à modification de la configuration.
15. `SemaphoreSlim` seul ne suffit pas : les appelants en file feront chacun leur login à tour de rôle. Le compteur de génération photographié **avant** l'envoi est ce qui casse la tempête.

**TLS**
16. Le `RemoteCertificateValidationCallback` est invoqué **une fois par connexion TCP**, pas par requête. Avec un pool actif il ne se déclenche quasiment jamais : n'y mettre aucun effet de bord attendu à chaque appel.
17. Ne **jamais** disposer le `X509Certificate2` reçu dans le callback : il appartient à `SslStream`, le disposer casse la connexion et les suivantes.
18. `Thumbprint` est un SHA-1 codé en dur du certificat entier : rééditer un certificat avec la même clé change le thumbprint mais pas le pin SPKI. Sur UDM le certificat `unifi-core` est régénéré au redémarrage du service et aux MAJ firmware → pin par thumbprint = panne à chaque MAJ.
19. Ne **jamais** `ServicePointManager.ServerCertificateValidationCallback = (_,_,_,_) => true` : portée globale, empoisonne toute l'application.

**TOTP**
20. `DateTime.Now` au lieu de `UtcNow` produit **silencieusement** un code faux.
21. Ne jamais mettre le code en cache : il vaut 30 s et la console rejette un code déjà consommé. Le calculer au moment du rejeu.
22. `(int)Math.Pow(10, digits)` sature à `int.MaxValue` pour `digits >= 10` → modulo faux, sans exception. Boucle entière.
23. Un espace dans le seed collé fait échouer un décodeur base32 strict : normaliser, ne pas reprocher.

**Découverte**
24. `camera.channels[]` n'est **pas** toujours au nombre de 3 (4 sur une Doorbell Pro : canal Package en `id=3`). Ne jamais indexer en dur, ne jamais coder les résolutions.
25. `nvr.ports.rtsp` est un réglage de console : le lire, pas supposer 7447.
26. `isRtspEnabled=false` ⇒ `rtspAlias=null`. Ne pas construire une URL avec `null` : `ChannelInfo.IsAvailable` existe déjà, s'en servir partout.
27. L'alias RTSP **change** si l'on désactive puis réactive le RTSP côté caméra. Un flux qui ne démarre plus n'est pas forcément une caméra morte : re-découvrir avant de conclure.
28. `LoadCameras` fait `Dispose()` sur toutes les tuiles et coupe la vidéo. Ne l'appeler que si le diff est réel.

**Secrets et journal**
29. `Log.Redact` ne masque **aujourd'hui que l'alias RTSP**. Ajouter impérativement : le JWT (`(TOKEN|UOS_TOKEN)=\S+`), le seed base32, le mot de passe, et tout corps de `/api/auth/login`. Un JWT est un porteur équivalent au mot de passe pendant 30 jours.
30. Écriture atomique du fichier de session (`.tmp` **dans le même dossier**, puis `File.Move(overwrite: true)`) : un fichier tronqué = un relogin de plus vers le 429. Attraper `IOException` (une autre instance peut verrouiller).
31. Ne **jamais** enregistrer les identifiants avant qu'un test complet n'ait réussi : sinon on obtient une configuration cassée silencieuse au prochain démarrage.

**UI**
32. Tout accès aux propriétés liées depuis un thread de fond passe par `Ui.Post`. `RefreshAsync` tourne sur le pool.
33. Ne pas afficher de barre de progression fictive pendant le test : elle fait croire que ça avance avant l'échec. Liste de contrôle avec états réels.
34. Une découverte réseau ne doit jamais créer la configuration automatiquement : toujours une confirmation utilisateur.

---

## Marqué [NON VERIFIE]

- Le corps exact renvoyé par UniFi OS quand le **code TOTP** est faux (par opposition au mot de passe) — conditionne `Classify` ; en attendant, un 401 sans `INVALID_PAYLOAD` est traité comme `BadTotp`.
- Les branches 2FA en **deux temps** (200 + `api.err.Ubic2faTokenRequired` ; 499 + `data.mfaCookie`) : non observées ici, le login est en une étape. À coder en défense, pas comme chemin nominal.
- La présence de l'en-tête `Date` sur `HEAD /` de l'UDM Pro — sinon `ClockProbe` retourne toujours `null`.
- Les seuils réels de rate limit sur **cette** console (~5 échecs / ~3 min sont des valeurs communautaires).
- Le comportement de `File.Move(overwrite:true)` sous verrou concurrent quand deux instances de ProtectViewer tournent (l'appli est mono-instance de fait, mais rien ne l'impose aujourd'hui).
- La découverte mDNS/SSDP de la console : non testée, et sans doute inutile ici (adresse fixe connue). À ne pas coder au lot 3.
- L'activation du RTSP par `PATCH /proxy/protect/api/cameras/{id}` quand `isRtspEnabled=false` : mécanisme plausible, jamais essayé — le lot 3 se contente d'**avertir**, il ne modifie pas la configuration de la console.