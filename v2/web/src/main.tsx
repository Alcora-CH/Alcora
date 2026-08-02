import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/*
 * Le mode strict de React est volontairement DESACTIVE.
 *
 * Il monte, demonte puis remonte chaque composant en developpement, ce qui ouvre puis
 * ferme une session WebRTC par tuile a chaque demarrage. Le relais, qui multiplexe toutes
 * les sessions sur un meme port, n'en garde qu'une sur deux — comportement impossible a
 * distinguer d'un vrai defaut, et qui n'existe pas en production.
 *
 * Le cycle de vie des sessions est deja protege : chaque effet ne ferme que la session
 * qu'il a lui-meme ouverte (voir CameraTile). Ce reglage supprime le bruit, pas la rigueur.
 */
createRoot(document.getElementById('root')!).render(<App />)
