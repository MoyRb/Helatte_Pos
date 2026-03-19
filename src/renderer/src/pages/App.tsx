import { Routes, Route, NavLink } from 'react-router-dom';
import { Gauge, ShoppingBag, Boxes, Users, CreditCard, Refrigerator, Home, Wallet, ClipboardList, ChevronsUpDown } from 'lucide-react';
import Dashboard from './Dashboard';
import Catalogo from './Catalogo';
import Inventario from './Inventario';
import Ventas from './Ventas';
import Finanzas from './Finanzas';
import Creditos from './Creditos';
import Refris from './Refris';
import Clientes from './Clientes';
import Produccion from './Produccion';
import { useMemo } from 'react';
import { useBrandContext } from '../state/BrandContext';

const menu = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/ventas', label: 'POS Ventas', icon: ShoppingBag },
  { path: '/catalogo', label: 'Catálogo', icon: Boxes },
  { path: '/inventario', label: 'Inventarios', icon: Gauge },
  { path: '/finanzas', label: 'Cajas', icon: Wallet },
  { path: '/creditos', label: 'Créditos', icon: CreditCard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/produccion', label: 'Producción', icon: ClipboardList },
  { path: '/refris', label: 'Refris', icon: Refrigerator }
];

export default function App() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const { brands, activeBrand, loading, error, setActiveBrand } = useBrandContext();
  const logoSrc = `${import.meta.env.BASE_URL}${activeBrand?.logoPath ?? 'brands/helatte-logo.svg'}`;
  const brandName = activeBrand?.nombre ?? 'Helatte';
  const subtitle = activeBrand?.subtitulo ?? 'Nevería & Paletería';

  return (
    <div className="flex h-screen bg-background text-texto">
      <aside className="w-64 bg-white/70 backdrop-blur border-r border-borderSoft/80 p-4 flex flex-col shadow-[8px_0_30px_rgba(47,49,51,0.05)]">
        <div className="mb-6 space-y-2">
          <label className="flex items-center justify-between rounded-2xl border border-borderSoft/80 bg-white/85 px-3 py-3 shadow-sm transition focus-within:border-blush/45 focus-within:ring-2 focus-within:ring-blush/20">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-borderSoft/80 bg-white/80 p-1 shadow-sm">
                <img src={logoSrc} alt={`Logo de ${brandName}`} className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-lg">{brandName}</p>
                <p className="truncate text-sm text-text/60">{subtitle}</p>
              </div>
            </div>
            <ChevronsUpDown size={16} className="shrink-0 text-text/45" />
            <select
              aria-label="Seleccionar marca activa"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={activeBrand?.slug ?? ''}
              onChange={(event) => void setActiveBrand(event.target.value)}
              disabled={loading || brands.length === 0}
            >
              {brands.map((brand) => (
                <option key={brand.slug} value={brand.slug}>
                  {brand.nombre}
                </option>
              ))}
            </select>
          </label>
          <p className="px-1 text-xs text-text/55">
            {loading ? 'Cambiando contexto de marca…' : 'Cada marca conserva sus propios datos operativos.'}
          </p>
          {error ? <p className="px-1 text-xs text-red-500">{error}</p> : null}
        </div>

        <nav className="flex-1 space-y-1">
          {menu.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl border px-3 py-2 text-sm font-medium transition-all ${isActive ? 'border-blush/45 bg-blush/28 text-text shadow-sm' : 'border-transparent text-text/68 hover:bg-sky/18 hover:text-text'}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <p className="text-xs text-text/50">© {year} {brandName}</p>
      </aside>
      <main key={activeBrand?.id ?? 'sin-marca'} className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-ivory via-white/40 to-sky/10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/creditos" element={<Creditos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/produccion" element={<Produccion />} />
          <Route path="/refris" element={<Refris />} />
        </Routes>
      </main>
    </div>
  );
}
