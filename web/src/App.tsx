import React, { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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
import { supabase } from './lib/supabase';

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

type BrandMembership = { brand_id: string; brands: { id: string; name: string } | null };

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

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="card w-full max-w-md p-6 space-y-4">
        <div>
          <p className="text-xs uppercase text-textMuted font-semibold tracking-[0.24em]">Helatte POS</p>
          <h1 className="text-2xl font-bold">Iniciar sesión</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Correo
            <input className="border border-borderSoft rounded-lg px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Contraseña
            <input type="password" className="border border-borderSoft rounded-lg px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p className="text-sm text-blushDeep">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Validando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const AppContent: React.FC<{ membership: BrandMembership; memberships: BrandMembership[]; onChangeBrand: (id: string) => void }> = ({ membership, memberships, onChangeBrand }) => {
  const [view, setView] = useState<ViewKey>('dashboard');

  return (
    <PosProvider brandId={membership.brand_id}>
      <div className="h-screen flex bg-background text-coffee">
        <Sidebar current={view} onSelect={setView} />
        <main className="flex-1 overflow-y-auto">
          <header className="flex items-center justify-between p-6 sticky top-0 bg-background/95 backdrop-blur border-b border-borderSoft/80 no-print">
            <div>
              <p className="text-xs uppercase text-textMuted font-semibold tracking-[0.24em]">Helatte POS</p>
              <h1 className="text-2xl font-bold">{titles[view]}</h1>
            </div>
            <div className="flex items-center gap-3">
              <select className="border border-borderSoft rounded-lg px-3 py-2 bg-surface" value={membership.brand_id} onChange={(e) => onChangeBrand(e.target.value)}>
                {memberships.map((item) => (
                  <option key={item.brand_id} value={item.brand_id}>
                    {item.brands?.name ?? 'Marca'}
                  </option>
                ))}
              </select>
              <button className="px-3 py-2 rounded-xl border border-borderSoft bg-secondarySoft text-sm" onClick={() => void supabase.auth.signOut()}>
                Cerrar sesión
              </button>
              <ExportButton />
            </div>
          </header>
          <div className="p-6">{views[view]}</div>
        </main>
      </div>
    </PosProvider>
  );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<BrandMembership[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [loadingMemberships, setLoadingMemberships] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const loadMemberships = async () => {
      if (!session?.user?.id) {
        setMemberships([]);
        setSelectedBrandId(null);
        setLoadingMemberships(false);
        return;
      }

      setLoadingMemberships(true);
      const { data, error } = await supabase
        .from('brand_users')
        .select('brand_id, brands(id, name)')
        .eq('user_id', session.user.id);

      if (error) {
        setMemberships([]);
        setSelectedBrandId(null);
        setLoadingMemberships(false);
        return;
      }

      const normalized: BrandMembership[] = (data ?? []).map((row: any) => ({
        brand_id: row.brand_id,
        brands: Array.isArray(row.brands) ? row.brands[0] ?? null : row.brands,
      }));
      setMemberships(normalized);
      setSelectedBrandId((prev) => prev ?? normalized[0]?.brand_id ?? null);
      setLoadingMemberships(false);
    };

    void loadMemberships();
  }, [session?.user?.id]);

  const activeMembership = useMemo(
    () => memberships.find((item) => item.brand_id === selectedBrandId) ?? memberships[0] ?? null,
    [memberships, selectedBrandId],
  );

  if (!session) return <LoginPage />;
  if (loadingMemberships) return <div className="min-h-screen grid place-items-center">Cargando marcas...</div>;
  if (!activeMembership) return <div className="min-h-screen grid place-items-center">Sin acceso a marcas.</div>;

  return <AppContent membership={activeMembership} memberships={memberships} onChangeBrand={setSelectedBrandId} />;
};

export default App;
