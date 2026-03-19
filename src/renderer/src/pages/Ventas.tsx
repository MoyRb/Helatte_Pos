import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, Minus, Plus, CheckCircle2, AlertTriangle, Printer } from 'lucide-react';
import type {
  Customer,
  Flavor,
  PosDiscountType,
  PosSaleReceipt,
  PosSaleSummary,
  PosSaleType,
  Product
} from '../../../preload';

const currency = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN'
});

const saleTypeLabels: Record<PosSaleType, string> = {
  MOSTRADOR: 'Mostrador',
  MAYOREO: 'Mayoreo'
};

const formatMoney = (value: number) => currency.format(value);

const getProductSalePrice = (product: Product, saleType: PosSaleType) => {
  if (saleType === 'MAYOREO') return product.precioMayoreo ?? product.precio;
  return product.precio;
};

const calculateDiscount = (subtotal: number, type: PosDiscountType, rawValue: string) => {
  const value = Number(rawValue || 0);
  if (!Number.isFinite(value) || value < 0) {
    return { value: 0, error: 'El descuento debe ser un número igual o mayor a cero.' };
  }

  if (type === 'ninguno') return { value: 0, error: '' };

  if (type === 'porcentaje') {
    if (value > 100) {
      return { value: 0, error: 'El descuento porcentual no puede ser mayor a 100%.' };
    }
    return { value: Number(((subtotal * value) / 100).toFixed(2)), error: '' };
  }

  if (value > subtotal) {
    return { value: 0, error: 'El descuento fijo no puede ser mayor al subtotal.' };
  }

  return { value: Number(value.toFixed(2)), error: '' };
};

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
  const [tipoVenta, setTipoVenta] = useState<PosSaleType>('MOSTRADOR');
  const [descuentoTipo, setDescuentoTipo] = useState<PosDiscountType>('ninguno');
  const [descuentoValor, setDescuentoValor] = useState('0');
  const [ultimaVenta, setUltimaVenta] = useState<PosSaleReceipt | null>(null);
  const [ventasRecientes, setVentasRecientes] = useState<PosSaleSummary[]>([]);
  const [imprimiendoSaleId, setImprimiendoSaleId] = useState<number | null>(null);
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

  const cargarVentasRecientes = async () => {
    const data = await window.helatte.listarVentasPOS(8);
    setVentasRecientes(data);
  };

  useEffect(() => {
    cargarCatalogo();
    cargarClientes();
    void cargarVentasRecientes();
  }, []);

  useEffect(() => {
    setMensaje('');
    setError('');
    if (tipoVenta === 'MOSTRADOR') return;

    const clienteSeleccionado = clientes.find((cliente) => cliente.id === Number(clienteId));
    if (clienteSeleccionado && clienteSeleccionado.permiteMayoreo && clienteSeleccionado.estado === 'activo') return;
    setClienteId('');
  }, [tipoVenta, clienteId, clientes]);

  const clientesActivos = useMemo(() => clientes.filter((cliente) => cliente.estado === 'activo'), [clientes]);
  const clientesMayoreo = useMemo(
    () => clientesActivos.filter((cliente) => cliente.permiteMayoreo),
    [clientesActivos]
  );

  const carritoDetallado = useMemo(
    () =>
      carrito
        .map((item) => {
          const prod = productos.find((p) => p.id === item.id);
          if (!prod) return null;
          const precioUnitario = getProductSalePrice(prod, tipoVenta);
          return {
            item,
            producto: prod,
            precioUnitario,
            subtotalLinea: precioUnitario * item.qty
          };
        })
        .filter((value): value is NonNullable<typeof value> => value !== null),
    [carrito, productos, tipoVenta]
  );

  const subtotal = useMemo(
    () => Number(carritoDetallado.reduce((sum, row) => sum + row.subtotalLinea, 0).toFixed(2)),
    [carritoDetallado]
  );

  const discountPreview = useMemo(
    () => calculateDiscount(subtotal, descuentoTipo, descuentoValor),
    [subtotal, descuentoTipo, descuentoValor]
  );

  const total = useMemo(
    () => Number(Math.max(subtotal - discountPreview.value, 0).toFixed(2)),
    [subtotal, discountPreview.value]
  );

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

  const imprimirRemision = async (saleId: number) => {
    setError('');
    setImprimiendoSaleId(saleId);
    try {
      await window.helatte.imprimirRemisionVenta(saleId);
    } catch (caughtError) {
      const printError =
        caughtError instanceof Error
          ? caughtError
          : new Error('No se pudo abrir la ventana de impresión.');
      setError(printError.message);
      throw printError;
    } finally {
      setImprimiendoSaleId((current) => (current === saleId ? null : current));
    }
  };

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

      if (tipoVenta === 'MAYOREO' && !clienteId) {
        setError('Selecciona un cliente registrado para ventas de mayoreo.');
        return;
      }

      if (discountPreview.error) {
        setError(discountPreview.error);
        return;
      }

      const resultado = await window.helatte.ventaPOS({
        items: carrito.map((item) => ({ productId: item.id, cantidad: item.qty })),
        tipoVenta,
        customerId: clienteId ? Number(clienteId) : undefined,
        descuentoTipo,
        descuentoValor: descuentoTipo === 'ninguno' ? 0 : Number(descuentoValor || 0)
      });

      setUltimaVenta(resultado);
      setCarrito([]);
      setClienteId('');
      setDescuentoTipo('ninguno');
      setDescuentoValor('0');
      await Promise.all([cargarCatalogo(), cargarVentasRecientes()]);
      try {
        await imprimirRemision(resultado.saleId);
        setMensaje(
          resultado.tipoVenta === 'MAYOREO'
            ? `Venta mayoreo ${resultado.folio} registrada correctamente y la remisión se abrió para impresión.`
            : `Venta ${resultado.folio} registrada correctamente y la remisión se abrió para impresión.`
        );
      } catch {
        setMensaje(`Venta ${resultado.folio} registrada correctamente.`);
        setError('La venta se guardó, pero no se pudo abrir la impresión automáticamente.');
      }
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo guardar la venta');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      <div className="lg:col-span-2 card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">POS rápido</h2>
            <p className="text-sm text-text/65">Mostrador sin fricción y mayoreo con cliente, descuento e impresión.</p>
          </div>
          <input placeholder="Buscar" className="input max-w-xs" disabled />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-borderSoft/80 bg-sky/12 p-3 space-y-2">
            <p className="text-sm font-medium text-text/75">Tipo de venta</p>
            <div className="grid grid-cols-2 gap-2">
              {(['MOSTRADOR', 'MAYOREO'] as PosSaleType[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setTipoVenta(option)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    tipoVenta === option
                      ? 'border-blush/50 bg-blush/26 text-text shadow-sm'
                      : 'border-borderSoft/80 bg-white/85 text-text/75 hover:bg-sky/16'
                  }`}
                >
                  {saleTypeLabels[option]}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-borderSoft/80 bg-sky/12 p-3 space-y-1">
            <p className="text-sm font-medium text-text/75">Reglas activas</p>
            <p className="text-sm text-text/65">
              {tipoVenta === 'MOSTRADOR'
                ? 'Se conserva el flujo rápido actual y el precio normal.'
                : 'Cliente obligatorio, precio mayoreo por producto y opción de remisión.'}
            </p>
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-text/55">Cargando productos...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {productos.map((p) => {
              const precioActivo = getProductSalePrice(p, tipoVenta);
              const usandoPrecioMayoreo = tipoVenta === 'MAYOREO' && p.precioMayoreo !== null && p.precioMayoreo !== undefined;
              return (
                <button
                  key={p.id}
                  onClick={() => agregar(p.id)}
                  type="button"
                  className={`rounded-xl border border-primary/60 bg-white/80 hover:-translate-y-0.5 transition shadow-sm p-3 text-left ${
                    p.stock <= 0 ? 'opacity-50' : ''
                  }`}
                >
                  <p className="font-semibold">{p.sabor?.nombre ?? p.presentacion}</p>
                  <p className="text-xs text-text/65 capitalize">{p.tipo.nombre}</p>
                  <p className="text-sm font-medium">{formatMoney(precioActivo)}</p>
                  <p className="text-[11px] text-text/55">
                    {usandoPrecioMayoreo ? 'Precio mayoreo aplicado' : tipoVenta === 'MAYOREO' ? 'Usando precio normal como fallback' : 'Precio mostrador'}
                  </p>
                  <p className="text-xs text-text/55">Stock: {p.stock}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart size={18} />
          <h3 className="font-semibold">Carrito</h3>
        </div>

        <div className="space-y-3 mb-3">
          <div className="space-y-2">
            <label className="text-sm text-text/75">
              Cliente {tipoVenta === 'MAYOREO' ? '(obligatorio)' : '(opcional)'}
            </label>
            <select
              className="input"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              disabled={cargandoClientes}
            >
              <option value="">{tipoVenta === 'MAYOREO' ? 'Selecciona cliente mayoreo' : 'Venta de contado'}</option>
              {(tipoVenta === 'MAYOREO' ? clientesMayoreo : clientesActivos).map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                  {cliente.saldo > 0 ? ` (Saldo: ${formatMoney(cliente.saldo)})` : ''}
                </option>
              ))}
            </select>
            {tipoVenta === 'MAYOREO' && clientesMayoreo.length === 0 && !cargandoClientes && (
              <p className="text-xs text-butterDeep">No hay clientes activos habilitados para mayoreo.</p>
            )}
          </div>

          <div className="rounded-xl border border-borderSoft/80 bg-sky/12 p-3 space-y-2">
            <p className="text-sm font-medium text-text/75">Descuento general</p>
            <div className="grid grid-cols-1 gap-2">
              <select
                className="input"
                value={descuentoTipo}
                onChange={(e) => {
                  const value = e.target.value as PosDiscountType;
                  setDescuentoTipo(value);
                  if (value === 'ninguno') setDescuentoValor('0');
                }}
              >
                <option value="ninguno">Sin descuento</option>
                <option value="porcentaje">Descuento porcentual</option>
                <option value="monto">Descuento fijo</option>
              </select>
              {descuentoTipo !== 'ninguno' && (
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={descuentoTipo === 'porcentaje' ? 100 : undefined}
                  value={descuentoValor}
                  onChange={(e) => setDescuentoValor(e.target.value)}
                  placeholder={descuentoTipo === 'porcentaje' ? 'Ej. 10' : 'Ej. 150'}
                />
              )}
              {discountPreview.error && <p className="text-xs text-blushDeep">{discountPreview.error}</p>}
            </div>
          </div>
        </div>

        <div className="space-y-2 flex-1 overflow-auto">
          {carrito.length === 0 && <p className="text-sm text-text/55">Agrega productos al carrito.</p>}
          {carritoDetallado.map(({ item, producto, precioUnitario, subtotalLinea }) => {
            const sabor = sabores.find((s) => s.id === producto.sabor.id)?.nombre ?? producto.sabor.nombre;
            return (
              <div key={item.id} className="bg-sky/18 rounded-lg px-3 py-2 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{sabor}</p>
                    <p className="text-xs text-text/65 capitalize">{producto.tipo.nombre}</p>
                    <p className="text-xs text-text/55">Unitario: {formatMoney(precioUnitario)}</p>
                  </div>
                  <p className="text-right font-semibold">{formatMoney(subtotalLinea)}</p>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button className="p-1" onClick={() => cambiar(item.id, -1)} type="button">
                    <Minus size={16} />
                  </button>
                  <span>{item.qty}</span>
                  <button className="p-1" onClick={() => cambiar(item.id, 1)} type="button">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-mintDeep" hidden={!mensaje}>
            <CheckCircle2 size={16} />
            <span>{mensaje}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-blushDeep" hidden={!error}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>

          <div className="rounded-xl bg-sky/12 p-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-text/65">Subtotal</span>
              <span className="font-medium">{formatMoney(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text/65">Descuento</span>
              <span className="font-medium">- {formatMoney(discountPreview.value)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-borderSoft/80 pt-2">
              <span className="text-text/75 font-medium">Total final</span>
              <span className="text-2xl font-semibold">{formatMoney(total)}</span>
            </div>
          </div>

          <button
            className="btn btn-primary mt-3 w-full py-2.5"
            onClick={cobrar}
            disabled={!carrito.length || guardando}
            type="button"
          >
            {guardando ? 'Guardando...' : 'Cobrar / Guardar venta'}
          </button>

          {ultimaVenta && (
            <button
              className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
              onClick={() => imprimirRemision(ultimaVenta.saleId)}
              disabled={imprimiendoSaleId === ultimaVenta.saleId}
              type="button"
            >
              <Printer size={16} />
              {imprimiendoSaleId === ultimaVenta.saleId ? 'Abriendo impresión...' : 'Reimprimir última remisión'}
            </button>
          )}

          <div className="border-t border-borderSoft/80 pt-3 mt-3 space-y-3">
            <div>
              <h4 className="font-semibold">Ventas recientes</h4>
              <p className="text-xs text-text/60">Reimpresión rápida desde POS.</p>
            </div>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {ventasRecientes.length === 0 && <p className="text-sm text-text/55">Sin ventas recientes.</p>}
              {ventasRecientes.map((venta) => (
                <div
                  key={venta.saleId}
                  className="rounded-xl border border-borderSoft/80 bg-sky/12 px-3 py-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{venta.folio}</p>
                      <p className="text-xs text-text/65">{new Date(venta.fecha).toLocaleString('es-MX')}</p>
                      <p className="text-xs text-text/55">
                        {saleTypeLabels[venta.tipoVenta]} · {venta.customerName ?? 'Público en general'} · {venta.pagoMetodo}
                      </p>
                    </div>
                    <p className="font-semibold">{formatMoney(venta.total)}</p>
                  </div>
                  <button
                    className="btn btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
                    onClick={() => imprimirRemision(venta.saleId)}
                    disabled={imprimiendoSaleId === venta.saleId}
                    type="button"
                  >
                    <Printer size={16} />
                    {imprimiendoSaleId === venta.saleId ? 'Abriendo impresión...' : 'Imprimir / reimprimir'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
