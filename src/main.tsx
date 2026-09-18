import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

// Diagnostic runtime telemetry
console.info('[EPP MES] main.tsx executing...');

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    console.error('[EPP MES Global Error]', event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[EPP MES Unhandled Promise Rejection]', event.reason);
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('[EPP MES Fatal] Target container #root not found in document.');
} else {
  console.info('[EPP MES] Mounting React root into #root...');
  try {
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>,
    );
    console.info('[EPP MES] React root successfully rendered.');
  } catch (renderError) {
    console.error('[EPP MES Fatal] Exception occurred while mounting React root:', renderError);
  }
}

