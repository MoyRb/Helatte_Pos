import React, { useMemo, useState } from 'react';
import { ChevronDownIcon, EyeIcon } from '@heroicons/react/24/outline';
import { usePos } from '../context/PosContext';

export const SalesPage: React.FC = () => {
  const { sales } = usePos();
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const sortedSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [sales],
  );

  const toggleExpanded = (saleId: string) => {
    setExpandedSaleId((current) => (current === saleId ? null : saleId));
  };

  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Historial de ventas</h2>
          <p className="text-sm text-coffee/70">Ventas registradas en el punto de venta</p>
        </div>
        <span className="text-sm text-coffee/70">{sales.length} ventas</span>
      </div>

      {!sortedSales.length && <p className="text-sm text-coffee/70">Aún no hay ventas registradas.</p>}

      <div className="space-y-3">
        {sortedSales.map((sale) => {
          const isExpanded = expandedSaleId === sale.id;
          return (
            <div key={sale.id} className="border border-borderSoft rounded-lg p-4 bg-surface shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-coffee/70">{formatDate(sale.date)}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-lg">Total: ${sale.total.toFixed(2)}</p>
                    {sale.folio && (
                      <span className="text-xs px-2 py-1 rounded-full bg-secondarySoft text-coffee/80">Folio: {sale.folio}</span>
                    )}
                    <span className="text-xs px-2 py-1 rounded-full bg-mint/20 text-coffee font-semibold uppercase">
                      {sale.channel === 'wholesale' ? 'Mayoreo' : 'POS'}
                    </span>
                  </div>
                  <p className="text-xs text-coffee/70">{sale.items.length} productos</p>
                  {(sale.clientId || sale.clientName) && (
                    <p className="text-xs text-coffee/70">
                      Cliente: {sale.clientName || sale.clientId}
                    </p>
                  )}
                  {sale.notes && <p className="text-xs text-coffee/70">Notas: {sale.notes}</p>}
                </div>
                <button
                  onClick={() => toggleExpanded(sale.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondarySoft text-coffee hover:bg-blush/40"
                >
                  <EyeIcon className="h-5 w-5" />
                  {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                  <ChevronDownIcon className={`h-4 w-4 transition ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {isExpanded && (
                <div className="mt-4 border-t border-borderSoft pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 text-xs text-coffee/70 font-semibold pb-2">
                    <span>Producto</span>
                    <span className="md:text-center">Cantidad</span>
                    <span className="md:text-right">Precio unitario</span>
                    <span className="md:text-right">Subtotal</span>
                  </div>
                  <div className="divide-y divide-borderSoft text-sm">
                    {sale.items.map((item) => (
                      <div key={item.productId} className="grid grid-cols-1 md:grid-cols-4 py-2">
                        <span className="font-medium">{item.name}</span>
                        <span className="md:text-center">{item.quantity}</span>
                        <span className="md:text-right">${item.price.toFixed(2)}</span>
                        <span className="md:text-right">${(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
