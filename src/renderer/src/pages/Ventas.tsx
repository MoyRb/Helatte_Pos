import { useEffect, useState } from 'react';
import { ShoppingCart, Minus, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Customer, Flavor, Product } from '../../../preload';

export default function Ventas() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [sabores, setSabores] = useState<Flavor[]>([]);
  const [carrito, setCarrito] = useState<{ id: number; qty: number }[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [clienteId, setClienteId] = useState('');
  const stockDisponible = (prod: Product) => (Number.isFinite(prod.stock) ? prod.stock : Number.MAX_SAFE_INTEGER);

  const cargarCatalogo = async () => {
    setCargando(true);
    try {
      const data = await window.helatte.listarCatalogo();
      setProductos(data.productos);
      setSabores(data.sabores);
    } finally {
      setCargando(false);
    }
  };

  const cargarClientes = async () => {
    setCargandoClientes(true);
    try {
      const data = await window.helatte.listarClientes();
      setClientes(data);
    } finally {
      setCargandoClientes(false);
    }
  };

  useEffect(() => {
    cargarCatalogo();
    cargarClientes();
  }, []);

  const agregar = (id: number) => {
    const prod = productos.find((p) => p.id === id);
    if (!prod) return;
    setMensaje('');
    setError('');
    setCarrito((prev) => {
      const existe = prev.find((p) => p.id === id);
      const nuevaCantidad = (existe?.qty ?? 0) + 1;
      if (nuevaCantidad > stockDisponible(prod)) {
        setError(`Stock insuficiente para ${prod.sabor?.nombre ?? prod.presentacion}`);
        return prev;
      }
      if (existe) return prev.map((p) => (p.id === id ? { ...p, qty: nuevaCantidad } : p));
      return [...prev, { id, qty: 1 }];
    });
  };

  const cambiar = (id: number, delta: number) => {
    const prod = productos.find((p) => p.id === id);
    if (!prod) return;
    setError('');
    setCarrito((prev) =>
      prev
        .map((p) => {
          if (p.id !== id) return p;
          const nuevaCantidad = Math.max(0, p.qty + delta);
          if (nuevaCantidad > stockDisponible(prod)) {
            setError(`Stock insuficiente para ${prod.sabor?.nombre ?? prod.presentacion}`);
            return p;
          }
          return { ...p, qty: nuevaCantidad };
        })
        .filter((p) => p.qty > 0)
    );
  };

  const total = carrito.reduce((sum, item) => {
    const prod = productos.find((p) => p.id === item.id);
    return sum + (prod?.precio ?? 0) * item.qty;
  }, 0);

  const cobrar = async () => {
    if (!carrito.length || guardando) return;
    setError('');
    setGuardando(true);
    setMensaje('');
    try {
      const faltante = carrito.find((item) => {
        const prod = productos.find((p) => p.id === item.id);
        return !prod || item.qty > stockDisponible(prod);
      });
      if (faltante) {
        setError('No puedes vender más de lo disponible en stock.');
        return;
      }

      await window.helatte.ventaPOS({
        items: carrito.map((item) => ({ productId: item.id, cantidad: item.qty })),
        customerId: clienteId ? Number(clienteId) : undefined
      });
      setCarrito([]);
      setMensaje('Venta registrada correctamente.');
      setClienteId('');
      cargarCatalogo();
    } catch (error) {
      console.error(error);
      setError('No se pudo guardar la venta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-2 card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">POS rápido</h2>
          <input placeholder="Buscar" className="border rounded-lg px-3 py-2 text-sm" disabled />
        </div>
        {cargando ? (
          <p className="text-sm text-gray-500">Cargando productos...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {productos.map((p) => (
              <button
                key={p.id}
                onClick={() => agregar(p.id)}
                type="button"
                className={`rounded-xl border border-primary/60 bg-white/80 hover:-translate-y-0.5 transition shadow-sm p-3 text-left ${
                  p.stock <= 0 ? 'opacity-50' : ''
                }`}
              >
                <p className="font-semibold">{p.sabor?.nombre ?? p.presentacion}</p>
                <p className="text-xs text-gray-600 capitalize">{p.tipo.nombre}</p>
                <p className="text-sm">${p.precio.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Stock: {p.stock}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="card p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart size={18} />
          <h3 className="font-semibold">Carrito</h3>
        </div>
        <div className="space-y-2 mb-3">
          <label className="text-sm text-gray-700">Cliente (opcional)</label>
          <select
            className="input"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            disabled={cargandoClientes}
          >
            <option value="">Venta de contado</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nombre} {cliente.saldo > 0 ? `(Saldo: $${cliente.saldo.toFixed(2)})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 flex-1 overflow-auto">
          {carrito.length === 0 && <p className="text-sm text-gray-500">Agrega productos al carrito.</p>}
          {carrito.map((item) => {
            const prod = productos.find((p) => p.id === item.id);
            if (!prod) return null;
            const sabor = sabores.find((s) => s.id === prod.sabor.id)?.nombre ?? prod.sabor.nombre;
            return (
              <div key={item.id} className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2">
                <div>
                  <p className="font-semibold">{sabor}</p>
                  <p className="text-xs text-gray-600 capitalize">{prod.tipo.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-1" onClick={() => cambiar(item.id, -1)} type="button">
                    <Minus size={16} />
                  </button>
                  <span>{item.qty}</span>
                  <button className="p-1" onClick={() => cambiar(item.id, 1)} type="button">
                    <Plus size={16} />
                  </button>
                  <p className="w-16 text-right font-semibold">${(prod.precio * item.qty).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pt-3 border-t mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-green-700" hidden={!mensaje}>
            <CheckCircle2 size={16} />
            <span>{mensaje}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-red-700" hidden={!error}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <p className="text-sm text-gray-600">Total</p>
          <p className="text-2xl font-semibold">${total.toFixed(2)}</p>
          <button
            className="mt-3 w-full bg-primary text-black font-semibold py-2 rounded-lg hover:opacity-90"
            onClick={cobrar}
            disabled={!carrito.length || guardando}
            type="button"
          >
            Cobrar / Guardar venta
          </button>
        </div>
      </div>
    </div>
  );
}
