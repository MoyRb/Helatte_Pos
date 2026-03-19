import { useEffect, useMemo, useState } from 'react';
import type { Customer, PromissoryNote, PromissoryPayment } from '../../../preload';
import { useClientesContext } from '../state/ClientesContext';

type PagareConAbonos = PromissoryNote & { abonos?: PromissoryPayment[] };

const helatte = window.helatte;

export default function Creditos() {
  const { clientes, cargando: cargandoClientes, cargarClientes, error: errorClientes } = useClientesContext();
  const [pagares, setPagares] = useState<PagareConAbonos[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Customer | null>(null);
  const [pagareSeleccionado, setPagareSeleccionado] = useState<PagareConAbonos | null>(null);
  const [pagareParaAbono, setPagareParaAbono] = useState<PagareConAbonos | null>(null);
  const [cargandoPagares, setCargandoPagares] = useState(false);
  const [mostrandoModal, setMostrandoModal] = useState(false);
  const [mostrandoModalAbono, setMostrandoModalAbono] = useState(false);
  const [monto, setMonto] = useState('');
  const [montoAbono, setMontoAbono] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [guardandoAbono, setGuardandoAbono] = useState(false);

  const cargarPagares = async (clienteId: number) => {
    setCargandoPagares(true);
    setError('');
    try {
      const data = await helatte.listarPagaresPorCliente(clienteId);
      setPagares(data);
      if (!pagareSeleccionado && data.length > 0) {
        setPagareSeleccionado(data[0]);
      }
      if (pagareSeleccionado) {
        const actualizado = data.find((p) => p.id === pagareSeleccionado.id) ?? null;
        setPagareSeleccionado(actualizado);
      }
      return data;
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los pagarés del cliente.');
      return [];
    } finally {
      setCargandoPagares(false);
    }
  };

  useEffect(() => {
    cargarClientes().catch(() => setError('No se pudieron cargar los clientes con saldo.'));
  }, [cargarClientes]);

  useEffect(() => {
    if (!clienteSeleccionado) return;
    const actualizado = clientes.find((c) => c.id === clienteSeleccionado.id);
    if (!actualizado) {
      setClienteSeleccionado(null);
      setPagares([]);
      setPagareSeleccionado(null);
      return;
    }
    if (actualizado !== clienteSeleccionado) {
      setClienteSeleccionado(actualizado);
    }
  }, [clienteSeleccionado, clientes]);

  const clientesConSaldo = useMemo(() => clientes.filter((c) => c.saldo > 0), [clientes]);

  const seleccionarCliente = (cliente: Customer) => {
    const actualizado = clientes.find((c) => c.id === cliente.id) ?? cliente;
    setClienteSeleccionado(actualizado);
    setMensaje('');
    setPagares([]);
    setPagareSeleccionado(null);
    setPagareParaAbono(null);
    setMostrandoModalAbono(false);
    cargarPagares(cliente.id);
  };

  const abrirModalPagare = (cliente: Customer) => {
    setClienteSeleccionado(cliente);
    setMonto(cliente.saldo.toString());
    setMensaje('');
    setError('');
    setMostrandoModal(true);
  };

  const cerrarModal = () => {
    setMostrandoModal(false);
    setMonto('');
  };

  const cerrarModalAbono = () => {
    setMostrandoModalAbono(false);
    setMontoAbono('');
    setPagareParaAbono(null);
  };

  const generarPagare = async () => {
    if (!clienteSeleccionado || guardando) return;

    const montoNumero = Number(monto);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (montoNumero > clienteSeleccionado.saldo) {
      setError('El monto no puede superar el saldo disponible.');
      return;
    }

    setGuardando(true);
    setError('');
    setMensaje('');
    try {
      await helatte.crearPagare({ customerId: clienteSeleccionado.id, monto: montoNumero });
      setMensaje('Pagaré generado correctamente.');
      cerrarModal();
      await Promise.all([cargarPagares(clienteSeleccionado.id), cargarClientes()]);
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el pagaré.');
    } finally {
      setGuardando(false);
    }
  };

  const abrirModalAbono = (pagare: PagareConAbonos) => {
    setPagareParaAbono(pagare);
    setMontoAbono(pagare.monto.toString());
    setMensaje('');
    setError('');
    setMostrandoModalAbono(true);
  };

  const registrarAbono = async () => {
    if (!pagareParaAbono || !clienteSeleccionado || guardandoAbono) return;

    const montoNumero = Number(montoAbono);
    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      setError('Ingresa un monto válido para el abono.');
      return;
    }
    if (montoNumero > pagareParaAbono.monto) {
      setError('El abono no puede ser mayor al monto pendiente del pagaré.');
      return;
    }

    setGuardandoAbono(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await helatte.registrarAbonoPagare({
        promissoryNoteId: pagareParaAbono.id,
        monto: montoNumero
      });

      setMensaje('Abono registrado correctamente.');
      cerrarModalAbono();

      const nuevosPagares = await cargarPagares(clienteSeleccionado.id);
      setPagareSeleccionado(nuevosPagares.find((p) => p.id === resultado.pagare.id) ?? null);
      await cargarClientes();
    } catch (err) {
      console.error(err);
      setError('No se pudo registrar el abono.');
    } finally {
      setGuardandoAbono(false);
    }
  };

  const pagaresVigentes = useMemo(() => pagares.filter((p) => p.estado === 'vigente'), [pagares]);
  const pagaresHistoricos = useMemo(() => pagares.filter((p) => p.estado !== 'vigente'), [pagares]);
  const errorActivo = error || errorClientes;

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Créditos y pagarés</h2>

      {errorActivo && <div className="rounded bg-blush/16 text-blushDeep px-3 py-2 text-sm">{errorActivo}</div>}
      {mensaje && <div className="rounded-xl border border-mint/35 bg-mint/20 text-mintDeep px-3 py-2 text-sm">{mensaje}</div>}

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">Clientes con saldo</p>
          {cargandoClientes && <span className="text-xs text-text/55">Cargando...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr className="text-left text-text/65">
                <th className="py-1">Cliente</th>
                <th className="py-1">Saldo</th>
                <th className="py-1">Límite</th>
                <th className="py-1">Estado</th>
                <th className="py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientesConSaldo.length === 0 && !cargandoClientes && (
                <tr>
                  <td className="py-2 text-text/55" colSpan={5}>
                    No hay clientes con saldo pendiente.
                  </td>
                </tr>
              )}
              {clientesConSaldo.map((c) => (
                <tr key={c.id} className="border-b border-borderSoft/80">
                  <td className="py-2">{c.nombre}</td>
                  <td>${c.saldo.toFixed(2)}</td>
                  <td>${c.limite.toFixed(2)}</td>
                  <td className="capitalize">{c.estado}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        className="btn btn-secondary px-3 py-1 text-xs"
                        onClick={() => seleccionarCliente(c)}
                      >
                        Ver pagarés
                      </button>
                      <button
                        className="px-3 py-1 text-xs rounded btn btn-primary"
                        onClick={() => abrirModalPagare(c)}
                      >
                        Generar pagaré
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text/55">El pagaré inicia vigente y no descuenta el saldo.</p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">
            Pagarés {clienteSeleccionado ? `de ${clienteSeleccionado.nombre}` : 'por cliente'}
          </p>
          {clienteSeleccionado && (
            <span className="text-xs text-text/55">
              Saldo disponible: ${clienteSeleccionado.saldo.toFixed(2)}
            </span>
          )}
        </div>
        {!clienteSeleccionado && <p className="text-sm text-text/55">Selecciona un cliente para ver sus pagarés.</p>}
        {clienteSeleccionado && (
          <div className="overflow-x-auto">
            {cargandoPagares ? (
              <p className="text-sm text-text/55">Cargando pagarés...</p>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Pagarés vigentes</p>
                  <table className="table">
                    <thead>
                      <tr className="text-left text-text/65">
                        <th className="py-1">Monto pendiente</th>
                        <th className="py-1">Fecha</th>
                        <th className="py-1">Abonos</th>
                        <th className="py-1">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagaresVigentes.length === 0 && (
                        <tr>
                          <td className="py-2 text-text/55" colSpan={4}>
                            No hay pagarés vigentes para este cliente.
                          </td>
                        </tr>
                      )}
                      {pagaresVigentes.map((p) => (
                        <tr key={p.id} className="border-b border-borderSoft/80">
                          <td className="py-2">${p.monto.toFixed(2)}</td>
                          <td>{new Date(p.fecha).toLocaleDateString('es-MX')}</td>
                          <td>{p.abonos?.length ?? 0}</td>
                          <td className="py-2">
                            <div className="flex gap-2 flex-wrap">
                              <button
                                className="btn btn-secondary px-3 py-1 text-xs"
                                onClick={() => setPagareSeleccionado(p)}
                              >
                                Ver historial
                              </button>
                              <button
                                className="px-3 py-1 text-xs rounded btn btn-primary disabled:opacity-60"
                                disabled={p.monto <= 0}
                                onClick={() => abrirModalAbono(p)}
                              >
                                Registrar abono
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagaresHistoricos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Historial de pagarés</p>
                    <table className="table">
                      <thead>
                        <tr className="text-left text-text/65">
                          <th className="py-1">Monto final</th>
                          <th className="py-1">Fecha</th>
                          <th className="py-1">Estado</th>
                          <th className="py-1">Abonos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagaresHistoricos.map((p) => (
                          <tr key={p.id} className="border-b border-borderSoft/80">
                            <td className="py-2">${p.monto.toFixed(2)}</td>
                            <td>{new Date(p.fecha).toLocaleDateString('es-MX')}</td>
                            <td className="capitalize">{p.estado}</td>
                            <td>{p.abonos?.length ?? 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-medium">Historial de abonos</p>
          {pagareSeleccionado && (
            <span className="text-xs text-text/55">
              Pagaré #{pagareSeleccionado.id} · Estado {pagareSeleccionado.estado}
            </span>
          )}
        </div>

        {!pagareSeleccionado ? (
          <p className="text-sm text-text/55">Selecciona un pagaré para ver sus abonos.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-text/65">
              Monto pendiente: <span className="font-semibold">${pagareSeleccionado.monto.toFixed(2)}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr className="text-left text-text/65">
                    <th className="py-1">Monto</th>
                    <th className="py-1">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {(pagareSeleccionado.abonos ?? []).length === 0 ? (
                    <tr>
                      <td className="py-2 text-text/55" colSpan={2}>
                        Sin abonos registrados.
                      </td>
                    </tr>
                  ) : (
                    pagareSeleccionado.abonos?.map((a) => (
                      <tr key={a.id} className="border-b border-borderSoft/80">
                        <td className="py-2">${a.monto.toFixed(2)}</td>
                        <td>{new Date(a.fecha).toLocaleDateString('es-MX')}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {mostrandoModal && clienteSeleccionado && (
        <div className="fixed inset-0 bg-text/24 flex items-center justify-center z-10">
          <div className="modal-panel p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Generar pagaré</h3>
            <p className="text-sm text-text/65">
              Cliente: <span className="font-medium">{clienteSeleccionado.nombre}</span>
            </p>
            <div className="space-y-2">
              <label className="text-sm text-text/75">Monto (máximo ${clienteSeleccionado.saldo.toFixed(2)})</label>
              <input
                type="number"
                className="w-full border border-borderSoft rounded-xl px-3 py-2"
                value={monto}
                min={0}
                max={clienteSeleccionado.saldo}
                step="0.01"
                onChange={(e) => setMonto(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-secondary px-3 py-2 text-sm" onClick={cerrarModal}>
                Cancelar
              </button>
              <button
                className="btn btn-primary px-3 py-2 text-sm disabled:opacity-60"
                disabled={guardando}
                onClick={generarPagare}
              >
                {guardando ? 'Guardando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrandoModalAbono && clienteSeleccionado && pagareParaAbono && (
        <div className="fixed inset-0 bg-text/24 flex items-center justify-center z-10">
          <div className="modal-panel p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-semibold">Registrar abono</h3>
            <p className="text-sm text-text/65">
              Cliente: <span className="font-medium">{clienteSeleccionado.nombre}</span>
            </p>
            <p className="text-sm text-text/65">
              Pagaré #{pagareParaAbono.id} · Pendiente ${pagareParaAbono.monto.toFixed(2)}
            </p>
            <div className="space-y-2">
              <label className="text-sm text-text/75">
                Monto (máximo ${pagareParaAbono.monto.toFixed(2)})
              </label>
              <input
                type="number"
                className="w-full border border-borderSoft rounded-xl px-3 py-2"
                value={montoAbono}
                min={0}
                max={pagareParaAbono.monto}
                step="0.01"
                onChange={(e) => setMontoAbono(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-secondary px-3 py-2 text-sm" onClick={cerrarModalAbono}>
                Cancelar
              </button>
              <button
                className="btn btn-primary px-3 py-2 text-sm disabled:opacity-60"
                disabled={guardandoAbono}
                onClick={registrarAbono}
              >
                {guardandoAbono ? 'Guardando...' : 'Confirmar abono'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
