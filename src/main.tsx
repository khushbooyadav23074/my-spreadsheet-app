import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx'; // This imports the default export from App.tsx (which is WrappedApp)
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
