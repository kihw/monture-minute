import React from 'react';
import ReactDOM from 'react-dom/client';
import CompactApp from './CompactApp';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CompactApp />
  </React.StrictMode>,
);
