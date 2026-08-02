# Cree le certificat de signature de Alcora, une seule fois.
#
#   powershell -ExecutionPolicy Bypass -File scripts\certificat.ps1
#
# Le certificat vit dans le magasin personnel de CE compte Windows. La cle privee ne
# quitte jamais la machine : la construction signe en la designant par son empreinte,
# sans jamais manipuler de mot de passe.
#
# Deux fichiers sont produits dans « signature\ », a la racine du depot :
#   Alcora-signature.cer   partie PUBLIQUE, a installer sur les PC (voir confiance.ps1)
#   Alcora-signature.pfx   sauvegarde complete, lisible par ce seul compte Windows
#
# Ce dossier ne doit jamais partir dans le depot : il est exclu par .gitignore.

$ErrorActionPreference = 'Stop'

$sujet   = 'CN=Alcora'
$dossier = Join-Path (Split-Path $PSScriptRoot -Parent) 'signature'
$cer     = Join-Path $dossier 'Alcora-signature.cer'
$pfx     = Join-Path $dossier 'Alcora-signature.pfx'
$pwd_    = Join-Path $dossier 'Alcora-signature.pwd'

$existant = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
            Where-Object { $_.Subject -eq $sujet } |
            Sort-Object NotAfter -Descending |
            Select-Object -First 1

if ($existant) {
  Write-Host "Certificat deja present, valable jusqu'au $($existant.NotAfter.ToString('dd.MM.yyyy'))."
  $cert = $existant
} else {
  # Dix ans : un certificat auto-signe qui expire obligerait a refaire confiance sur
  # chaque PC, pour aucun benefice de securite.
  $cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $sujet `
    -FriendlyName 'Alcora — signature applicative' `
    -KeyUsage DigitalSignature `
    -KeyExportPolicy Exportable `
    -KeyAlgorithm RSA -KeyLength 3072 `
    -HashAlgorithm SHA256 `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(10)
  Write-Host "Certificat cree, valable jusqu'au $($cert.NotAfter.ToString('dd.MM.yyyy'))."
}

if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Path $dossier | Out-Null }

Export-Certificate -Cert $cert -FilePath $cer -Force | Out-Null

# La construction designe la cle par son empreinte : elle n'a donc jamais a manipuler la
# cle elle-meme, qui reste dans le magasin de Windows.
Set-Content (Join-Path $dossier 'empreinte.txt') $cert.Thumbprint -Encoding ascii

# La sauvegarde exige un mot de passe (« -ProtectTo » demanderait un compte de domaine,
# ce qui n'est pas le cas ici). On en tire un au hasard et on le range chiffre par Windows
# pour ce seul compte : rien a retenir, et illisible depuis un autre compte ou un autre PC.
$brut = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))
$motDePasse = ConvertTo-SecureString $brut -AsPlainText -Force
Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $motDePasse -Force | Out-Null
$motDePasse | ConvertFrom-SecureString | Set-Content $pwd_ -Encoding utf8

Write-Host ''
Write-Host "Empreinte : $($cert.Thumbprint)"
Write-Host "Public    : $cer"
Write-Host "Sauvegarde: $pfx  (mot de passe dans $($pwd_ | Split-Path -Leaf), chiffre pour ce compte)"
Write-Host ''
Write-Host 'Etape suivante : sur CHAQUE PC, en administrateur,'
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\confiance.ps1'
