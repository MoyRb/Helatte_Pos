import { Routes, Route, NavLink } from 'react-router-dom';
import { Gauge, ShoppingBag, Boxes, Users, CreditCard, Refrigerator, Home, Wallet, ClipboardList, ChevronsUpDown, Check } from 'lucide-react';
import Dashboard from './Dashboard';
import Catalogo from './Catalogo';
import Inventario from './Inventario';
import Ventas from './Ventas';
import Finanzas from './Finanzas';
import Creditos from './Creditos';
import Refris from './Refris';
import Clientes from './Clientes';
import Produccion from './Produccion';
import { useEffect, useMemo, useRef, useState } from 'react';
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
  const { brands, activeBrand, loading, error, refreshBrands, setActiveBrand } = useBrandContext();
  const [isBrandMenuOpen, setIsBrandMenuOpen] = useState(false);
  const brandMenuRef = useRef<HTMLDivElement | null>(null);
  const logoSrc = `${import.meta.env.BASE_URL}${activeBrand?.logoPath ?? 'brands/helatte-logo.svg'}`;
  const brandName = activeBrand?.nombre ?? 'Helatte';
  const subtitle = activeBrand?.subtitulo ?? 'Nevería & Paletería';
  const isBrandSelectorDisabled = loading && brands.length === 0;

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!brandMenuRef.current?.contains(event.target as Node)) {
        setIsBrandMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsBrandMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleBrandSelection = async (slug: string) => {
    if (loading || slug === activeBrand?.slug) {
      setIsBrandMenuOpen(false);
      return;
    }

    try {
      await setActiveBrand(slug);
      setIsBrandMenuOpen(false);
    } catch (err) {
      console.error('No se pudo actualizar la marca desde el selector.', err);
    }
  };

  return (
    <div className="flex h-screen bg-background text-texto">
      <aside className="w-64 bg-white/70 backdrop-blur border-r border-borderSoft/80 p-4 flex flex-col shadow-[8px_0_30px_rgba(47,49,51,0.05)]">
        <div className="mb-6 space-y-2">
          <div ref={brandMenuRef} className="relative">
            <button
              type="button"
              aria-label="Seleccionar marca activa"
              aria-haspopup="menu"
              aria-expanded={isBrandMenuOpen}
              onClick={() => setIsBrandMenuOpen((current) => !current)}
              disabled={isBrandSelectorDisabled}
              className="flex w-full items-center justify-between rounded-2xl border border-borderSoft/80 bg-white/90 px-3 py-3 text-left shadow-sm transition hover:border-blush/45 hover:bg-blush/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blush/30 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-borderSoft/80 bg-white/80 p-1 shadow-sm">
                  <img src={logoSrc} alt={`Logo de ${brandName}`} className="h-full w-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-lg">{brandName}</p>
                  <p className="truncate text-sm text-text/60">{subtitle}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-blushDeep/80">
                    Click para cambiar de marca
                  </p>
                </div>
              </div>
              <ChevronsUpDown
                size={16}
                className={`shrink-0 text-text/45 transition-transform ${isBrandMenuOpen ? 'rotate-180 text-blushDeep' : ''}`}
              />
            </button>

            {isBrandMenuOpen ? (
              <div
                role="menu"
                aria-label="Marcas disponibles"
                className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-2xl border border-borderSoft/80 bg-white/95 p-2 shadow-[0_18px_40px_rgba(47,49,51,0.16)] backdrop-blur"
              >
                <div className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/45">
                  Selecciona una marca
                </div>
                <div className="space-y-1">
                  {brands.map((brand) => {
                    const isActive = brand.slug === activeBrand?.slug;
                    return (
                      <button
                        key={brand.slug}
                        type="button"
                        role="menuitemradio"
                        aria-checked={isActive}
                        onClick={() => void handleBrandSelection(brand.slug)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition ${isActive ? 'bg-blush/18 text-text shadow-sm' : 'hover:bg-sky/18 text-text/80'} ${loading ? 'cursor-progress' : 'cursor-pointer'}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{brand.nombre}</p>
                          <p className="truncate text-xs text-text/55">{brand.subtitulo ?? 'Marca disponible en Helatte POS'}</p>
                        </div>
                        {isActive ? <Check size={16} className="shrink-0 text-blushDeep" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
          <p className="px-1 text-xs text-text/55">
            {loading
              ? brands.length > 0
                ? 'Actualizando contexto de marca…'
                : 'Cargando marcas disponibles…'
              : 'Cada marca conserva sus propios datos operativos.'}
          </p>
          {error ? (
            <div className="space-y-2 px-1">
              <p className="text-xs text-red-500">{error}</p>
              <button
                type="button"
                onClick={() => void refreshBrands()}
                className="inline-flex items-center rounded-lg border border-borderSoft/80 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text/70 transition hover:border-blush/45 hover:bg-blush/10 hover:text-blushDeep"
              >
                Reintentar carga de marcas
              </button>
            </div>
          ) : null}
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
