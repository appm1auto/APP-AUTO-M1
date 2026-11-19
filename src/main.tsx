import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Garante atualização imediata caso exista um Service Worker antigo em cache no navegador
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((reg) => {
        void reg.update();
      });
    })
    .catch(() => {
      // ignore
    });
}

createRoot(document.getElementById('root')!).render(<App />);
