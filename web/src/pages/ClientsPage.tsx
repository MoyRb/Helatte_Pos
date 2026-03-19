import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid';
import { usePos, Client } from '../context/PosContext';

const emptyClient: Omit<Client, 'id'> = { name: '', phone: '', address: '', active: true, notes: '' };

export const ClientsPage: React.FC = () => {
  const { clients, fridgeLoans, addClient, updateClient, deleteClient } = usePos();
  const [form, setForm] = useState<Omit<Client, 'id'>>(emptyClient);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients],
  );

  useEffect(() => {
    if (!sortedClients.length) {
      setSelectedClientId(null);
      return;
    }

    if (!selectedClientId || !sortedClients.find((client) => client.id === selectedClientId)) {
      setSelectedClientId(sortedClients[0].id);
    }
  }, [sortedClients, selectedClientId]);

  const selectedClient = useMemo(
    () => sortedClients.find((client) => client.id === selectedClientId) ?? null,
    [selectedClientId, sortedClients],
  );

  const clientLoans = useMemo(
    () => fridgeLoans.filter((loan) => loan.clientId === selectedClientId),
    [fridgeLoans, selectedClientId],
  );

  const filteredLoans = useMemo(
    () => (showActiveOnly ? clientLoans.filter((loan) => loan.status === 'entregado') : clientLoans),
    [clientLoans, showActiveOnly],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (editingId) {
      updateClient(editingId, form);
    } else {
      addClient(form);
    }

    setForm(emptyClient);
    setEditingId(null);
  };

  const startEdit = (client: Client) => {
    setEditingId(client.id);
    setForm({
      name: client.name,
      phone: client.phone,
      address: client.address,
      active: client.active,
      notes: client.notes,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyClient);
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{editingId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
          {editingId && (
            <button onClick={cancelEdit} className="text-sm text-accent underline">
              Cancelar edición
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Nombre
            <input
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Teléfono
            <input
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Opcional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Dirección
            <input
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Opcional"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Notas
            <input
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((prev) => ({ ...prev, active: e.target.checked }))}
            />
            Activo
          </label>
          <button type="submit" className="btn-primary md:col-span-4">
            {editingId ? 'Guardar cambios' : 'Agregar cliente'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Clientes</h2>
          <span className="text-sm text-coffee/70">{clients.length} registrados</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-coffee/70">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2">Teléfono</th>
                <th className="pb-2">Dirección</th>
                <th className="pb-2">Notas</th>
                <th className="pb-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSoft">
              {sortedClients.map((client) => (
                <tr
                  key={client.id}
                  className={`hover:bg-secondarySoft/60 ${selectedClientId === client.id ? 'bg-secondarySoft/50' : ''}`}
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <td className="py-3 font-medium">{client.name}</td>
                  <td className="py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        client.active ? 'bg-mint/30 text-accent' : 'bg-blush/40 text-coffee'
                      }`}
                    >
                      {client.active ? (
                        <CheckCircleIcon className="h-4 w-4" />
                      ) : (
                        <XCircleIcon className="h-4 w-4" />
                      )}
                      {client.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-3 text-coffee/80">{client.phone || '-'}</td>
                  <td className="py-3 text-coffee/80">{client.address || '-'}</td>
                  <td className="py-3 text-coffee/80">{client.notes || '-'}</td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(client)}
                        className="px-3 py-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50 text-xs font-semibold"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => deleteClient(client.id)}
                        className="px-3 py-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50 text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedClients.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-coffee/70">
                    Aún no hay clientes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Detalle del cliente</h2>
          <div className="flex items-center gap-2 text-sm text-coffee/70">
            <span className="font-semibold">Refris del cliente</span>
            <div className="flex rounded-lg overflow-hidden border border-borderSoft text-xs font-semibold">
              <button
                className={`px-3 py-1 ${showActiveOnly ? 'bg-mint/20 text-accent' : 'bg-surface text-coffee'}`}
                onClick={() => setShowActiveOnly(true)}
              >
                Activos
              </button>
              <button
                className={`px-3 py-1 ${!showActiveOnly ? 'bg-mint/20 text-accent' : 'bg-surface text-coffee'}`}
                onClick={() => setShowActiveOnly(false)}
              >
                Todos
              </button>
            </div>
          </div>
        </div>

        {!selectedClient && <p className="text-sm text-coffee/70">Selecciona o crea un cliente.</p>}

        {selectedClient && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div className="md:col-span-2">
                <p className="text-coffee/70">Nombre</p>
                <p className="font-semibold">{selectedClient.name}</p>
              </div>
              <div>
                <p className="text-coffee/70">Teléfono</p>
                <p className="font-semibold">{selectedClient.phone || 'No registrado'}</p>
              </div>
              <div>
                <p className="text-coffee/70">Dirección</p>
                <p className="font-semibold">{selectedClient.address || 'No registrada'}</p>
              </div>
              <div>
                <p className="text-coffee/70">Estado</p>
                <p className="font-semibold">{selectedClient.active ? 'Activo' : 'Inactivo'}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-coffee/70">Notas</p>
                <p className="font-semibold">{selectedClient.notes || 'Sin notas'}</p>
              </div>
            </div>

            <div className="space-y-3">
              {!filteredLoans.length && (
                <p className="text-sm text-coffee/70">No hay refris para este cliente con el filtro seleccionado.</p>
              )}

              {filteredLoans
                .sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime())
                .map((loan) => (
                  <div
                    key={loan.id}
                    className="border border-borderSoft rounded-lg p-4 bg-surface shadow-sm flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-xs text-coffee/70">Entrega: {new Date(loan.deliveryDate).toLocaleDateString()}</p>
                      <p className="font-semibold">Refrigerador en comodato</p>
                      <p className="text-sm text-coffee/70">Cantidad: {loan.quantity}</p>
                    </div>
                    <div className="flex flex-col gap-2 text-sm items-end">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          loan.status === 'entregado' ? 'bg-mint/30 text-accent' : 'bg-blush/40 text-coffee'
                        }`}
                      >
                        {loan.status === 'entregado' ? 'Activo' : 'Devuelto'}
                      </span>
                      {loan.status === 'devuelto' && (
                        <p className="text-xs text-coffee/70">
                          Devuelto: {loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : 'No registrada'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
