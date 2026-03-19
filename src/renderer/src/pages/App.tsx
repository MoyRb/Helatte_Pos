import { Routes, Route, NavLink } from 'react-router-dom';
import { Gauge, ShoppingBag, Boxes, Users, CreditCard, Refrigerator, BarChart3, Home, Wallet } from 'lucide-react';
import Dashboard from './Dashboard';
import Catalogo from './Catalogo';
import Inventario from './Inventario';
import Ventas from './Ventas';
import Finanzas from './Finanzas';
import Creditos from './Creditos';
import Refris from './Refris';
import Clientes from './Clientes';
import { useMemo } from 'react';

const menu = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/ventas', label: 'POS Ventas', icon: ShoppingBag },
  { path: '/catalogo', label: 'Catálogo', icon: Boxes },
  { path: '/inventario', label: 'Inventarios', icon: Gauge },
  { path: '/finanzas', label: 'Cajas', icon: Wallet },
  { path: '/creditos', label: 'Créditos', icon: CreditCard },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/refris', label: 'Refris', icon: Refrigerator }
];

export default function App() {
  const year = useMemo(() => new Date().getFullYear(), []);
  return (
    <div className="flex h-screen bg-background text-texto">
      <aside className="w-64 bg-white/70 backdrop-blur border-r border-borderSoft/80 p-4 flex flex-col shadow-[8px_0_30px_rgba(47,49,51,0.05)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-borderSoft/80 bg-white/80 p-1 shadow-sm">
            <img src="/logo.png" alt="Logo de Helatte POS" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-lg">Helatte POS</p>
            <p className="text-sm text-text/60">Nevería &amp; Paletería</p>
          </div>
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
        <p className="text-xs text-text/50">© {year} Helatte</p>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-ivory via-white/40 to-sky/10">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/finanzas" element={<Finanzas />} />
          <Route path="/creditos" element={<Creditos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/refris" element={<Refris />} />
        </Routes>
      </main>
    </div>
  );
}
