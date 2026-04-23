import React from 'react';
import {
  ChartBarIcon,
  ShoppingCartIcon,
  CubeIcon,
  BanknotesIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  BeakerIcon,
  ReceiptPercentIcon,
  TagIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: ChartBarIcon },
  { key: 'pos', label: 'POS', icon: ShoppingCartIcon },
  { key: 'wholesale', label: 'Mayoreo', icon: TagIcon },
  { key: 'products', label: 'Productos', icon: CubeIcon },
  { key: 'production', label: 'Producción', icon: WrenchScrewdriverIcon },
  { key: 'finances', label: 'Finanzas', icon: BanknotesIcon },
  { key: 'clients', label: 'Clientes', icon: UsersIcon },
  { key: 'credits', label: 'Créditos', icon: ClipboardDocumentListIcon },
  { key: 'fridges', label: 'Refris', icon: TruckIcon },
  { key: 'materials', label: 'Materias primas', icon: BeakerIcon },
  { key: 'sales', label: 'Ventas', icon: ReceiptPercentIcon },
] as const;

type SidebarProps = {
  current: string;
  onSelect: (key: (typeof navItems)[number]['key']) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({ current, onSelect }) => {
  return (
    <aside className="bg-surface/95 border-r border-borderSoft/80 h-full w-64 flex flex-col p-4 gap-6 no-print shadow-[8px_0_30px_rgba(47,49,51,0.05)]">
      <div className="flex items-center gap-3 px-2">
        {/* Logo (usa el icono 192 de /public/icons/icon-192.png) */}
        <div className="h-10 w-10 rounded-2xl bg-butter/25 shadow-soft flex items-center justify-center overflow-hidden border border-borderSoft/80">
          <img
            src="/icons/icon-192.png"
            alt="Helatte"
            className="h-full w-full object-contain p-1"
            draggable={false}
          />
        </div>

        <div>
          <p className="text-lg font-semibold">Helatte POS</p>
          <p className="text-sm text-textMuted">Sucursal única</p>
        </div>
      </div>

      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map(({ key, label, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left font-medium transition-all border ${
                active
                  ? 'bg-primarySoft text-coffee border-primary/30 shadow-[0_10px_24px_rgba(223,159,195,0.20)]'
                  : 'text-textMuted border-transparent hover:bg-sky/20 hover:text-coffee'
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-blushDeep' : 'text-textMuted'}`} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="text-xs text-textMuted px-2">Hecho para flujo rápido y estable.</div>
    </aside>
  );
};
