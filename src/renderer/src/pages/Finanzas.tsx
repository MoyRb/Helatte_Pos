import { useEffect, useMemo, useState } from 'react';

type CashMovement = {
  id: number;
  cashBoxId: number;
  tipo: 'ingreso' | 'egreso' | string;
  concepto: string;
  monto: number;
  fecha: string;
};

type CashBox = {
  id: number;
  nombre: string;
  tipo: 'chica' | 'grande' | string;
  movimientos: CashMovement[];
};

export default function Finanzas() {
  const [cajas, setCajas] = useState<CashBox[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tipoCaja, setTipoCaja] = useState<'chica' | 'grande'>('chica');
  const [form, setForm] = useState({
    concepto: '',
    monto: '',
    fecha: new Date().toISOString().slice(0, 16) // datetime-local
  });

  const cargar = async () => {
    try {
      setError(null);
      setCargando(true);
      const data = await window.helatte.listarCajas();
      setCajas((data ?? []) as CashBox[]);
    } catch (e: any) {
      console.error('Error cargando cajas:', e);
      setError(e?.message ?? 'Error cargando cajas');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const cajaActual = useMemo(
    () => cajas.find((c) => c.tipo === tipoCaja),
    [cajas, tipoCaja]
  );

  const totales = useMemo(() => {
    if (!cajaActual) return { ingresos: 0, egresos: 0, balance: 0 };

    const ingresos = (cajaActual.movimientos ?? [])
      .filter((m) => m.tipo === 'ingreso')
      .reduce((s, m) => s + Number(m.monto || 0), 0);

    const egresos = (cajaActual.movimientos ?? [])
      .filter((m) => m.tipo === 'egreso')
      .reduce((s, m) => s + Number(m.monto || 0), 0);

    return { ingresos, egresos, balance: ingresos - egresos };
  }, [cajaActual]);

  const puedeGuardar =
    !!cajaActual &&
    form.concepto.trim().length > 0 &&
    form.monto.trim().length > 0 &&
    !Number.isNaN(Number(form.monto));

  const guardarMovimiento = async (tipo: 'ingreso' | 'egreso') => {
    if (!puedeGuardar || !cajaActual) return;

    try {
      setError(null);

      await window.helatte.crearMovimiento({
        cashBoxId: cajaActual.id,
        tipo,
        concepto: form.concepto.trim(),
        monto: Number(form.monto),
        fecha: form.fecha ? new Date(form.fecha).toISOString() : undefined
      });

      setForm({
        concepto: '',
        monto: '',
        fecha: new Date().toISOString().slice(0, 16)
      });

      await cargar();
    } catch (e: any) {
      console.error('Error creando movimiento:', e);
      setError(e?.message ?? 'Error creando movimiento');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Cajas y movimientos</h2>

        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${tipoCaja === 'chica' ? 'btn-primary' : ''}`}
            onClick={() => setTipoCaja('chica')}
          >
            Caja chica
          </button>
          <button
            type="button"
            className={`btn ${tipoCaja === 'grande' ? 'btn-primary' : ''}`}
            onClick={() => setTipoCaja('grande')}
          >
            Caja grande
          </button>
        </div>
      </div>

      {error ? (
        <div className="card p-3 border border-red-300">
          <div className="font-semibold">Error</div>
          <div className="text-sm opacity-80">{error}</div>
        </div>
      ) : null}

      {cargando || !cajaActual ? (
        <div className="card p-4">Cargando movimientos...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card p-4">
              <div className="text-sm opacity-70">Ingresos</div>
              <div className="text-2xl font-semibold">
                ${totales.ingresos.toFixed(2)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm opacity-70">Egresos</div>
              <div className="text-2xl font-semibold">
                ${totales.egresos.toFixed(2)}
              </div>
            </div>
            <div className="card p-4">
              <div className="text-sm opacity-70">Balance</div>
              <div className="text-2xl font-semibold">
                ${totales.balance.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                className="input"
                placeholder="Concepto"
                value={form.concepto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, concepto: e.target.value }))
                }
              />
              <input
                className="input"
                placeholder="Monto"
                inputMode="decimal"
                value={form.monto}
                onChange={(e) =>
                  setForm((f) => ({ ...f, monto: e.target.value }))
                }
              />
              <input
                className="input"
                type="datetime-local"
                value={form.fecha}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fecha: e.target.value }))
                }
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!puedeGuardar}
                onClick={() => guardarMovimiento('ingreso')}
              >
                Agregar ingreso
              </button>
              <button
                type="button"
                className="btn"
                disabled={!puedeGuardar}
                onClick={() => guardarMovimiento('egreso')}
              >
                Agregar gasto
              </button>
            </div>
          </div>

          <div className="card p-4">
            <div className="font-semibold mb-2">Movimientos</div>

            {cajaActual.movimientos.length === 0 ? (
              <div className="text-sm opacity-70">Sin movimientos todavía.</div>
            ) : (
              <div className="overflow-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Concepto</th>
                      <th>Monto</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cajaActual.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td>{m.tipo}</td>
                        <td>{m.concepto}</td>
                        <td>${Number(m.monto).toFixed(2)}</td>
                        <td>{new Date(m.fecha).toLocaleString('es-MX')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
