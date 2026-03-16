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
      <aside className="w-64 bg-surface/80 backdrop-blur border-r border-secondary/70 p-4 flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-primary shadow-inner" />
          <div>
            <p className="font-semibold text-lg">Helatte POS</p>
            <p className="text-sm text-gray-600">Nevería &amp; Paletería</p>
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
                  `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/70 text-black' : 'hover:bg-primary/30'}`
                }
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <p className="text-xs text-gray-500">© {year} Helatte</p>
      </aside>
      <main className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-surface to-background">
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
