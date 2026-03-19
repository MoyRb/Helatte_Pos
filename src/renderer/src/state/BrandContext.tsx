import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from 'react';
import type { Brand } from '../../../preload';

const helatte = window.helatte;

type BrandContextValue = {
  brands: Brand[];
  activeBrand: Brand | null;
  loading: boolean;
  error: string;
  refreshBrands: () => Promise<void>;
  setActiveBrand: (slug: string) => Promise<void>;
};

const BrandContext = createContext<BrandContextValue | null>(null);

const buildBrandErrorMessage = (message: string) => {
  const trimmed = message.trim();
  return trimmed ? `${trimmed} Revisa la conexión IPC de marcas.` : 'No se pudieron cargar las marcas.';
};

export function BrandProvider({ children }: PropsWithChildren) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshBrands = useCallback(async () => {
    setLoading(true);

    try {
      const brandResults = await Promise.allSettled([
        helatte.listarMarcas(),
        helatte.obtenerMarcaActiva()
      ]);

      const listedBrands = brandResults[0].status === 'fulfilled' ? brandResults[0].value : [];
      const resolvedActiveBrand =
        brandResults[1].status === 'fulfilled'
          ? brandResults[1].value
          : listedBrands.find((brand) => brand.isActive) ?? listedBrands[0] ?? null;

      setBrands(listedBrands);
      setActiveBrandState(resolvedActiveBrand);

      const errors = brandResults
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => (result.reason instanceof Error ? result.reason.message : String(result.reason)));

      if (errors.length > 0) {
        console.error('[BrandContext] Error cargando marcas', errors);
        setError(buildBrandErrorMessage(errors.join(' | ')));
      } else if (listedBrands.length === 0) {
        console.warn('[BrandContext] No se encontraron marcas disponibles en desktop.');
        setError('No hay marcas disponibles para seleccionar.');
      } else {
        console.info('[BrandContext] Marcas cargadas correctamente', {
          total: listedBrands.length,
          active: resolvedActiveBrand?.slug ?? null
        });
        setError('');
      }
    } catch (err) {
      console.error('[BrandContext] Falla inesperada al cargar marcas', err);
      setBrands([]);
      setActiveBrandState(null);
      setError('No se pudieron cargar las marcas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveBrand = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const normalizedSlug = slug.trim();
      const activa = await helatte.seleccionarMarca(normalizedSlug);
      const marcas = await helatte.listarMarcas();
      const nextActiveBrand = marcas.find((brand) => brand.slug === activa.slug) ?? activa;

      console.info('[BrandContext] Marca activa actualizada', {
        requested: normalizedSlug,
        active: nextActiveBrand.slug,
        total: marcas.length
      });

      setActiveBrandState(nextActiveBrand);
      setBrands(marcas);
      setError('');
    } catch (err) {
      console.error('[BrandContext] No se pudo cambiar la marca activa', err);
      setError('No se pudo cambiar la marca activa.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshBrands();
  }, [refreshBrands]);

  const value = useMemo(
    () => ({ brands, activeBrand, loading, error, refreshBrands, setActiveBrand }),
    [brands, activeBrand, loading, error, refreshBrands, setActiveBrand]
  );

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrandContext() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrandContext debe usarse dentro de BrandProvider');
  }
  return context;
}
