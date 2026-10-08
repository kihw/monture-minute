import React from 'react';
import ReactDOM from 'react-dom/client';
import CompactApp from './CompactApp';
import AppStage from './AppStage';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppStage>
      <CompactApp />
    </AppStage>
  </React.StrictMode>,
);
