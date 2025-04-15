import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './App.css'; // Import global styles
import WalletContextProvider from './WalletContextProvider.tsx';

// Import wallet adapter CSS AFTER your own CSS to allow overrides
import '@solana/wallet-adapter-react-ui/styles.css';

// Polyfill Buffer globally
import { Buffer } from 'buffer';
window.Buffer = Buffer;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletContextProvider>
      <App />
    </WalletContextProvider>
  </React.StrictMode>,
);
