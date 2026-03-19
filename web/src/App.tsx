import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { PosProvider } from './context/PosContext';
import { ProductsPage } from './pages/ProductsPage';
import { PosPage } from './pages/PosPage';
import { DashboardPage } from './pages/DashboardPage';
import { FinancePage } from './pages/FinancePage';
import { ClientsPage } from './pages/ClientsPage';
import { CreditsPage } from './pages/CreditsPage';
import { FridgesPage } from './pages/FridgesPage';
import { MaterialsPage } from './pages/MaterialsPage';
import { SalesPage } from './pages/SalesPage';
import { WholesalePage } from './pages/WholesalePage';
import { ExportButton } from './components/ExportButton';

const views = {
  dashboard: <DashboardPage />,
  pos: <PosPage />,
  wholesale: <WholesalePage />,
  products: <ProductsPage />,
  finances: <FinancePage />,
  clients: <ClientsPage />,
  credits: <CreditsPage />,
  fridges: <FridgesPage />,
  materials: <MaterialsPage />,
  sales: <SalesPage />,
};

const titles: Record<string, string> = {
  dashboard: 'Panel general',
  pos: 'Punto de venta',
  wholesale: 'Venta Mayoreo',
  products: 'Productos',
  finances: 'Finanzas',
  clients: 'Clientes',
  credits: 'Créditos',
  fridges: 'Refris',
  materials: 'Materias primas',
  sales: 'Ventas',
};

type ViewKey = keyof typeof views;

const AppContent: React.FC = () => {
  const [view, setView] = useState<ViewKey>('dashboard');

  return (
    <div className="h-screen flex bg-background text-coffee">
      <Sidebar current={view} onSelect={setView} />
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between p-6 sticky top-0 bg-background/95 backdrop-blur border-b border-borderSoft/80 no-print">
          <div>
            <p className="text-xs uppercase text-textMuted font-semibold tracking-[0.24em]">Helatte POS</p>
            <h1 className="text-2xl font-bold">{titles[view]}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton />
            <div className="px-4 py-2 rounded-xl border border-borderSoft bg-surface shadow-card text-sm text-textMuted">
              Modo offline / localStorage
            </div>
          </div>
        </header>
        <div className="p-6">{views[view]}</div>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <PosProvider>
    <AppContent />
  </PosProvider>
);

export default App;
