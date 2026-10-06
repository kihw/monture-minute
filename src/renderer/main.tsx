import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CompactApp from './CompactApp';
import './styles/global.css';

/**
 * Les deux fenêtres partagent le même bundle : le hash décide laquelle est
 * rendue. Cela évite un second point d'entrée Vite et un second index.html.
 */
const isCompact = window.location.hash === '#compact';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isCompact ? <CompactApp /> : <App />}
  </React.StrictMode>,
);
