import React, { useMemo, useState } from 'react';
import { ConfirmPinModal } from '../components/ConfirmPinModal';
import { FinanceMovement, usePos } from '../context/PosContext';

const today = new Date().toISOString().slice(0, 10);

type MovementForm = { concept: string; amount: number; kind: 'entrada' | 'salida'; date: string };

const emptyForm: MovementForm = { concept: '', amount: 0, kind: 'entrada', date: today };

export const FinancePage: React.FC = () => {
  const { financeMovements, addFinanceMovement, deleteCashMovement } = usePos();
  const [forms, setForms] = useState<Record<'chica' | 'grande', MovementForm>>({
    chica: emptyForm,
    grande: emptyForm,
  });
  const [movementToDelete, setMovementToDelete] = useState<FinanceMovement | null>(null);

  const balances = useMemo(() => {
    return ['chica', 'grande'].reduce(
      (acc, box) => ({
        ...acc,
        [box]: financeMovements
          .filter((movement) => movement.box === box)
          .reduce((total, movement) =>
            movement.kind === 'entrada' ? total + movement.amount : total - movement.amount,
          0),
      }),
      { chica: 0, grande: 0 } as Record<'chica' | 'grande', number>,
    );
  }, [financeMovements]);

  const registerMovement = (box: 'chica' | 'grande') => (event: React.FormEvent) => {
    event.preventDefault();
    const form = forms[box];
    if (!form.concept.trim() || form.amount <= 0) return;

    addFinanceMovement({ ...form, box, source: 'manual', amount: Number(form.amount) });
    setForms((prev) => ({ ...prev, [box]: { ...emptyForm, date: form.date } }));
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const recentMovements = (box: 'chica' | 'grande') =>
    [...financeMovements]
      .filter((movement) => movement.box === box)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);

  const confirmDeletion = async () => {
    if (!movementToDelete) return;
    deleteCashMovement(movementToDelete.box, movementToDelete.id);
    setMovementToDelete(null);
  };

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {[{ key: 'chica', title: 'Caja chica' }, { key: 'grande', title: 'Caja grande' }].map(
          ({ key, title }) => {
            const boxKey = key as 'chica' | 'grande';
          const form = forms[boxKey];
          return (
            <div key={key} className="card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-coffee/70">{title}</p>
                  <p className="text-3xl font-bold">${balances[boxKey].toFixed(2)}</p>
                  <p className="text-xs text-coffee/60">
                    {boxKey === 'chica'
                      ? 'Entradas y salidas manuales'
                      : 'Ventas automáticas + movimientos manuales'}
                  </p>
                </div>
                <span className="badge-info">
                  {recentMovements(boxKey).length} movimientos recientes
                </span>
              </div>

              <form onSubmit={registerMovement(boxKey)} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Concepto
                  <input
                    className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
                    value={form.concept}
                    onChange={(e) =>
                      setForms((prev) => ({ ...prev, [boxKey]: { ...form, concept: e.target.value } }))
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Monto
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
                    value={form.amount}
                    onChange={(e) =>
                      setForms((prev) => ({ ...prev, [boxKey]: { ...form, amount: Number(e.target.value) } }))
                    }
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  Fecha
                  <input
                    type="date"
                    className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
                    value={form.date}
                    onChange={(e) => setForms((prev) => ({ ...prev, [boxKey]: { ...form, date: e.target.value } }))}
                    required
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Tipo
                  <div className="flex items-center gap-3">
                    {['entrada', 'salida'].map((type) => (
                      <label key={type} className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="radio"
                          name={`${boxKey}-type`}
                          value={type}
                          checked={form.kind === type}
                          onChange={() =>
                            setForms((prev) => ({ ...prev, [boxKey]: { ...form, kind: type as MovementForm['kind'] } }))
                          }
                        />
                        {type === 'entrada' ? 'Entrada' : 'Salida'}
                      </label>
                    ))}
                  </div>
                </label>
                <button type="submit" className="btn-primary md:col-span-2">Registrar movimiento</button>
              </form>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-coffee">Últimos movimientos</h3>
                {recentMovements(boxKey).map((movement) => {
                  const isSaleMovement = movement.source === 'sale' || movement.source === 'venta';

                  return (
                    <div
                      key={movement.id}
                      className="border border-borderSoft rounded-lg px-4 py-3 flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold">{movement.concept}</p>
                        <p className="text-xs text-coffee/70">{formatDate(movement.date)}</p>
                        <p className="text-xs text-coffee/60 capitalize">
                          {isSaleMovement ? 'Venta automática' : 'Manual'} - {movement.kind}
                        </p>
                        {isSaleMovement && (
                          <p className="text-xs text-blushDeep">
                            Este movimiento proviene de una venta. Para corregirlo, ajusta o elimina la venta.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`font-semibold ${
                            movement.kind === 'entrada' ? 'text-mintDeep' : 'text-blushDeep'
                          }`}
                        >
                          {movement.kind === 'entrada' ? '+' : '-'}${movement.amount.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="text-sm font-semibold text-blushDeep hover:text-primaryHover disabled:text-coffee/50 disabled:cursor-not-allowed"
                          disabled={isSaleMovement}
                          onClick={() => setMovementToDelete(movement)}
                          title={
                            isSaleMovement
                              ? 'No puedes eliminar movimientos generados por ventas.'
                              : 'Eliminar movimiento'
                          }
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!recentMovements(boxKey).length && (
                  <p className="text-sm text-coffee/70">Aún no hay movimientos en esta caja.</p>
                )}
              </div>
            </div>
          );
        },
      )}
      </div>
      {movementToDelete && (
        <ConfirmPinModal
          movement={movementToDelete}
          onCancel={() => setMovementToDelete(null)}
          onConfirm={confirmDeletion}
        />
      )}
    </>
  );
};
