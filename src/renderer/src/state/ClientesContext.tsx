import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react';
import type { Customer } from '../../../preload';

const helatte = window.helatte;

const isClienteValido = (value: unknown): value is Customer => {
  if (!value || typeof value !== 'object') return false;
  const posibleCliente = value as Record<string, unknown>;
  return (
    typeof posibleCliente.id === 'number' &&
    typeof posibleCliente.nombre === 'string' &&
    typeof posibleCliente.limite === 'number' &&
    typeof posibleCliente.saldo === 'number' &&
    typeof posibleCliente.estado === 'string'
  );
};

const normalizarRespuestaClientes = (respuesta: unknown): Customer[] | null => {
  if (Array.isArray(respuesta)) return respuesta;
  if (respuesta && typeof respuesta === 'object') {
    const posibleObjeto = respuesta as Record<string, unknown>;
    const candidatos = [posibleObjeto.data, posibleObjeto.clientes];
    const encontrado = candidatos.find(Array.isArray);
    if (encontrado) return encontrado as Customer[];
  }
  return null;
};

export type ClientesContextValue = {
  clientes: Customer[];
  cargando: boolean;
  error: string;
  cargarClientes: () => Promise<Customer[]>;
  limpiarError: () => void;
};

const ClientesContext = createContext<ClientesContextValue | null>(null);

export function ClientesProvider({ children }: PropsWithChildren) {
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const clientesPrevios = useRef<Customer[]>([]);

  const cargarClientes = useCallback(async () => {
    setCargando(true);
    const anteriores = clientesPrevios.current;
    try {
      const respuesta = await helatte.listarClientes();
      console.debug('[Clientes] Respuesta IPC listarClientes', respuesta);
      const data = normalizarRespuestaClientes(respuesta);
      if (!data) {
        throw new Error('Respuesta inválida al listar clientes.');
      }
      const clientesValidados = data.filter(isClienteValido);
      setClientes(clientesValidados);
      clientesPrevios.current = clientesValidados;
      setError('');
      return clientesValidados;
    } catch (err) {
      console.error(err);
      if (anteriores.length === 0) {
        setError('No se pudieron cargar los clientes.');
      }
      return anteriores;
    } finally {
      setCargando(false);
    }
  }, []);

  const limpiarError = useCallback(() => setError(''), []);

  const value = useMemo(
    () => ({ clientes, cargando, error, cargarClientes, limpiarError }),
    [clientes, cargando, error, cargarClientes, limpiarError]
  );

  return <ClientesContext.Provider value={value}>{children}</ClientesContext.Provider>;
}

export function useClientesContext() {
  const ctx = useContext(ClientesContext);
  if (!ctx) throw new Error('useClientesContext debe usarse dentro de ClientesProvider');
  return ctx;
}
