import { useEffect, useMemo, useState } from 'react';
import type { FridgeAsset, FridgeAssignment } from '../../../preload';

type RefriForm = Pick<FridgeAsset, 'modelo' | 'serie'> & { estado: 'activo' | 'inactivo' };

const emptyForm: RefriForm = { modelo: '', serie: '', estado: 'activo' };

export default function Refris() {
  const [refris, setRefris] = useState<FridgeAsset[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mostrandoModal, setMostrandoModal] = useState(false);
  const [editando, setEditando] = useState<FridgeAsset | null>(null);
  const [form, setForm] = useState<RefriForm>(emptyForm);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarRefris = async () => {
    setCargando(true);
    try {
      const data = await window.helatte.listarRefris();
      setRefris(data);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarRefris();
  }, []);

  const abrirNuevo = () => {
    setEditando(null);
    setForm(emptyForm);
    setMostrandoModal(true);
    setMensaje('');
    setError('');
  };

  const abrirEditar = (refri: FridgeAsset) => {
    setEditando(refri);
    setForm({ modelo: refri.modelo, serie: refri.serie, estado: refri.estado as 'activo' | 'inactivo' });
    setMostrandoModal(true);
    setMensaje('');
    setError('');
  };

  const cerrarModal = () => {
    setMostrandoModal(false);
    setEditando(null);
    setForm(emptyForm);
  };

  const guardarRefri = async () => {
    if (guardando) return;
    const modelo = form.modelo.trim();
    const serie = form.serie.trim();

    if (!modelo || !serie) {
      setError('Modelo y serie son obligatorios.');
      return;
    }

    setGuardando(true);
    setError('');

    try {
      if (editando) {
        await window.helatte.actualizarRefri({ id: editando.id, modelo, serie, estado: form.estado });
        setMensaje('Refri actualizado correctamente.');
      } else {
        await window.helatte.crearRefri({ modelo, serie, estado: form.estado });
        setMensaje('Refri creado correctamente.');
      }
      cerrarModal();
      await cargarRefris();
    } catch (err) {
      console.error(err);
      setError('No se pudo guardar el refri.');
    } finally {
      setGuardando(false);
    }
  };

  const toggleEstado = async (refri: FridgeAsset) => {
    setError('');
    setMensaje('');
    try {
      const actualizado = await window.helatte.toggleRefriEstado({ id: refri.id });
      setRefris((prev) => prev.map((r) => (r.id === actualizado.id ? actualizado : r)));
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del refri.');
    }
  };

  const obtenerAsignacionActiva = (refri: FridgeAsset): FridgeAssignment | undefined =>
    (refri.asignaciones ?? []).find((a) => !a.fechaFin);

  const obtenerHistorialAsignaciones = (refri: FridgeAsset): FridgeAssignment[] =>
    (refri.asignaciones ?? []).filter((a) => !!a.fechaFin);

  const obtenerReferenciaOrden = (refri: FridgeAsset): FridgeAssignment | undefined => {
    const activa = obtenerAsignacionActiva(refri);
    if (activa) return activa;
    if (!refri.asignaciones || refri.asignaciones.length === 0) return undefined;
    return refri.asignaciones[0];
  };

  const formatearFecha = (fecha?: string | null) => {
    if (!fecha) return '';
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const refrisOrdenados = useMemo(
    () =>
      [...refris].sort((a, b) => {
        const asignacionA = obtenerReferenciaOrden(a);
        const asignacionB = obtenerReferenciaOrden(b);

        if (asignacionA && asignacionB) return asignacionA.entregadoEn < asignacionB.entregadoEn ? 1 : -1;
        if (asignacionA) return -1;
        if (asignacionB) return 1;
        return a.id - b.id;
      }),
    [refris]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Refris en comodato/renta</h2>
        <button className="btn" onClick={abrirNuevo}>
          Agregar refri
        </button>
      </div>

      {mensaje && <p className="text-sm text-mintDeep">{mensaje}</p>}
      {error && <p className="text-sm text-blushDeep">{error}</p>}

      <div className="card p-4">
        {cargando ? (
          <p className="text-sm text-text/55">Cargando refris...</p>
        ) : refrisOrdenados.length === 0 ? (
          <p className="text-sm text-text/65">No hay refris registrados.</p>
        ) : (
          <table className="table">
            <thead>
              <tr className="text-left text-text/65">
                <th>ID</th>
                <th>Modelo</th>
                <th>Serie</th>
                <th>Asignación</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {refrisOrdenados.map((r) => {
                const asignacionActiva = obtenerAsignacionActiva(r);
                const historial = obtenerHistorialAsignaciones(r);
                const asignacionReferencia = asignacionActiva ?? historial[0];
                return (
                  <tr key={r.id} className="border-b border-borderSoft/80">
                    <td className="py-1">{r.id}</td>
                    <td>{r.modelo}</td>
                    <td>{r.serie}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {asignacionReferencia ? (
                          <>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {asignacionReferencia.customer?.nombre ?? 'Cliente desconocido'}
                              </span>
                              <span className="text-xs text-text/65">
                                {asignacionReferencia.ubicacion || 'Sin ubicación'}
                              </span>
                              <span className="text-xs text-text/55">
                                Asignado {formatearFecha(asignacionReferencia.entregadoEn)}
                                {asignacionReferencia.fechaFin ? ` — Fin ${formatearFecha(asignacionReferencia.fechaFin)}` : ''}
                              </span>
                            </div>
                            {historial.length > 0 && (
                              <div className="text-xs text-text/75 border-t border-borderSoft/80 pt-1 space-y-1">
                                <p className="font-semibold text-text/75">Historial</p>
                                <ul className="space-y-1">
                                  {historial.map((a) => (
                                    <li key={a.id} className="flex flex-col">
                                      <span className="font-medium">{a.customer?.nombre ?? 'Cliente desconocido'}</span>
                                      <span className="text-text/65">{a.ubicacion || 'Sin ubicación'}</span>
                                      <span className="text-[11px] text-text/55">
                                        {formatearFecha(a.entregadoEn)} → {formatearFecha(a.fechaFin)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-text/55">Sin asignar</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                          r.estado === 'activo' ? 'bg-mint/30 text-mintDeep' : 'bg-borderSoft/80 text-text/75'
                        }`}
                      >
                        {r.estado}
                      </span>
                    </td>
                    <td className="space-x-2 text-right">
                      <button className="text-blushDeep text-sm" onClick={() => abrirEditar(r)}>
                        Editar
                      </button>
                      <button className="text-sm text-text/75" onClick={() => toggleEstado(r)}>
                        {r.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <p className="text-xs text-text/55 mt-3">
          Control de visitas, reposición y mermas se gestionan en historial.
        </p>
      </div>

      {mostrandoModal && (
        <div className="fixed inset-0 bg-text/18 flex items-center justify-center z-20">
          <div className="modal-panel p-5 w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{editando ? 'Editar refri' : 'Nuevo refri'}</h4>
              <button onClick={cerrarModal}>Cerrar</button>
            </div>
            {error && <p className="text-sm text-blushDeep">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col text-sm gap-1">
                Modelo
                <input
                  className="input"
                  value={form.modelo}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm gap-1">
                Serie
                <input
                  className="input"
                  value={form.serie}
                  onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm gap-1">
                Estado
                <select
                  className="input"
                  value={form.estado}
                  onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value as 'activo' | 'inactivo' }))}
                >
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </label>
            </div>
            <button className="btn w-full" onClick={guardarRefri} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Actualizar refri' : 'Crear refri'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
