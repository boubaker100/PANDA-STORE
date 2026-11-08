import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import '@fontsource-variable/alexandria';
import './styles.css';
import { AppProvider } from './state';
import { App } from './App';
import { startTelegram } from './lib/telegram';
import { registerServiceWorker } from './lib/install';

startTelegram('#ffffff');
registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
);
