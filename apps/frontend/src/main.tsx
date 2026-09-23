import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';

// Presentation Layer pur : aucun accès direct à la base ou au Business
// Layer, uniquement des appels HTTP vers l'API backend (cf. ADR-001).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
