import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

/* Ionic: estilos básicos e utilitários */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Fontes embutidas no app (funcionam sem internet) */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';

import './tema/tema.css';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App';

// Versão iPhone/navegador: guarda o app no aparelho para abrir sem internet
// e atualiza sozinho quando sair versão nova. No APK isso não é necessário.
if (!Capacitor.isNativePlatform() && import.meta.env.PROD) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
