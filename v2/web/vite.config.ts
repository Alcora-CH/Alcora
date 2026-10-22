import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
 * La politique de contenu se RESSERRE a la construction.
 *
 * index.html autorise les scripts en ligne et localhost : le serveur de developpement en a
 * besoin (le rechargement a chaud injecte un script en ligne, et parle par WebSocket a
 * localhost). L'application livree, elle, n'en a aucun besoin — et une politique qui admet
 * les scripts en ligne ne protege plus de rien le jour ou une injection HTML apparait.
 * Audit du 22.10.2026.
 *
 * Si l'ancre change dans index.html, la construction ECHOUE plutot que de livrer en silence
 * une politique laxiste.
 */
function politiqueStricte(): Plugin {
  return {
    name: 'alcora-politique-stricte',
    apply: 'build',
    transformIndexHtml(html) {
      const scripts = "script-src 'self' 'unsafe-inline'";
      const local = ' ws://localhost:* http://localhost:*';
      if (!html.includes(scripts) || !html.includes(local)) {
        throw new Error('politique de contenu : ancre introuvable dans index.html, rien ne serait resserre');
      }
      return html.replace(scripts, "script-src 'self'").replace(local, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), politiqueStricte()],
  server: {
    port: 5180,
    strictPort: true,
  },
})
