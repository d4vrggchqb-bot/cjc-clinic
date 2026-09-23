import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './css/app.css';

declare global {
  interface Window {
    __cjc_mounted__?: boolean;
  }
}

const container = document.getElementById('app');
if (container) {
  window.__cjc_mounted__ = true;
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error('[CJC] Fatal: Could not find #app container.');
}

