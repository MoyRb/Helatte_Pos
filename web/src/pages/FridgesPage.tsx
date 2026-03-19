import React, { useMemo, useState } from 'react';
import { usePos } from '../context/PosContext';

const today = new Date().toISOString().slice(0, 10);

export const FridgesPage: React.FC = () => {
  const { clients, fridgeLoans, addFridgeLoan, markFridgeReturned } = usePos();
  const [form, setForm] = useState({ clientId: '', quantity: 1, deliveryDate: today });

  const sortedLoans = useMemo(
    () => [...fridgeLoans].sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime()),
    [fridgeLoans],
  );

  const getClientName = (clientId: string) => clients.find((client) => client.id === clientId)?.name ?? 'Cliente';

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.clientId || form.quantity <= 0) return;

    addFridgeLoan({ clientId: form.clientId, quantity: Number(form.quantity), deliveryDate: form.deliveryDate });
    setForm({ clientId: '', quantity: 1, deliveryDate: today });
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Asignar refris</h2>
          <span className="text-sm text-coffee/70">Entrega y devolución</span>
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Cliente
            <select
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              value={form.clientId}
              onChange={(e) => setForm((prev) => ({ ...prev, clientId: e.target.value }))}
              required
            >
              <option value="">Selecciona un cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Cantidad
            <input
              type="number"
              min={1}
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Fecha de entrega
            <input
              type="date"
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky/30"
              value={form.deliveryDate}
              onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
              required
            />
          </label>
          <button type="submit" className="btn-primary md:col-span-4">
            Registrar entrega
          </button>
        </form>
        {!clients.length && (
          <p className="text-sm text-coffee/70 mt-2">Crea clientes primero para asignar refris.</p>
        )}
      </div>

      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Historial de refris</h2>
          <span className="text-sm text-coffee/70">{fridgeLoans.length} registros</span>
        </div>

        {!sortedLoans.length && <p className="text-sm text-coffee/70">Aún no hay refris asignados.</p>}

        <div className="space-y-3">
          {sortedLoans.map((loan) => (
            <div key={loan.id} className="border border-borderSoft rounded-lg p-4 bg-surface shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-coffee/70">{new Date(loan.deliveryDate).toLocaleDateString()}</p>
                <p className="font-semibold">{getClientName(loan.clientId)}</p>
                <p className="text-sm text-coffee/70">{loan.quantity} refris</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    loan.status === 'entregado' ? 'bg-mint/35 text-mintDeep' : 'bg-butter/35 text-butterDeep'
                  }`}
                >
                  {loan.status === 'entregado' ? 'En campo' : 'Devuelto'}
                </span>
                {loan.status !== 'devuelto' && (
                  <button
                    onClick={() => markFridgeReturned(loan.id)}
                    className="px-3 py-2 rounded-lg bg-secondarySoft text-coffee hover:bg-sky/25 text-xs font-semibold"
                  >
                    Marcar devuelto
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
