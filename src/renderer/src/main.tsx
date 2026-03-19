import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './pages/App';
import './index.css';
import { ClientesProvider } from './state/ClientesContext';
import { BrandProvider, useBrandContext } from './state/BrandContext';

function AppProviders() {
  const { activeBrand } = useBrandContext();

  return (
    <ClientesProvider key={activeBrand?.id ?? 'sin-marca'}>
      <App />
    </ClientesProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <BrandProvider>
        <AppProviders />
      </BrandProvider>
    </HashRouter>
  </React.StrictMode>,
);
