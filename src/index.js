import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// SEM StrictMode para evitar erro IndexedDB do Firebase
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
