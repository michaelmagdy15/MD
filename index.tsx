import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is off to prevent double-initialization of Three.js
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);