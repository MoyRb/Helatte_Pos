import React, { useMemo, useState } from 'react';
import { usePos } from '../context/PosContext';

const today = new Date().toISOString().slice(0, 10);

export const MaterialsPage: React.FC = () => {
  const {
    rawMaterials,
    rawMaterialMovements,
    addRawMaterial,
    deleteRawMaterial,
    recordMaterialMovement,
  } = usePos();

  const [form, setForm] = useState({ name: '', stock: 0, minStock: 0 });
  const [movementForms, setMovementForms] = useState<
    Record<string, { amount: number; type: 'entrada' | 'salida'; note: string; date: string }>
  >({});

  const lowStock = useMemo(
    () => rawMaterials.filter((material) => material.stock <= material.minStock),
    [rawMaterials],
  );

  const sortedMaterials = useMemo(
    () => [...rawMaterials].sort((a, b) => a.name.localeCompare(b.name)),
    [rawMaterials],
  );

  const sortedMovements = useMemo(
    () =>
      [...rawMaterialMovements].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8),
    [rawMaterialMovements],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    addRawMaterial({ name: form.name, stock: Number(form.stock), minStock: Number(form.minStock) });
    setForm({ name: '', stock: 0, minStock: 0 });
  };

  const recordMovement = (materialId: string) => {
    const current = movementForms[materialId] ?? { amount: 0, type: 'entrada' as const, note: '', date: today };
    if (current.amount <= 0) return;
    const result = recordMaterialMovement({
      materialId,
      type: current.type,
      amount: Number(current.amount),
      note: current.note,
      date: current.date,
    });
    if (!result.success) {
      window.alert(result.message ?? 'No se pudo registrar el movimiento');
      return;
    }
    setMovementForms((prev) => ({ ...prev, [materialId]: { ...current, amount: 0, note: '' } }));
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString();

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Materias primas</h2>
          <span className="text-sm text-coffee/70">Inventario separado de productos</span>
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
            Stock inicial
            <input
              type="number"
              min={0}
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.stock}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Alerta de stock
            <input
              type="number"
              min={0}
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.minStock}
              onChange={(e) => setForm((prev) => ({ ...prev, minStock: Number(e.target.value) }))}
              required
            />
          </label>
          <button type="submit" className="btn-primary md:col-span-4">
            Agregar materia prima
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="card p-6 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Inventario</h2>
            <span className="text-sm text-coffee/70">{rawMaterials.length} registros</span>
          </div>
          <div className="space-y-3">
            {sortedMaterials.map((material) => {
              const movementForm =
                movementForms[material.id] ?? { amount: 0, type: 'entrada' as const, note: '', date: today };
              const low = material.stock <= material.minStock;
              return (
                <div
                  key={material.id}
                  className={`border border-borderSoft rounded-lg p-4 bg-surface shadow-sm ${low ? 'ring-1 ring-blush/60' : ''}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">{material.name}</p>
                      <p className="text-xs text-coffee/70">Alerta: {material.minStock} uds</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          low ? 'bg-blush/40 text-coffee' : 'bg-secondarySoft text-coffee/80'
                        }`}
                      >
                        Stock: {material.stock}
                      </span>
                      <button
                        onClick={() => {
                          const confirmed = window.confirm(`¿Eliminar ${material.name}? Se borrarán sus movimientos.`);
                          if (confirmed) deleteRawMaterial(material.id);
                        }}
                        className="px-3 py-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50 text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3 items-end">
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Movimiento
                      <select
                        className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
                        value={movementForm.type}
                        onChange={(e) =>
                          setMovementForms((prev) => ({
                            ...prev,
                            [material.id]: { ...movementForm, type: e.target.value as typeof movementForm.type },
                          }))
                        }
                      >
                        <option value="entrada">Entrada</option>
                        <option value="salida">Salida</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Cantidad
                      <input
                        type="number"
                        min={0}
                        className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
                        value={movementForm.amount}
                        onChange={(e) =>
                          setMovementForms((prev) => ({
                            ...prev,
                            [material.id]: { ...movementForm, amount: Number(e.target.value) },
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium">
                      Fecha
                      <input
                        type="date"
                        className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
                        value={movementForm.date}
                        onChange={(e) =>
                          setMovementForms((prev) => ({
                            ...prev,
                            [material.id]: { ...movementForm, date: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
                      Nota
                      <input
                        className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
                        value={movementForm.note}
                        onChange={(e) =>
                          setMovementForms((prev) => ({
                            ...prev,
                            [material.id]: { ...movementForm, note: e.target.value },
                          }))
                        }
                        placeholder="Detalle del movimiento"
                      />
                    </label>
                    <button
                      onClick={() => recordMovement(material.id)}
                      className="btn-primary md:col-span-2"
                      disabled={movementForm.amount <= 0}
                    >
                      Guardar movimiento
                    </button>
                  </div>
                </div>
              );
            })}
            {!sortedMaterials.length && <p className="text-sm text-coffee/70">Aún no hay materias primas.</p>}
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Alertas de stock</h2>
            <span className="text-sm text-coffee/70">{lowStock.length} con alerta</span>
          </div>
          <div className="space-y-2">
            {lowStock.map((material) => (
              <div
                key={material.id}
                className="flex items-center justify-between bg-secondarySoft/70 border border-borderSoft rounded-lg px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{material.name}</p>
                  <p className="text-xs text-coffee/70">Stock actual: {material.stock}</p>
                </div>
                <span className="text-sm font-semibold text-accent">Abastecer</span>
              </div>
            ))}
            {!lowStock.length && <p className="text-sm text-coffee/70">Sin alertas por ahora.</p>}
          </div>

          <div className="border-t border-borderSoft pt-3 space-y-2">
            <h3 className="text-sm font-semibold text-coffee">Movimientos recientes</h3>
            {sortedMovements.map((movement) => {
              const materialName = rawMaterials.find((item) => item.id === movement.materialId)?.name ?? 'Materia prima';
              return (
                <div
                  key={movement.id}
                  className="flex items-center justify-between bg-surface border border-borderSoft rounded-lg px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-semibold">{materialName}</p>
                    <p className="text-xs text-coffee/70">{movement.note || 'Sin nota'}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        movement.type === 'entrada' ? 'text-accent' : 'text-coffee'
                      }`}
                    >
                      {movement.type === 'entrada' ? '+' : '-'}{movement.amount}
                    </p>
                    <p className="text-xs text-coffee/70">{formatDate(movement.date)}</p>
                  </div>
                </div>
              );
            })}
            {!sortedMovements.length && (
              <p className="text-sm text-coffee/70">Sin movimientos registrados.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
