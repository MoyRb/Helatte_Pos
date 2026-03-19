import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FinishedStockMovement, Product, RawMaterial, Unit } from '../../../preload';
import { buildProductLabel, buildProductMeta } from '../utils/productLabels';

type ProductoConMov = Product & { stockMoves?: FinishedStockMovement[] };

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title: string;
};

function Modal({ open, onClose, children, title }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-text/24 flex items-center justify-center z-20">
      <div className="modal-panel w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-text/55 hover:text-text" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Inventario() {
  const [materias, setMaterias] = useState<RawMaterial[]>([]);
  const [productos, setProductos] = useState<ProductoConMov[]>([]);
  const [unidades, setUnidades] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [vistaActiva, setVistaActiva] = useState<'materias' | 'terminados'>('terminados');

  const [modalMaterial, setModalMaterial] = useState(false);
  const [nuevoMaterial, setNuevoMaterial] = useState<{
    nombre: string;
    unidadId: number | '';
    stock: number;
    costoProm: number;
  }>({
    nombre: '',
    unidadId: '',
    stock: 0,
    costoProm: 0
  });

  const [modalMovMaterial, setModalMovMaterial] = useState(false);
  const [movMaterial, setMovMaterial] = useState<{
    materialId: number | null;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    costoTotal: number;
  }>({
    materialId: null,
    tipo: 'entrada',
    cantidad: 0,
    costoTotal: 0
  });

  const [modalMovProducto, setModalMovProducto] = useState(false);
  const [movProducto, setMovProducto] = useState<{
    productId: number | null;
    tipo: 'entrada' | 'salida';
    cantidad: number;
    referencia: string;
  }>({
    productId: null,
    tipo: 'entrada',
    cantidad: 0,
    referencia: ''
  });

  const selectedMaterial = useMemo(
    () => materias.find((m) => m.id === movMaterial.materialId),
    [materias, movMaterial.materialId]
  );

  const selectedProducto = useMemo(
    () => productos.find((p) => p.id === movProducto.productId),
    [productos, movProducto.productId]
  );

  const cargarInventarios = async () => {
    try {
      setLoading(true);
      const [materiasResp, productosResp] = await Promise.all([
        window.helatte.listarMaterias(),
        window.helatte.listarProductosStock()
      ]);

      setMaterias(materiasResp.materias ?? []);
      setUnidades(materiasResp.unidades ?? []);
      setProductos(productosResp ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar inventario');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarInventarios();
  }, []);

  const crearMaterial = async () => {
    if (!nuevoMaterial.nombre || !nuevoMaterial.unidadId) return;
    try {
      setSaving(true);
      const creado = await window.helatte.crearMateria({
        nombre: nuevoMaterial.nombre,
        unidadId: Number(nuevoMaterial.unidadId),
        stock: Number(nuevoMaterial.stock) || 0,
        costoProm: Number(nuevoMaterial.costoProm) || 0
      });
      setMaterias((prev) => [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setModalMaterial(false);
      setNuevoMaterial({ nombre: '', unidadId: '', stock: 0, costoProm: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear material');
    } finally {
      setSaving(false);
    }
  };

  const registrarMovimientoMateria = async () => {
    if (!movMaterial.materialId) return;
    try {
      setSaving(true);
      const actualizado = await window.helatte.movimientoMateria({
        materialId: movMaterial.materialId,
        tipo: movMaterial.tipo,
        cantidad: Number(movMaterial.cantidad),
        costoTotal: Number(movMaterial.costoTotal) || 0
      });
      setMaterias((prev) => prev.map((m) => (m.id === actualizado.id ? actualizado : m)));
      setModalMovMaterial(false);
      setMovMaterial({ materialId: null, tipo: 'entrada', cantidad: 0, costoTotal: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar movimiento');
    } finally {
      setSaving(false);
    }
  };

  const registrarMovimientoProducto = async () => {
    if (!movProducto.productId) return;
    try {
      setSaving(true);
      const actualizado = await window.helatte.movimientoProducto({
        productId: movProducto.productId,
        tipo: movProducto.tipo,
        cantidad: Number(movProducto.cantidad),
        referencia: movProducto.referencia
      });
      setProductos((prev) => prev.map((p) => (p.id === actualizado.id ? actualizado : p)));
      setModalMovProducto(false);
      setMovProducto({ productId: null, tipo: 'entrada', cantidad: 0, referencia: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar ajuste de stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Inventarios</h2>
          <p className="text-sm text-text/65">Una sola vista para insumos y producto terminado, conectada con catálogo, producción y ventas.</p>
        </div>
        {loading && <span className="text-sm text-text/65">Cargando...</span>}
      </div>

      {error && <div className="bg-blush/16 text-blushDeep px-3 py-2 rounded">{error}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text/50">Materias primas</p>
          <p className="mt-2 text-2xl font-semibold">{materias.length}</p>
          <p className="mt-1 text-sm text-text/60">Insumos con existencias y costo promedio.</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text/50">Productos terminados</p>
          <p className="mt-2 text-2xl font-semibold">{productos.length}</p>
          <p className="mt-1 text-sm text-text/60">Mismos productos usados por catálogo, producción y POS.</p>
        </div>
        <div className="card p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-text/50">Stock terminado total</p>
          <p className="mt-2 text-2xl font-semibold">{productos.reduce((sum, producto) => sum + producto.stock, 0)}</p>
          <p className="mt-1 text-sm text-text/60">Disponible para mostrador y mayoreo.</p>
        </div>
      </section>

      <section className="card p-2">
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'terminados', label: 'Producto terminado' },
            { key: 'materias', label: 'Materia prima' }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setVistaActiva(tab.key as 'materias' | 'terminados')}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                vistaActiva === tab.key
                  ? 'bg-blush/20 text-text shadow-sm'
                  : 'text-text/70 hover:bg-sky/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        {vistaActiva === 'materias' && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Materia prima</h3>
              <p className="text-sm text-text/65">Control de insumos y costo promedio.</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary px-3 py-1.5"
                onClick={() => setModalMaterial(true)}
              >
                Agregar material
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="text-left text-text/65">
                  <th className="py-1">Material</th>
                  <th className="py-1">Unidad</th>
                  <th className="py-1">Stock</th>
                  <th className="py-1">Costo prom</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {materias.map((m) => (
                  <tr key={m.id} className="border-b border-borderSoft/80">
                    <td className="py-2 font-medium">{m.nombre}</td>
                    <td className="py-2">{m.unidad.nombre}</td>
                    <td className="py-2">{m.stock.toFixed(2)}</td>
                    <td className="py-2">${m.costoProm.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        className="text-blushDeep hover:underline text-sm"
                        onClick={() => {
                          setMovMaterial({ materialId: m.id, tipo: 'entrada', cantidad: 0, costoTotal: 0 });
                          setModalMovMaterial(true);
                        }}
                      >
                        Registrar movimiento
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-text/55">
            Últimos movimientos: {materias.reduce((sum, m) => sum + (m.movimientos?.length ?? 0), 0)} registros cargados.
          </div>
        </section>
        )}

        {vistaActiva === 'terminados' && (
        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Producto terminado</h3>
              <p className="text-sm text-text/65">Fuente única compartida con Catálogo, Producción y POS.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr className="text-left text-text/65">
                  <th className="py-1">SKU</th>
                  <th className="py-1">Producto</th>
                  <th className="py-1">Stock</th>
                  <th className="py-1">Precio</th>
                  <th className="py-1">Costo</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className="border-b border-borderSoft/80">
                    <td className="py-2">{p.sku}</td>
                    <td className="py-2 font-medium">
                      <div>
                        <p>{buildProductLabel(p)}</p>
                        <p className="text-xs font-normal text-text/55">{buildProductMeta(p) || 'Sin metadatos adicionales'}</p>
                      </div>
                    </td>
                    <td className="py-2">{p.stock}</td>
                    <td className="py-2">${p.precio.toFixed(2)}</td>
                    <td className="py-2">${p.costo.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <button
                        className="text-blushDeep hover:underline text-sm"
                        onClick={() => {
                          setMovProducto({ productId: p.id, tipo: 'entrada', cantidad: 0, referencia: '' });
                          setModalMovProducto(true);
                        }}
                      >
                        Ajustar stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-text/55">
            Movimientos recientes: {productos.reduce((sum, p) => sum + (p.stockMoves?.length ?? 0), 0)} registros cargados.
          </div>
        </section>
        )}
      </div>

      <Modal open={modalMaterial} onClose={() => setModalMaterial(false)} title="Agregar material">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Nombre</label>
            <input
              className="input"
              value={nuevoMaterial.nombre}
              onChange={(e) => setNuevoMaterial((s) => ({ ...s, nombre: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Unidad</label>
              <select
                className="input"
                value={nuevoMaterial.unidadId}
                onChange={(e) => setNuevoMaterial((s) => ({ ...s, unidadId: e.target.value ? Number(e.target.value) : '' }))}
              >
                <option value="">Seleccione</option>
                {unidades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Stock inicial</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={nuevoMaterial.stock}
                onChange={(e) => setNuevoMaterial((s) => ({ ...s, stock: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Costo promedio</label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="input"
              value={nuevoMaterial.costoProm}
              onChange={(e) => setNuevoMaterial((s) => ({ ...s, costoProm: Number(e.target.value) }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost px-3 py-1.5" onClick={() => setModalMaterial(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary px-3 py-1.5 disabled:opacity-50"
              disabled={saving}
              onClick={() => void crearMaterial()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalMovMaterial} onClose={() => setModalMovMaterial(false)} title="Registrar movimiento">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-text/75">
              {selectedMaterial ? `Material: ${selectedMaterial.nombre}` : 'Selecciona un material'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Tipo</label>
              <select
                className="input"
                value={movMaterial.tipo}
                onChange={(e) => setMovMaterial((s) => ({ ...s, tipo: e.target.value as 'entrada' | 'salida' }))}
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Cantidad</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={movMaterial.cantidad}
                onChange={(e) => setMovMaterial((s) => ({ ...s, cantidad: Number(e.target.value) }))}
              />
            </div>
          </div>
          {movMaterial.tipo === 'entrada' && (
            <div>
              <label className="block text-sm font-medium">Costo total</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={movMaterial.costoTotal}
                onChange={(e) => setMovMaterial((s) => ({ ...s, costoTotal: Number(e.target.value) }))}
              />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost px-3 py-1.5" onClick={() => setModalMovMaterial(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary px-3 py-1.5 disabled:opacity-50"
              disabled={saving}
              onClick={() => void registrarMovimientoMateria()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modalMovProducto} onClose={() => setModalMovProducto(false)} title="Ajuste de stock">
        <div className="space-y-3">
          <div>
            <p className="text-sm text-text/75">
              {selectedProducto
                ? `Producto: ${selectedProducto.tipo.nombre} de ${selectedProducto.sabor.nombre}`
                : 'Selecciona un producto'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium">Tipo</label>
              <select
                className="input"
                value={movProducto.tipo}
                onChange={(e) => setMovProducto((s) => ({ ...s, tipo: e.target.value as 'entrada' | 'salida' }))}
              >
                <option value="entrada">Entrada</option>
                <option value="salida">Salida</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Cantidad</label>
              <input
                type="number"
                min={0}
                step="1"
                className="input"
                value={movProducto.cantidad}
                onChange={(e) => setMovProducto((s) => ({ ...s, cantidad: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium">Referencia</label>
            <input
              className="input"
              value={movProducto.referencia}
              onChange={(e) => setMovProducto((s) => ({ ...s, referencia: e.target.value }))}
              placeholder="Motivo o folio"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost px-3 py-1.5" onClick={() => setModalMovProducto(false)}>
              Cancelar
            </button>
            <button
              className="btn btn-primary px-3 py-1.5 disabled:opacity-50"
              disabled={saving}
              onClick={() => void registrarMovimientoProducto()}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
