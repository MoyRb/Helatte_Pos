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

export function BrandProvider({ children }: PropsWithChildren) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [activeBrand, setActiveBrandState] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshBrands = useCallback(async () => {
    setLoading(true);
    try {
      const [marcas, activa] = await Promise.all([
        helatte.listarMarcas(),
        helatte.obtenerMarcaActiva()
      ]);
      setBrands(marcas);
      setActiveBrandState(activa);
      setError('');
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las marcas.');
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveBrand = useCallback(async (slug: string) => {
    setLoading(true);
    try {
      const activa = await helatte.seleccionarMarca(slug);
      const marcas = await helatte.listarMarcas();
      setActiveBrandState(activa);
      setBrands(marcas);
      setError('');
    } catch (err) {
      console.error(err);
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
