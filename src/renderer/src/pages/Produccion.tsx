import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ClipboardList, Plus, Printer, RefreshCcw, Save } from 'lucide-react';
import type { Product } from '../../../preload';
import type { ProductionPlanItem, ProductionPlanResponse } from '../../../preload';
import { buildProductLabel, buildProductMeta } from '../utils/productLabels';

type EditableProductionItem = ProductionPlanItem & {
  localId: string;
};

const todayInput = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `prod-${Date.now()}-${Math.random()}`;

const formatMoney = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);

const toEditableItems = (items: ProductionPlanItem[]): EditableProductionItem[] =>
  items.map((item, index) => ({
    ...item,
    localId: `${item.id ?? 'draft'}-${item.productId ?? 'manual'}-${index}-${createLocalId()}`
  }));

const buildManualRow = (): EditableProductionItem => ({
  localId: createLocalId(),
  productId: null,
  nombre: '',
  presentacion: '',
  cantidadBase: 0,
  cantidadAjuste: 0,
  cantidadFinal: 0,
  orden: 0,
  esManual: true
});

export default function Produccion() {
  const [fecha, setFecha] = useState(todayInput());
  const [items, setItems] = useState<EditableProductionItem[]>([]);
  const [productosCatalogo, setProductosCatalogo] = useState<Product[]>([]);
  const [notas, setNotas] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [planGuardado, setPlanGuardado] = useState(false);
  const [metadata, setMetadata] = useState<Pick<ProductionPlanResponse, 'basedOnWholesaleSales' | 'wholesaleSalesCount' | 'wholesaleSources'>>({
    basedOnWholesaleSales: false,
    wholesaleSalesCount: 0,
    wholesaleSources: []
  });

  const hydrate = (response: ProductionPlanResponse) => {
    setItems(toEditableItems(response.draft.items));
    setNotas(response.draft.notas);
    setPlanGuardado(Boolean(response.plan));
    setMetadata({
      basedOnWholesaleSales: response.basedOnWholesaleSales,
      wholesaleSalesCount: response.wholesaleSalesCount,
      wholesaleSources: response.wholesaleSources
    });
  };

  const cargarPlan = async (targetDate = fecha) => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const response = await window.helatte.obtenerPlanProduccion(targetDate);
      setFecha(response.draft.fecha);
      hydrate(response);
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo abrir el plan de producción.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarPlan(todayInput());
    void (async () => {
      try {
        const catalogo = await window.helatte.listarCatalogo();
        setProductosCatalogo(catalogo.productos ?? []);
      } catch (caughtError) {
        console.error(caughtError);
      }
    })();
  }, []);

  const reconsolidar = async () => {
    setCargando(true);
    setError('');
    setMensaje('');
    try {
      const response = await window.helatte.reconsolidarPlanProduccion(fecha);
      hydrate(response);
      setMensaje(
        response.basedOnWholesaleSales
          ? 'Se reconstruyó el borrador con base en las ventas mayoreo del día.'
          : 'No hubo ventas mayoreo para la fecha; se dejó un borrador manual listo para capturar.'
      );
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo reconsolidar la producción.');
    } finally {
      setCargando(false);
    }
  };

  const updateItem = (localId: string, patch: Partial<EditableProductionItem>) => {
    setItems((current) =>
      current.map((item) => {
        if (item.localId !== localId) return item;
        const next = { ...item, ...patch };
        const cantidadFinal = Math.max(0, Math.round(Number(next.cantidadFinal ?? 0)));
        return {
          ...next,
          cantidadFinal,
          cantidadAjuste: cantidadFinal - Number(next.cantidadBase || 0)
        };
      })
    );
  };

  const selectProduct = (localId: string, productIdRaw: string) => {
    const productId = Number(productIdRaw);
    const product = productosCatalogo.find((candidate) => candidate.id === productId);
    if (!product) {
      updateItem(localId, {
        productId: null,
        nombre: '',
        presentacion: '',
        esManual: true
      });
      return;
    }

    updateItem(localId, {
      productId: product.id,
      nombre: buildProductLabel(product),
      presentacion: product.presentacion,
      esManual: false
    });
  };

  const addManualRow = () => {
    setItems((current) => [...current, { ...buildManualRow(), orden: current.length }]);
  };

  const removeRow = (localId: string) => {
    setItems((current) => current.filter((item) => item.localId !== localId).map((item, index) => ({ ...item, orden: index })));
  };

  const payloadItems = useMemo(
    () =>
      items.map((item, index) => ({
        id: item.id,
        productId: item.productId ?? null,
        nombre: item.nombre.trim(),
        presentacion: item.presentacion.trim(),
        cantidadBase: Number(item.cantidadBase || 0),
        cantidadAjuste: Number(item.cantidadFinal || 0) - Number(item.cantidadBase || 0),
        cantidadFinal: Math.max(0, Number(item.cantidadFinal || 0)),
        orden: index,
        esManual: item.esManual
      })),
    [items]
  );

  const productosPorId = useMemo(
    () => new Map(productosCatalogo.map((producto) => [producto.id, producto])),
    [productosCatalogo]
  );

  const guardar = async () => {
    if (guardando) return;
    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      const saved = await window.helatte.guardarPlanProduccion({
        fecha,
        notas,
        items: payloadItems
      });
      setItems(toEditableItems(saved.items));
      setNotas(saved.notas);
      setPlanGuardado(true);
      setMensaje('Plan de producción guardado correctamente.');
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo guardar el plan de producción.');
    } finally {
      setGuardando(false);
    }
  };

  const imprimir = async () => {
    if (imprimiendo) return;
    setImprimiendo(true);
    setError('');
    setMensaje('');
    try {
      await window.helatte.imprimirPlanProduccion(fecha);
      setMensaje('Se abrió la hoja de producción para impresión.');
    } catch (caughtError) {
      console.error(caughtError);
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo abrir la impresión del plan.');
    } finally {
      setImprimiendo(false);
    }
  };

  const totalPlaneado = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, Number(item.cantidadFinal || 0)), 0),
    [items]
  );

  const totalBase = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, Number(item.cantidadBase || 0)), 0),
    [items]
  );

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky/40 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-text/70">
              <ClipboardList size={14} /> Producción
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Plan de producción</h2>
            <p className="mt-1 text-sm text-text/65">
              Consolida ventas mayoreo confirmadas del día, permite ajustes manuales y genera una hoja lista para imprimir.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[180px_auto] sm:items-end">
            <label className="space-y-1 text-sm font-medium text-text/75">
              <span className="inline-flex items-center gap-2"><CalendarDays size={16} /> Fecha</span>
              <input className="input" type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={() => void cargarPlan(fecha)} disabled={cargando}>
                <RefreshCcw size={16} /> {cargando ? 'Cargando...' : 'Abrir plan'}
              </button>
              <button className="btn" onClick={() => void reconsolidar()} disabled={cargando}>
                <RefreshCcw size={16} /> Reconsolidar
              </button>
              <button className="btn btn-primary" onClick={() => void guardar()} disabled={guardando || cargando}>
                <Save size={16} /> {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="btn btn-secondary" onClick={() => void imprimir()} disabled={!planGuardado || imprimiendo || guardando}>
                <Printer size={16} /> {imprimiendo ? 'Abriendo...' : 'Imprimir'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {(mensaje || error) && (
        <div className={`card p-3 text-sm ${error ? 'bg-blush/12 text-blushDeep' : 'bg-mint/20 text-text'}`}>
          {error || mensaje}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <article className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Renglones a producir</h3>
              <p className="text-sm text-text/60">
                {metadata.basedOnWholesaleSales
                  ? `Base calculada desde ${metadata.wholesaleSalesCount} venta(s) mayoreo para ${fecha}.`
                  : 'Sin ventas mayoreo para la fecha; agrega productos terminados del catálogo.'}
              </p>
            </div>
            <button className="btn" onClick={addManualRow}>
              <Plus size={16} /> Agregar producto terminado
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="table min-w-[780px]">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Presentación</th>
                  <th className="text-center">Base</th>
                  <th className="text-center">Ajuste</th>
                  <th className="text-center">Total</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-text/55">
                      No hay renglones todavía. Usa “Agregar producto terminado” o “Reconsolidar”.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const ajuste = Number(item.cantidadFinal || 0) - Number(item.cantidadBase || 0);
                    const selectedProduct = item.productId ? productosPorId.get(item.productId) : null;
                    return (
                      <tr key={item.localId}>
                        <td>
                          <div className="space-y-2">
                            <select
                              className="input min-w-[280px]"
                              value={item.productId ?? ''}
                              onChange={(event) => selectProduct(item.localId, event.target.value)}
                            >
                              <option value="">Selecciona producto terminado</option>
                              {productosCatalogo.map((producto) => (
                                <option key={producto.id} value={producto.id}>
                                  {buildProductLabel(producto)}
                                </option>
                              ))}
                            </select>
                            {selectedProduct ? (
                              <div>
                                <p className="font-medium text-text">{buildProductLabel(selectedProduct)}</p>
                                <p className="text-xs text-text/55">
                                  {item.cantidadBase > 0 ? 'Consolidado desde ventas mayoreo' : 'Producto ligado al catálogo e inventario'}
                                  {buildProductMeta(selectedProduct) ? ` · ${buildProductMeta(selectedProduct)}` : ''}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-blushDeep">Selecciona un producto del catálogo para conservar la fuente única de verdad.</p>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="text-sm text-text/75">{selectedProduct?.presentacion ?? item.presentacion ?? '—'}</span>
                        </td>
                        <td className="text-center align-middle font-medium">{item.cantidadBase}</td>
                        <td className="text-center align-middle">
                          <span className={`inline-flex min-w-14 justify-center rounded-full px-2 py-1 text-xs font-semibold ${ajuste > 0 ? 'bg-mint/30 text-text' : ajuste < 0 ? 'bg-butter/40 text-text' : 'bg-sky/15 text-text/65'}`}>
                            {ajuste > 0 ? `+${ajuste}` : ajuste}
                          </span>
                        </td>
                        <td className="text-center align-middle">
                          <input
                            className="input mx-auto w-24 text-center"
                            type="number"
                            min="0"
                            value={item.cantidadFinal}
                            onChange={(event) => updateItem(item.localId, { cantidadFinal: Number(event.target.value || 0) })}
                          />
                        </td>
                        <td className="text-right align-middle">
                          <button className="btn btn-ghost" onClick={() => removeRow(item.localId)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </article>

        <aside className="space-y-4">
          <section className="card p-5 space-y-3">
            <h3 className="text-lg font-semibold">Resumen del día</h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-borderSoft/80 bg-ivory/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/50">Cantidad base</p>
                <p className="mt-2 text-2xl font-semibold">{totalBase}</p>
              </div>
              <div className="rounded-2xl border border-borderSoft/80 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/50">Cantidad final</p>
                <p className="mt-2 text-2xl font-semibold">{totalPlaneado}</p>
              </div>
              <div className="rounded-2xl border border-borderSoft/80 bg-sky/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-text/50">Base de consolidación</p>
                <p className="mt-2 text-sm font-medium text-text/75">
                  {metadata.basedOnWholesaleSales
                    ? `${metadata.wholesaleSalesCount} venta(s) mayoreo confirmadas.`
                    : 'Sin ventas mayoreo; plan manual.'}
                </p>
              </div>
            </div>
          </section>

          <section className="card p-5 space-y-3">
            <div>
              <h3 className="text-lg font-semibold">Notas</h3>
              <p className="text-sm text-text/60">Se imprimen al pie de la hoja de producción.</p>
            </div>
            <textarea
              className="input min-h-[150px] resize-y"
              placeholder="Indicaciones de producción, prioridades, observaciones o lotes especiales..."
              value={notas}
              onChange={(event) => setNotas(event.target.value)}
            />
          </section>

          <section className="card p-5 space-y-3">
            <div>
              <h3 className="text-lg font-semibold">Ventas mayoreo incluidas</h3>
              <p className="text-sm text-text/60">Base utilizada para consolidar automáticamente esta versión.</p>
            </div>
            <div className="space-y-2">
              {metadata.wholesaleSources.length === 0 ? (
                <p className="text-sm text-text/55">No se encontraron ventas mayoreo para la fecha seleccionada.</p>
              ) : (
                metadata.wholesaleSources.map((sale) => (
                  <div key={sale.saleId} className="rounded-2xl border border-borderSoft/80 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-text">{sale.folio}</span>
                      <span className="text-text/60">{formatMoney(sale.total)}</span>
                    </div>
                    <p className="mt-1 text-text/60">{sale.customerName ?? 'Cliente sin nombre'}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
