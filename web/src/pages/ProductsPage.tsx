import React, { useMemo, useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { usePos, Product } from '../context/PosContext';

const emptyProduct = { name: '', price: 0, stock: 0 };

export const ProductsPage: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = usePos();
  const [form, setForm] = useState<Omit<Product, 'id'>>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stockEdits, setStockEdits] = useState<Record<string, number>>({});

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return;

    if (editingId) {
      updateProduct(editingId, form);
    } else {
      addProduct({ ...form, price: Number(form.price), stock: Number(form.stock) });
    }

    setForm(emptyProduct);
    setEditingId(null);
  };

  const startEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({ name: product.name, price: product.price, stock: product.stock });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyProduct);
  };

  const changeStockValue = (productId: string, value: number) => {
    const safeValue = Number.isNaN(value) ? 0 : value;
    setStockEdits((prev) => ({ ...prev, [productId]: Math.max(0, safeValue) }));
  };

  const adjustStock = (productId: string, currentStock: number, delta: number) => {
    const nextValue = (stockEdits[productId] ?? currentStock) + delta;
    changeStockValue(productId, nextValue);
  };

  const saveStock = (product: Product) => {
    const newValue = stockEdits[product.id];
    if (newValue === undefined || newValue === product.stock) return;

    const confirmed = window.confirm(
      `¿Confirmas actualizar el stock de ${product.name} de ${product.stock} a ${newValue}?`,
    );
    if (!confirmed) return;

    updateProduct(product.id, { stock: newValue });
    setStockEdits((prev) => {
      const updated = { ...prev };
      delete updated[product.id];
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{editingId ? 'Editar producto' : 'Nuevo producto'}</h2>
          {editingId && (
            <button onClick={cancelEdit} className="text-sm text-accent underline">
              Cancelar edición
            </button>
          )}
        </div>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Nombre
            <input
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Precio
            <input
              type="number"
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.price}
              min={0}
              step={0.01}
              onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Stock
            <input
              type="number"
              className="border border-borderSoft rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-mint"
              value={form.stock}
              min={0}
              step={1}
              onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
              required
            />
          </label>
          <button type="submit" className="btn-primary h-fit">
            {editingId ? 'Guardar cambios' : 'Crear producto'}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Inventario</h2>
          <span className="text-sm text-coffee/70">{products.length} productos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-coffee/70">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Precio</th>
                <th className="pb-2">Stock</th>
                <th className="pb-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSoft">
              {sortedProducts.map((product) => {
                const lowStock = product.stock <= 5;
                const editedStock = stockEdits[product.id] ?? product.stock;
                return (
                  <tr key={product.id} className={`hover:bg-secondarySoft/60 ${lowStock ? 'bg-blush/10' : ''}`}>
                    <td className="py-3 font-medium">{product.name}</td>
                    <td className="py-3">${product.price.toFixed(2)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            lowStock ? 'bg-blush/50 text-coffee' : 'bg-secondarySoft text-coffee/80'
                          }`}
                        >
                          {product.stock} uds
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => adjustStock(product.id, product.stock, -1)}
                            className="p-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50"
                            aria-label="Disminuir stock"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={0}
                            className="w-20 border border-borderSoft rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-mint"
                            value={editedStock}
                            onChange={(e) => changeStockValue(product.id, Number(e.target.value))}
                          />
                          <button
                            onClick={() => adjustStock(product.id, product.stock, 1)}
                            className="p-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50"
                            aria-label="Aumentar stock"
                          >
                            +
                          </button>
                          <button onClick={() => saveStock(product)} className="btn-primary px-3 py-2 text-xs">
                            Actualizar
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(product)}
                          className="p-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50"
                          aria-label="Editar"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/50"
                          aria-label="Eliminar"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!sortedProducts.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-coffee/70">
                    Aún no hay productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
