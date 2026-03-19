import React, { useMemo, useState } from 'react';
import { CheckCircleIcon, MinusIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { usePos, Sale } from '../context/PosContext';

type CartItem = { productId: string; quantity: number };

type AlertState = { type: 'success' | 'error'; text: string } | null;

export const WholesalePage: React.FC = () => {
   const { products, clients, createWholesaleSale, nextWholesaleFolio } = usePos();
   const [search, setSearch] = useState('');
   const [cart, setCart] = useState<CartItem[]>([]);
   const [selectedClient, setSelectedClient] = useState('');
   const [customClient, setCustomClient] = useState('');
   const [notes, setNotes] = useState('');
   const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
   const [discountValue, setDiscountValue] = useState(0);
   const [ticketSale, setTicketSale] = useState<Sale | null>(null);
   const [alert, setAlert] = useState<AlertState>(null);
 
   const showAlert = (nextAlert: AlertState, duration = 2200) => {
     setAlert(nextAlert);
     if (nextAlert) {
       setTimeout(() => setAlert(null), duration);
     }
   };
 
   const filteredProducts = useMemo(() => {
     const term = search.trim().toLowerCase();
     if (!term) return products;
     return products.filter((product) => product.name.toLowerCase().includes(term));
   }, [products, search]);
 
   const addToCart = (productId: string) => {
     const product = products.find((p) => p.id === productId);
     if (!product || product.stock === 0) {
       showAlert({ type: 'error', text: 'Sin stock disponible para este producto' });
       return;
     }
 
     setCart((prev) => {
       const existing = prev.find((item) => item.productId === productId);
       if (existing) {
         if (existing.quantity >= product.stock) {
           showAlert({ type: 'error', text: 'No puedes superar el stock disponible' });
           return prev;
         }
         return prev.map((item) =>
           item.productId === productId
             ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
             : item,
         );
       }
       return [...prev, { productId, quantity: 1 }];
     });
   };
 
   const updateQuantity = (productId: string, quantity: number) => {
     const product = products.find((p) => p.id === productId);
     const maxQuantity = product ? product.stock : quantity;
     if (quantity <= 0) {
       setCart((prev) => prev.filter((item) => item.productId !== productId));
     } else {
       setCart((prev) =>
         prev.map((item) =>
           item.productId === productId
             ? { ...item, quantity: Math.min(quantity, maxQuantity) }
             : item,
         ),
       );
     }
   };
 
   const cartItems = useMemo(() => {
     return cart
       .map((item) => {
         const product = products.find((p) => p.id === item.productId);
         if (!product) return null;
         const cappedQty = Math.min(item.quantity, product.stock);
         if (cappedQty <= 0) return null;
         return {
           ...item,
           name: product.name,
           price: product.price,
           stock: product.stock,
           quantity: cappedQty,
           subtotal: cappedQty * product.price,
         };
       })
       .filter(Boolean) as Array<{
       productId: string;
       quantity: number;
       name: string;
       price: number;
       stock: number;
       subtotal: number;
     }>;
   }, [cart, products]);
 
   const cartHasStockIssue = cartItems.some((item) => item.quantity > item.stock);
   const preDiscountTotal = cartItems.reduce((acc, item) => acc + item.subtotal, 0);
   const discountAmount = useMemo(() => {
     if (discountValue <= 0) return 0;
     if (discountType === 'percent') return Math.min(discountValue, 100) * (preDiscountTotal / 100);
     return discountValue;
   }, [discountType, discountValue, preDiscountTotal]);
   const total = Math.max(preDiscountTotal - discountAmount, 0);
 
   const resetForm = () => {
     setCart([]);
     setSelectedClient('');
     setCustomClient('');
     setNotes('');
     setDiscountValue(0);
     setDiscountType('amount');
   };
 
   const confirmSale = () => {
     if (!cartItems.length) {
       showAlert({ type: 'error', text: 'Agrega productos antes de confirmar' });
       return;
     }
 
     const stockIssues = cartItems.find((item) => item.quantity > item.stock || item.stock === 0);
     if (stockIssues) {
       showAlert({ type: 'error', text: `Stock insuficiente para ${stockIssues.name}` });
       return;
     }
 
     const saleClientName = selectedClient ? '' : customClient.trim();
 
     const result = createWholesaleSale({
       items: cartItems.map(({ productId, quantity }) => ({ productId, quantity })),
       notes,
       clientId: selectedClient || undefined,
       clientName: saleClientName || undefined,
       discount: discountValue > 0 ? { type: discountType, value: discountValue } : undefined,
     });
 
     if (result.success && result.sale) {
       showAlert({ type: 'success', text: 'Venta mayoreo registrada' });
       setTicketSale(result.sale);
       resetForm();
     } else {
       showAlert({ type: 'error', text: result.message ?? 'No se pudo registrar la venta' }, 2500);
     }
   };
 
  const ticketClient = ticketSale?.clientId
    ? clients.find((client) => client.id === ticketSale.clientId)
    : null;
  const currentClient = selectedClient
    ? clients.find((c) => c.id === selectedClient)
    : ticketClient;
 
   const renderClientLabel = () => {
    if (currentClient) return `${currentClient.name} ${currentClient.phone ? `(${currentClient.phone})` : ''}`;
    if (ticketSale?.clientName) return ticketSale.clientName;
    return 'Cliente mostrador';
  };
 
   return (
     <div className="space-y-4">
       <div className="flex items-center justify-between gap-4 flex-wrap no-print">
         <div>
           <h2 className="text-xl font-semibold">Venta Mayoreo</h2>
           <p className="text-sm text-coffee/70">Flujo separado del POS para ventas en volumen.</p>
         </div>
         <div className="text-sm text-coffee/70">Folio siguiente: {nextWholesaleFolio()}</div>
       </div>
 
       <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
         <div className="xl:col-span-2 space-y-4">
           <div className="card p-4 space-y-3 no-print">
             <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
               <label className="flex-1">
                 <span className="text-sm font-medium text-coffee/80">Cliente (opcional)</span>
                 <select
                   value={selectedClient}
                   onChange={(e) => setSelectedClient(e.target.value)}
                   className="mt-1 w-full border border-borderSoft rounded-lg px-3 py-2 bg-surface"
                 >
                   <option value="">Sin cliente</option>
                   {clients.map((client) => (
                     <option key={client.id} value={client.id}>
                       {client.name} {client.phone ? `(${client.phone})` : ''}
                     </option>
                   ))}
                 </select>
               </label>
               <label className="flex-1">
                 <span className="text-sm font-medium text-coffee/80">Cliente mostrador</span>
                 <input
                   type="text"
                   value={customClient}
                   onChange={(e) => setCustomClient(e.target.value)}
                   placeholder="Nombre libre"
                   className="mt-1 w-full border border-borderSoft rounded-lg px-3 py-2"
                   disabled={!!selectedClient}
                 />
               </label>
             </div>
 
             <div className="grid md:grid-cols-3 gap-3">
               <label className="md:col-span-2">
                 <span className="text-sm font-medium text-coffee/80">Buscar productos</span>
                 <input
                   type="text"
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   placeholder="Escribe para filtrar"
                   className="mt-1 w-full border border-borderSoft rounded-lg px-3 py-2"
                 />
               </label>
               <label>
                 <span className="text-sm font-medium text-coffee/80">Descuento (opcional)</span>
                 <div className="mt-1 flex items-center gap-2">
                   <select
                     value={discountType}
                     onChange={(e) => setDiscountType(e.target.value as 'amount' | 'percent')}
                     className="border border-borderSoft rounded-lg px-2 py-2 text-sm"
                   >
                     <option value="amount">$ Monto</option>
                     <option value="percent">% Porcentaje</option>
                   </select>
                   <input
                     type="number"
                     min={0}
                     value={discountValue}
                     onChange={(e) => setDiscountValue(Number(e.target.value))}
                     className="flex-1 border border-borderSoft rounded-lg px-3 py-2"
                   />
                 </div>
               </label>
             </div>
           </div>
 
           <div className="card p-4 space-y-3 no-print">
             <div className="flex items-center justify-between">
               <h3 className="text-lg font-semibold">Productos</h3>
               <span className="text-sm text-coffee/70">{filteredProducts.length} coincidencias</span>
             </div>
             <div className="overflow-auto max-h-[400px]">
               <table className="w-full text-sm">
                 <thead>
                   <tr className="text-left text-coffee/70">
                     <th className="py-2">Producto</th>
                     <th className="py-2">Precio</th>
                     <th className="py-2">Stock</th>
                     <th className="py-2">Acciones</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-borderSoft">
                   {filteredProducts.map((product) => {
                     const inCart = cart.find((item) => item.productId === product.id);
                     const lowStock = product.stock <= 5;
                     return (
                       <tr key={product.id} className={lowStock ? 'bg-blush/10' : ''}>
                         <td className="py-2 font-semibold">{product.name}</td>
                         <td className="py-2">${product.price.toFixed(2)}</td>
                         <td className="py-2">{product.stock}</td>
                         <td className="py-2">
                           <div className="flex items-center gap-2">
                             <button
                               className="btn-primary text-sm px-3 py-1"
                               onClick={() => addToCart(product.id)}
                               disabled={product.stock === 0}
                             >
                               <PlusIcon className="h-4 w-4" />
                             </button>
                             {inCart && <span className="text-xs text-coffee/70">En carrito: {inCart.quantity}</span>}
                           </div>
                         </td>
                       </tr>
                     );
                   })}
                   {!filteredProducts.length && (
                     <tr>
                       <td colSpan={4} className="py-3 text-center text-coffee/60">
                         No se encontraron productos.
                       </td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
           </div>
 
           <div className="card p-4 space-y-3 no-print">
             <div className="flex items-center justify-between">
               <h3 className="text-lg font-semibold">Carrito mayoreo</h3>
               {alert && (
                 <span
                   className={`text-sm px-3 py-1 rounded-full ${
                     alert.type === 'success' ? 'bg-mint/20 text-accent' : 'bg-blush/40 text-coffee'
                   }`}
                 >
                   {alert.text}
                 </span>
               )}
             </div>
 
             <div className="space-y-3">
               {cartItems.map((item) => (
                 <div
                   key={item.productId}
                   className={`border border-borderSoft rounded-lg p-3 ${
                     item.quantity > item.stock ? 'ring-1 ring-blush/60' : ''
                   }`}
                 >
                   <div className="flex items-center justify-between gap-3 flex-wrap">
                     <div>
                       <p className="font-semibold">{item.name}</p>
                       <p className="text-xs text-coffee/70">Stock: {item.stock}</p>
                       <p className="text-sm font-medium mt-1">${item.subtotal.toFixed(2)}</p>
                       {item.quantity > item.stock && (
                         <p className="text-xs text-accent font-semibold">Stock insuficiente</p>
                       )}
                     </div>
                     <div className="flex items-center gap-2">
                       <button
                         className="p-2 rounded-lg bg-secondarySoft hover:bg-blush/50"
                         onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                         aria-label="Disminuir"
                       >
                         <MinusIcon className="h-4 w-4" />
                       </button>
                       <input
                         type="number"
                         min={1}
                         value={item.quantity}
                         onChange={(e) => updateQuantity(item.productId, Number(e.target.value))}
                         className="w-16 text-center border border-borderSoft rounded-lg py-2"
                       />
                       <button
                         className="p-2 rounded-lg bg-secondarySoft hover:bg-blush/50"
                         onClick={() => updateQuantity(item.productId, Math.min(item.quantity + 1, item.stock))}
                         aria-label="Aumentar"
                         disabled={item.quantity >= item.stock}
                       >
                         <PlusIcon className="h-4 w-4" />
                       </button>
                     </div>
                   </div>
                 </div>
               ))}
               {!cartItems.length && <p className="text-sm text-coffee/70">No hay productos en el carrito.</p>}
             </div>
 
             <div className="grid md:grid-cols-2 gap-3">
               <label className="md:col-span-2">
                 <span className="text-sm font-medium text-coffee/80">Notas / Observaciones (opcional)</span>
                 <textarea
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                   placeholder="Instrucciones, empaques, etc."
                   className="mt-1 w-full border border-borderSoft rounded-lg px-3 py-2 min-h-[80px]"
                 />
               </label>
 
               <div className="border-t border-borderSoft pt-3 flex items-center justify-between md:col-span-2">
                 <div>
                   <p className="text-sm text-coffee/70">Subtotal</p>
                   <p className="text-lg font-semibold">${preDiscountTotal.toFixed(2)}</p>
                   {discountAmount > 0 && (
                     <p className="text-sm text-coffee/70">Descuento: -${discountAmount.toFixed(2)}</p>
                   )}
                   <p className="text-2xl font-bold text-coffee mt-1">Total: ${total.toFixed(2)}</p>
                 </div>
                 <button
                   className="btn-primary flex items-center gap-2"
                   onClick={confirmSale}
                   disabled={!cartItems.length || cartHasStockIssue}
                 >
                   <CheckCircleIcon className="h-5 w-5" /> Confirmar venta
                 </button>
               </div>
             </div>
           </div>
         </div>
 
         <div className="card p-4 space-y-4" id="wholesale-ticket">
           <div className="flex items-center justify-between">
             <div>
               <p className="text-xs uppercase text-coffee/60 font-semibold">Helatte POS</p>
               <h3 className="text-lg font-semibold">Ticket Venta Mayoreo</h3>
               {ticketSale?.folio && <p className="text-sm text-coffee/70">Folio: {ticketSale.folio}</p>}
             </div>
             <div className="text-right">
               <p className="text-xs text-coffee/60">Fecha</p>
               <p className="font-semibold text-sm">
                 {ticketSale
                   ? new Date(ticketSale.date).toLocaleString()
                   : new Date().toLocaleString()}
               </p>
             </div>
           </div>
 
           <div className="border-t border-borderSoft pt-3 text-sm">
             <p className="font-semibold">Cliente</p>
             <p>{renderClientLabel()}</p>
             {currentClient?.phone && <p className="text-coffee/70">Tel. {currentClient.phone}</p>}
           </div>
 
           <div className="border-t border-borderSoft pt-3">
             <div className="grid grid-cols-4 text-xs text-coffee/70 font-semibold pb-2">
               <span>Producto</span>
               <span className="text-center">Cant.</span>
               <span className="text-right">Precio</span>
               <span className="text-right">Importe</span>
             </div>
             <div className="divide-y divide-borderSoft text-sm">
               {(ticketSale?.items ?? cartItems).map((item) => (
                 <div key={`${item.productId}-${item.name}`} className="grid grid-cols-4 py-1">
                   <span className="font-medium">{item.name}</span>
                   <span className="text-center">{item.quantity}</span>
                   <span className="text-right">${item.price.toFixed(2)}</span>
                   <span className="text-right">${(item.price * item.quantity).toFixed(2)}</span>
                 </div>
               ))}
               {!(ticketSale?.items ?? cartItems).length && (
                 <p className="text-sm text-coffee/60">Agrega productos para ver el ticket.</p>
               )}
             </div>
           </div>
 
           <div className="border-t border-borderSoft pt-3">
             <div className="flex items-center justify-between">
               <span className="text-sm text-coffee/70">Subtotal</span>
               <span className="font-semibold">${(ticketSale?.total ?? preDiscountTotal).toFixed(2)}</span>
             </div>
             {discountAmount > 0 && !ticketSale && (
               <div className="flex items-center justify-between">
                 <span className="text-sm text-coffee/70">Descuento</span>
                 <span className="font-semibold">-${discountAmount.toFixed(2)}</span>
               </div>
             )}
             <div className="flex items-center justify-between text-lg font-bold mt-1">
               <span>Total</span>
               <span>${(ticketSale?.total ?? total).toFixed(2)}</span>
             </div>
             {(ticketSale?.notes || notes) && (
               <div className="mt-2 text-sm">
                 <p className="font-semibold">Notas</p>
                 <p className="text-coffee/80">{ticketSale?.notes ?? notes}</p>
               </div>
             )}
           </div>
 
           <div className="flex flex-col gap-2 no-print">
             <button
               className="btn-primary flex items-center justify-center gap-2"
               onClick={() => window.print()}
               disabled={!ticketSale}
             >
               <PrinterIcon className="h-5 w-5" /> Imprimir
             </button>
             <button
               className="w-full border border-borderSoft rounded-lg py-2 font-semibold text-coffee hover:bg-secondarySoft"
               onClick={() => setTicketSale(null)}
             >
               Nueva venta mayoreo
             </button>
           </div>
         </div>
       </div>
     </div>
   );
 };
