import { useEffect, useMemo, useState } from 'react';
import type { Customer, FridgeAsset, FridgeAssignment } from '../../../preload';
import { useClientesContext } from '../state/ClientesContext';

type ClienteAsignacion = FridgeAssignment & { asset: FridgeAsset };

type ClienteForm = {
  nombre: string;
  telefono: string;
  limite: string;
  saldo: string;
  estado: 'activo' | 'inactivo';
};

const emptyForm: ClienteForm = {
  nombre: '',
  telefono: '',
  limite: '0',
  saldo: '0',
  estado: 'activo'
};

const helatte = window.helatte;

export default function Clientes() {
  const { clientes, cargando, cargarClientes, error: errorClientes, limpiarError } = useClientesContext();
  const [mostrandoModal, setMostrandoModal] = useState(false);
  const [editando, setEditando] = useState<Customer | null>(null);
  const [form, setForm] = useState<ClienteForm>(emptyForm);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [asignaciones, setAsignaciones] = useState<ClienteAsignacion[]>([]);
  const [cargandoAsignaciones, setCargandoAsignaciones] = useState(false);
  const [mostrandoModalAsignacion, setMostrandoModalAsignacion] = useState(false);
  const [refrisDisponibles, setRefrisDisponibles] = useState<FridgeAsset[]>([]);
  const [guardandoAsignacion, setGuardandoAsignacion] = useState(false);
  const [eliminandoAsignacionId, setEliminandoAsignacionId] = useState<number | null>(null);
  const [formAsignacion, setFormAsignacion] = useState<{
    assetId: string;
    ubicacion: string;
    entregadoEn: string;
    deposito: string;
    renta: string;
  }>({
    assetId: '',
    ubicacion: '',
    entregadoEn: new Date().toISOString().slice(0, 10),
    deposito: '',
    renta: ''
  });

  const cargarAsignacionesCliente = async (clienteId: number) => {
    setCargandoAsignaciones(true);
    try {
      const data = await helatte.listarAsignacionesCliente(clienteId);
      setAsignaciones(data);
    } finally {
      setCargandoAsignaciones(false);
    }
  };

  const cargarRefrisDisponibles = async () => {
    try {
      const disponibles = await helatte.listarRefrisDisponibles();
      setRefrisDisponibles(disponibles);
      setFormAsignacion((f) => ({
        ...f,
        assetId: disponibles[0]?.id.toString() ?? '',
        ubicacion: '',
        deposito: '',
        renta: '',
        entregadoEn: new Date().toISOString().slice(0, 10)
      }));
      setMostrandoModalAsignacion(true);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los refris disponibles.');
    }
  };

  useEffect(() => {
    cargarClientes().catch(() => {
      setError('No se pudieron cargar los clientes.');
    });
  }, [cargarClientes]);

  const abrirNuevo = () => {
    limpiarError();
    setEditando(null);
    setForm(emptyForm);
    setAsignaciones([]);
    setMostrandoModal(true);
    setMensaje('');
    setError('');
  };

  const abrirEditar = (cliente: Customer) => {
    limpiarError();
    setEditando(cliente);
    setForm({
      nombre: cliente.nombre,
      telefono: cliente.telefono ?? '',
      limite: cliente.limite.toString(),
      saldo: cliente.saldo.toString(),
      estado: cliente.estado
    });
    setAsignaciones([]);
    cargarAsignacionesCliente(cliente.id);
    setMostrandoModal(true);
    setMensaje('');
    setError('');
  };

  const cerrarModal = () => {
    setMostrandoModal(false);
    setEditando(null);
    setForm(emptyForm);
    setAsignaciones([]);
    setMostrandoModalAsignacion(false);
  };

  const guardarCliente = async () => {
    if (guardando) return;
    const limite = parseFloat(form.limite) || 0;
    const saldo = parseFloat(form.saldo) || 0;
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (limite < 0) {
      setError('El límite no puede ser negativo.');
      return;
    }
    if (saldo < 0) {
      setError('El saldo no puede ser negativo.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      if (editando) {
        await helatte.actualizarCliente({
          id: editando.id,
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || undefined,
          limite,
          saldo,
          estado: form.estado
        });
      } else {
        await helatte.crearCliente({
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim() || undefined,
          limite,
          saldo,
          estado: form.estado
        });
      }
      const clientesActualizados = await cargarClientes();
      if (editando && clientesActualizados) {
        const clienteRefrescado = clientesActualizados.find((c) => c.id === editando.id) ?? null;
        setEditando(clienteRefrescado);
      }
      setMensaje(editando ? 'Cliente actualizado correctamente.' : 'Cliente creado correctamente.');
      cerrarModal();
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al guardar el cliente.');
    } finally {
      setGuardando(false);
    }
  };

  const guardarAsignacion = async () => {
    if (!editando || guardandoAsignacion) return;
    if (!formAsignacion.assetId) {
      setError('Selecciona un refri disponible.');
      return;
    }
    if (!formAsignacion.ubicacion.trim()) {
      setError('La ubicación es obligatoria.');
      return;
    }
    if (!formAsignacion.entregadoEn) {
      setError('La fecha de entrega es obligatoria.');
      return;
    }
    setGuardandoAsignacion(true);
    setError('');
    try {
      const deposito = formAsignacion.deposito.trim() ? parseFloat(formAsignacion.deposito) : undefined;
      const renta = formAsignacion.renta.trim() ? parseFloat(formAsignacion.renta) : undefined;
      const nuevaAsignacion = await helatte.crearAsignacionRefri({
        customerId: editando.id,
        assetId: parseInt(formAsignacion.assetId, 10),
        ubicacion: formAsignacion.ubicacion.trim(),
        entregadoEn: formAsignacion.entregadoEn,
        deposito: isNaN(deposito ?? NaN) ? undefined : deposito,
        renta: isNaN(renta ?? NaN) ? undefined : renta
      });
      await Promise.all([cargarAsignacionesCliente(editando.id), cargarClientes()]);
      if (nuevaAsignacion.customer) {
        setEditando((prev) =>
          prev && prev.id === nuevaAsignacion.customerId ? { ...prev, saldo: nuevaAsignacion.customer!.saldo } : prev
        );
        setForm((prev) => ({ ...prev, saldo: nuevaAsignacion.customer.saldo.toString() }));
      }
      setMostrandoModalAsignacion(false);
    } catch (err) {
      console.error(err);
      setError('No se pudo asignar el refri.');
    } finally {
      setGuardandoAsignacion(false);
    }
  };

  const eliminarAsignacion = async (id: number) => {
    if (eliminandoAsignacionId) return;
    setEliminandoAsignacionId(id);
    setError('');
    try {
      await helatte.eliminarAsignacionRefri(id);
      if (editando) {
        await cargarAsignacionesCliente(editando.id);
      } else {
        setAsignaciones((prev) => prev.filter((a) => a.id !== id));
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo quitar la asignación.');
    } finally {
      setEliminandoAsignacionId(null);
    }
  };

  const formatearFecha = (fecha?: string | null) => {
    if (!fecha) return '—';
    const date = new Date(fecha);
    return isNaN(date.getTime()) ? fecha : date.toLocaleDateString('es-MX');
  };

  const formatearDinero = (valor?: number | null) => {
    if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
    return `$${valor.toFixed(2)}`;
  };

  const toggleEstado = async (cliente: Customer) => {
    const nuevoEstado = cliente.estado === 'activo' ? 'inactivo' : 'activo';
    setError('');
    try {
      await helatte.toggleClienteEstado({ id: cliente.id, estado: nuevoEstado });
      await cargarClientes();
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del cliente.');
    }
  };

  const asignacionesActivas = useMemo(() => asignaciones.filter((a) => !a.fechaFin), [asignaciones]);
  const historialAsignaciones = useMemo(() => asignaciones.filter((a) => a.fechaFin), [asignaciones]);
  const errorActivo = error || errorClientes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <button className="btn" onClick={abrirNuevo}>
          Agregar cliente
        </button>
      </div>

      {mensaje && <p className="text-sm text-green-700">{mensaje}</p>}
      {errorActivo && <p className="text-sm text-red-600">{errorActivo}</p>}

      <div className="card p-4">
        {cargando ? (
          <p className="text-sm text-gray-500">Cargando clientes...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600">
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Límite</th>
                <th>Saldo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-secondary/50">
                  <td className="py-1">{c.nombre}</td>
                  <td>{c.telefono ?? '—'}</td>
                  <td>${c.limite.toFixed(2)}</td>
                  <td>${c.saldo.toFixed(2)}</td>
                  <td className="capitalize">{c.estado}</td>
                  <td className="space-x-2 text-right">
                    <button className="text-primary text-sm" onClick={() => abrirEditar(c)}>
                      Editar
                    </button>
                    <button className="text-sm text-gray-700" onClick={() => toggleEstado(c)}>
                      {c.estado === 'activo' ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {mostrandoModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-20">
          <div className="bg-white rounded-xl shadow-lg p-5 w-full max-w-lg space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h4>
              <button onClick={cerrarModal}>Cerrar</button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col text-sm gap-1">
                Nombre
                <input
                  className="input"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm gap-1">
                Teléfono
                <input
                  className="input"
                  value={form.telefono}
                  onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm gap-1">
                Límite de crédito
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.limite}
                  onChange={(e) => setForm((f) => ({ ...f, limite: e.target.value }))}
                />
              </label>
              <label className="flex flex-col text-sm gap-1">
                Saldo
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={form.saldo}
                  onChange={(e) => setForm((f) => ({ ...f, saldo: e.target.value }))}
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
            {editando ? (
              <div className="border-t border-secondary/50 pt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-semibold text-sm">Refris asignados</h5>
                  <button className="text-primary text-sm" onClick={cargarRefrisDisponibles} disabled={guardandoAsignacion}>
                    Asignar refri
                  </button>
                </div>
                {cargandoAsignaciones ? (
                  <p className="text-xs text-gray-500">Cargando asignaciones...</p>
                ) : asignacionesActivas.length === 0 ? (
                  <p className="text-xs text-gray-600">Este cliente no tiene refris asignados.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-600">
                        <th>Modelo</th>
                        <th>Serie</th>
                        <th>Ubicación</th>
                        <th>Entregado</th>
                        <th>Depósito</th>
                        <th>Renta</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {asignacionesActivas.map((a) => (
                        <tr key={a.id} className="border-b border-secondary/50">
                          <td className="py-1">{a.asset.modelo}</td>
                          <td>{a.asset.serie}</td>
                          <td>{a.ubicacion}</td>
                          <td>{formatearFecha(a.entregadoEn)}</td>
                          <td>{formatearDinero(a.deposito)}</td>
                          <td>{formatearDinero(a.renta)}</td>
                          <td className="text-right">
                            <button
                              className="text-red-600"
                              onClick={() => eliminarAsignacion(a.id)}
                              disabled={eliminandoAsignacionId === a.id}
                            >
                              {eliminandoAsignacionId === a.id ? 'Quitando...' : 'Quitar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="border-t border-secondary/50 pt-3 space-y-2">
                  <h5 className="font-semibold text-sm">Historial de refris</h5>
                  {cargandoAsignaciones ? (
                    <p className="text-xs text-gray-500">Cargando historial...</p>
                  ) : historialAsignaciones.length === 0 ? (
                    <p className="text-xs text-gray-600">No hay historial de refris para este cliente.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-600">
                          <th>Modelo</th>
                          <th>Serie</th>
                          <th>Ubicación</th>
                          <th>Inicio</th>
                          <th>Fin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialAsignaciones.map((a) => (
                          <tr key={a.id} className="border-b border-secondary/50">
                            <td className="py-1">{a.asset.modelo}</td>
                            <td>{a.asset.serie}</td>
                            <td>{a.ubicacion}</td>
                            <td>{formatearFecha(a.entregadoEn)}</td>
                            <td>{formatearFecha(a.fechaFin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 border-t border-secondary/50 pt-3">
                Guarda el cliente para asignar un refri.
              </p>
            )}
            <button className="btn w-full" onClick={guardarCliente} disabled={guardando}>
              {guardando ? 'Guardando...' : editando ? 'Actualizar cliente' : 'Crear cliente'}
            </button>
          </div>
        </div>
      )}
      {mostrandoModalAsignacion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
          <div className="bg-white rounded-lg shadow-xl p-4 w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-semibold">Asignar refri</h5>
              <button onClick={() => setMostrandoModalAsignacion(false)} className="text-sm">
                Cerrar
              </button>
            </div>
            {refrisDisponibles.length === 0 ? (
              <p className="text-sm text-gray-600">No hay refris disponibles para asignar.</p>
            ) : (
              <>
                <label className="flex flex-col text-sm gap-1">
                  Refri
                  <select
                    className="input"
                    value={formAsignacion.assetId}
                    onChange={(e) => setFormAsignacion((f) => ({ ...f, assetId: e.target.value }))}
                  >
                    {refrisDisponibles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.modelo} — Serie {r.serie}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col text-sm gap-1">
                  Ubicación
                  <input
                    className="input"
                    value={formAsignacion.ubicacion}
                    onChange={(e) => setFormAsignacion((f) => ({ ...f, ubicacion: e.target.value }))}
                    placeholder="Ej. mostrador, entrada, patio"
                  />
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex flex-col text-sm gap-1">
                    Fecha de entrega
                    <input
                      className="input"
                      type="date"
                      value={formAsignacion.entregadoEn}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, entregadoEn: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col text-sm gap-1">
                    Depósito
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formAsignacion.deposito}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, deposito: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </label>
                  <label className="flex flex-col text-sm gap-1">
                    Renta
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={formAsignacion.renta}
                      onChange={(e) => setFormAsignacion((f) => ({ ...f, renta: e.target.value }))}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button className="px-3 py-2 rounded border" onClick={() => setMostrandoModalAsignacion(false)}>
                    Cancelar
                  </button>
                  <button className="btn px-3 py-2" onClick={guardarAsignacion} disabled={guardandoAsignacion}>
                    {guardandoAsignacion ? 'Guardando...' : 'Guardar asignación'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
