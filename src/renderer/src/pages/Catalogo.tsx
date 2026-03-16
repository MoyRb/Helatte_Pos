import { useEffect, useMemo, useState } from 'react';

type Flavor = { id: number; nombre: string; color?: string | null; activo: boolean };
type ProductType = { id: number; nombre: string; activo: boolean };
type Product = {
  id: number;
  sku?: string | null;
  presentacion: string;
  precio: number;
  costo: number;
  stock: number;
  activo: boolean;
  tipo: ProductType;
  sabor: Flavor;
};

const emptyTipo = { nombre: '', activo: true };
const emptySabor = { nombre: '', color: '', activo: true };
const emptyProducto = {
  tipoId: 0,
  saborId: 0,
  presentacion: '',
  precio: '',
  costo: '',
  sku: '',
  stock: '0',
  activo: true
};

export default function Catalogo() {
  const [sabores, setSabores] = useState<Flavor[]>([]);
  const [productos, setProductos] = useState<Product[]>([]);
  const [tipos, setTipos] = useState<ProductType[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modales
  const [mostrarTipo, setMostrarTipo] = useState(false);
  const [mostrarSabor, setMostrarSabor] = useState(false);
  const [mostrarProducto, setMostrarProducto] = useState(false);

  // Edit mode
  const [editTipoId, setEditTipoId] = useState<number | null>(null);
  const [editSaborId, setEditSaborId] = useState<number | null>(null);
  const [editProductoId, setEditProductoId] = useState<number | null>(null);

  // Forms
  const [nuevoTipo, setNuevoTipo] = useState(emptyTipo);
  const [nuevoSabor, setNuevoSabor] = useState(emptySabor);
  const [nuevoProducto, setNuevoProducto] = useState<typeof emptyProducto>(emptyProducto);

  const cargarCatalogo = async () => {
    try {
      setError(null);
      setCargando(true);
      const data = await window.helatte.listarCatalogo();
      setSabores(data.sabores ?? []);
      setProductos(data.productos ?? []);
      setTipos(data.tipos ?? []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCatalogo();
  }, []);

  const tipoNombrePorId = useMemo(() => {
    const m = new Map<number, string>();
    tipos.forEach((t) => m.set(t.id, t.nombre));
    return m;
  }, [tipos]);

  const saborNombrePorId = useMemo(() => {
    const m = new Map<number, string>();
    sabores.forEach((s) => m.set(s.id, s.nombre));
    return m;
  }, [sabores]);

  // ========== TIPOS ==========
  const abrirCrearTipo = () => {
    setEditTipoId(null);
    setNuevoTipo(emptyTipo);
    setMostrarTipo(true);
  };

  const abrirEditarTipo = (t: ProductType) => {
    setEditTipoId(t.id);
    setNuevoTipo({ nombre: t.nombre, activo: t.activo });
    setMostrarTipo(true);
  };

  const guardarTipo = async () => {
    if (!nuevoTipo.nombre.trim()) return;
    try {
      setError(null);
      if (editTipoId) {
        await window.helatte.actualizarTipo({ id: editTipoId, nombre: nuevoTipo.nombre.trim(), activo: nuevoTipo.activo });
      } else {
        await window.helatte.crearTipo({ nombre: nuevoTipo.nombre.trim(), activo: nuevoTipo.activo });
      }
      setMostrarTipo(false);
      setEditTipoId(null);
      setNuevoTipo(emptyTipo);
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const toggleTipo = async (t: ProductType) => {
    try {
      setError(null);
      await window.helatte.toggleTipo({ id: t.id, activo: !t.activo });
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  // ========== SABORES ==========
  const abrirCrearSabor = () => {
    setEditSaborId(null);
    setNuevoSabor(emptySabor);
    setMostrarSabor(true);
  };

  const abrirEditarSabor = (s: Flavor) => {
    setEditSaborId(s.id);
    setNuevoSabor({ nombre: s.nombre, color: s.color ?? '', activo: s.activo });
    setMostrarSabor(true);
  };

  const guardarSabor = async () => {
    if (!nuevoSabor.nombre.trim()) return;
    try {
      setError(null);
      if (editSaborId) {
        await window.helatte.actualizarSabor({
          id: editSaborId,
          nombre: nuevoSabor.nombre.trim(),
          color: nuevoSabor.color ? nuevoSabor.color : null,
          activo: nuevoSabor.activo
        });
      } else {
        await window.helatte.crearSabor({
          nombre: nuevoSabor.nombre.trim(),
          color: nuevoSabor.color || undefined,
          activo: nuevoSabor.activo
        });
      }
      setMostrarSabor(false);
      setEditSaborId(null);
      setNuevoSabor(emptySabor);
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const toggleSabor = async (s: Flavor) => {
    try {
      setError(null);
      await window.helatte.toggleSabor({ id: s.id, activo: !s.activo });
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  // ========== PRODUCTOS ==========
  const abrirCrearProducto = () => {
    setEditProductoId(null);
    setNuevoProducto(emptyProducto);
    setMostrarProducto(true);
  };

  const abrirEditarProducto = (p: Product) => {
    setEditProductoId(p.id);
    setNuevoProducto({
      tipoId: p.tipo?.id ?? 0,
      saborId: p.sabor?.id ?? 0,
      presentacion: p.presentacion ?? '',
      precio: String(p.precio ?? ''),
      costo: String(p.costo ?? ''),
      sku: p.sku ?? '',
      stock: String(p.stock ?? 0),
      activo: p.activo
    });
    setMostrarProducto(true);
  };

  const guardarProducto = async () => {
    if (!nuevoProducto.presentacion.trim() || !nuevoProducto.tipoId || !nuevoProducto.saborId) return;

    const payload = {
      tipoId: Number(nuevoProducto.tipoId),
      saborId: Number(nuevoProducto.saborId),
      presentacion: nuevoProducto.presentacion.trim(),
      precio: parseFloat(String(nuevoProducto.precio)),
      costo: parseFloat(String(nuevoProducto.costo)),
      sku: nuevoProducto.sku?.trim() ? nuevoProducto.sku.trim() : null,
      stock: parseInt(String(nuevoProducto.stock || 0), 10),
      activo: !!nuevoProducto.activo
    };

    try {
      setError(null);
      if (editProductoId) {
        await window.helatte.actualizarProducto({ id: editProductoId, ...payload });
      } else {
        // crearProducto acepta sku?: string y stock?: number; activo?: boolean (según tu preload)
        await window.helatte.crearProducto({
          ...payload,
          sku: payload.sku ?? undefined
        });
      }
      setMostrarProducto(false);
      setEditProductoId(null);
      setNuevoProducto(emptyProducto);
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  const toggleProducto = async (p: Product) => {
    try {
      setError(null);
      await window.helatte.toggleProducto({ id: p.id, activo: !p.activo });
      await cargarCatalogo();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Catálogo de productos y sabores</h2>
        <div className="flex gap-2">
          <button className="btn" onClick={abrirCrearTipo}>Agregar tipo</button>
          <button className="btn" onClick={abrirCrearSabor}>Agregar sabor</button>
          <button className="btn" onClick={abrirCrearProducto}>Agregar producto</button>
        </div>
      </div>

      {error && (
        <div className="card p-3 text-sm text-red-700 bg-red-50">
          {error}
        </div>
      )}

      {cargando ? (
        <p className="text-sm text-gray-500">Cargando catálogo...</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TIPOS */}
            <div className="card p-4">
              <h3 className="font-semibold mb-2">Tipos</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th>Nombre</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tipos.map((t) => (
                    <tr key={t.id} className="border-b border-secondary/50">
                      <td className="py-1">{t.nombre}</td>
                      <td>{t.activo ? 'Activo' : 'Inactivo'}</td>
                      <td className="py-1 text-right">
                        <button className="text-primary hover:underline mr-3" onClick={() => abrirEditarTipo(t)}>Editar</button>
                        <button className="text-primary hover:underline" onClick={() => toggleTipo(t)}>
                          {t.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {tipos.length === 0 && (
                    <tr><td className="py-2 text-gray-500" colSpan={3}>No hay tipos aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* SABORES */}
            <div className="card p-4">
              <h3 className="font-semibold mb-2">Sabores</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th>Nombre</th>
                    <th>Color</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {sabores.map((s) => (
                    <tr key={s.id} className="border-b border-secondary/50">
                      <td className="py-1">{s.nombre}</td>
                      <td>{s.color ?? '—'}</td>
                      <td>{s.activo ? 'Activo' : 'Inactivo'}</td>
                      <td className="py-1 text-right">
                        <button className="text-primary hover:underline mr-3" onClick={() => abrirEditarSabor(s)}>Editar</button>
                        <button className="text-primary hover:underline" onClick={() => toggleSabor(s)}>
                          {s.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sabores.length === 0 && (
                    <tr><td className="py-2 text-gray-500" colSpan={4}>No hay sabores aún.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PRODUCTOS */}
          <div className="card p-4">
            <h3 className="font-semibold mb-2">Productos</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th>SKU</th>
                  <th>Tipo</th>
                  <th>Sabor</th>
                  <th>Presentación</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((p) => (
                  <tr key={p.id} className="border-b border-secondary/50">
                    <td className="py-1">{p.sku ?? '—'}</td>
                    <td className="capitalize">{p.tipo?.nombre ?? tipoNombrePorId.get((p as any).tipoId) ?? '—'}</td>
                    <td>{p.sabor?.nombre ?? saborNombrePorId.get((p as any).saborId) ?? '—'}</td>
                    <td>{p.presentacion}</td>
                    <td>${p.precio.toFixed(2)}</td>
                    <td>{p.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="py-1 text-right">
                      <button className="text-primary hover:underline mr-3" onClick={() => abrirEditarProducto(p)}>Editar</button>
                      <button className="text-primary hover:underline" onClick={() => toggleProducto(p)}>
                        {p.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
                {productos.length === 0 && (
                  <tr><td className="py-2 text-gray-500" colSpan={7}>No hay productos aún.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TIPO */}
      {mostrarTipo && (
        <div className="fixed inset-0 bg-black/30 z-20">
          <div className="flex min-h-full items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">{editTipoId ? 'Editar tipo' : 'Nuevo tipo'}</h4>
                <button onClick={() => setMostrarTipo(false)}>Cerrar</button>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 py-3">
                <label className="flex flex-col text-sm gap-1">
                  Nombre
                  <input className="input" value={nuevoTipo.nombre} onChange={(e) => setNuevoTipo((t) => ({ ...t, nombre: e.target.value }))} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={nuevoTipo.activo} onChange={(e) => setNuevoTipo((t) => ({ ...t, activo: e.target.checked }))} />
                  Activo
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t">
                <button className="btn w-full" onClick={guardarTipo}>Guardar</button>
                <button className="btn-secondary w-full" onClick={() => setMostrarTipo(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SABOR */}
      {mostrarSabor && (
        <div className="fixed inset-0 bg-black/30 z-20">
          <div className="flex min-h-full items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">{editSaborId ? 'Editar sabor' : 'Nuevo sabor'}</h4>
                <button onClick={() => setMostrarSabor(false)}>Cerrar</button>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 py-3">
                <label className="flex flex-col text-sm gap-1">
                  Nombre
                  <input className="input" value={nuevoSabor.nombre} onChange={(e) => setNuevoSabor((s) => ({ ...s, nombre: e.target.value }))} />
                </label>
                <label className="flex flex-col text-sm gap-1">
                  Color (opcional)
                  <input className="input" value={nuevoSabor.color ?? ''} onChange={(e) => setNuevoSabor((s) => ({ ...s, color: e.target.value }))} />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={nuevoSabor.activo} onChange={(e) => setNuevoSabor((s) => ({ ...s, activo: e.target.checked }))} />
                  Activo
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t">
                <button className="btn w-full" onClick={guardarSabor}>Guardar</button>
                <button className="btn-secondary w-full" onClick={() => setMostrarSabor(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRODUCTO */}
      {mostrarProducto && (
        <div className="fixed inset-0 bg-black/30 z-20">
          <div className="flex min-h-full items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] p-5 flex flex-col">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold">{editProductoId ? 'Editar producto' : 'Nuevo producto'}</h4>
                <button onClick={() => setMostrarProducto(false)}>Cerrar</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-1 py-3">
                <label className="flex flex-col text-sm gap-1">
                  Tipo
                  <select className="input" value={nuevoProducto.tipoId} onChange={(e) => setNuevoProducto((p) => ({ ...p, tipoId: Number(e.target.value) }))}>
                    <option value={0}>Selecciona tipo</option>
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col text-sm gap-1">
                  Sabor
                  <select className="input" value={nuevoProducto.saborId} onChange={(e) => setNuevoProducto((p) => ({ ...p, saborId: Number(e.target.value) }))}>
                    <option value={0}>Selecciona sabor</option>
                    {sabores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col text-sm gap-1">
                  Presentación
                  <input className="input" value={nuevoProducto.presentacion} onChange={(e) => setNuevoProducto((p) => ({ ...p, presentacion: e.target.value }))} />
                </label>

                <label className="flex flex-col text-sm gap-1">
                  Precio
                  <input className="input" type="number" value={nuevoProducto.precio} onChange={(e) => setNuevoProducto((p) => ({ ...p, precio: e.target.value }))} />
                </label>

                <label className="flex flex-col text-sm gap-1">
                  Costo
                  <input className="input" type="number" value={nuevoProducto.costo} onChange={(e) => setNuevoProducto((p) => ({ ...p, costo: e.target.value }))} />
                </label>

                <label className="flex flex-col text-sm gap-1">
                  Stock
                  <input className="input" type="number" value={nuevoProducto.stock} onChange={(e) => setNuevoProducto((p) => ({ ...p, stock: e.target.value }))} />
                </label>

                <label className="flex flex-col text-sm gap-1 md:col-span-2">
                  SKU (opcional)
                  <input className="input" value={nuevoProducto.sku} onChange={(e) => setNuevoProducto((p) => ({ ...p, sku: e.target.value }))} />
                </label>

                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" checked={nuevoProducto.activo} onChange={(e) => setNuevoProducto((p) => ({ ...p, activo: e.target.checked }))} />
                  Activo
                </label>
              </div>

              <div className="flex flex-col gap-2 pt-3 border-t">
                <button className="btn w-full" onClick={guardarProducto}>Guardar</button>
                <button className="btn-secondary w-full" onClick={() => setMostrarProducto(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
