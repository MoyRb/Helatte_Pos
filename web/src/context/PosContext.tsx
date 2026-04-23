import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type Product = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type SaleItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Sale = {
  id: string;
  items: SaleItem[];
  total: number;
  date: string;
  notes?: string;
  clientId?: string;
  clientName?: string;
  channel: 'pos' | 'wholesale';
  folio?: string;
};

export type FinanceMovement = {
  id: string;
  box: 'chica' | 'grande';
  kind: 'entrada' | 'salida';
  amount: number;
  concept: string;
  date: string;
  source?: 'manual' | 'sale' | 'sale_wholesale' | 'venta';
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  address: string;
  active: boolean;
  notes: string;
};

export type CreditPayment = {
  id: string;
  amount: number;
  date: string;
  note?: string;
};

export type Credit = {
  id: string;
  clientId: string;
  amount: number;
  date: string;
  status: 'pendiente' | 'pagado';
  payments: CreditPayment[];
};

export type FridgeLoan = {
  id: string;
  clientId: string;
  quantity: number;
  deliveryDate: string;
  status: 'entregado' | 'devuelto';
  returnDate?: string;
};

export type RawMaterial = {
  id: string;
  name: string;
  stock: number;
  minStock: number;
};

export type RawMaterialMovement = {
  id: string;
  materialId: string;
  type: 'entrada' | 'salida';
  amount: number;
  note: string;
  date: string;
};

type SalePayload = { productId: string; quantity: number }[];
type WholesalePayload = {
  items: SalePayload;
  notes?: string;
  clientId?: string;
  clientName?: string;
  discount?: { type: 'amount' | 'percent'; value: number };
};

const toResult = (success: boolean, message?: string) => ({ success, message });

type PosContextValue = {
  products: Product[];
  sales: Sale[];
  financeMovements: FinanceMovement[];
  clients: Client[];
  credits: Credit[];
  fridgeLoans: FridgeLoan[];
  rawMaterials: RawMaterial[];
  rawMaterialMovements: RawMaterialMovement[];
  loading: boolean;
  error: string | null;
  nextWholesaleFolio: () => string;
  refreshData: () => Promise<void>;
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (id: string, changes: Partial<Omit<Product, 'id'>>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  recordSale: (items: SalePayload) => Promise<{ success: boolean; message?: string }>;
  createWholesaleSale: (
    payload: WholesalePayload,
  ) => Promise<{ success: boolean; message?: string; sale?: Sale }>;
  addFinanceMovement: (movement: Omit<FinanceMovement, 'id'>) => Promise<void>;
  deleteCashMovement: (box: FinanceMovement['box'], movementId: string) => Promise<void>;
  addClient: (client: Omit<Client, 'id'>) => Promise<void>;
  updateClient: (id: string, changes: Partial<Omit<Client, 'id'>>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addCredit: (credit: Omit<Credit, 'id' | 'payments' | 'status'>) => void;
  addCreditPayment: (creditId: string, payment: Omit<CreditPayment, 'id'>) => void;
  updateCreditStatus: (creditId: string, status: Credit['status']) => void;
  addFridgeLoan: (loan: Omit<FridgeLoan, 'id' | 'status' | 'returnDate'>) => void;
  markFridgeReturned: (loanId: string) => void;
  addRawMaterial: (material: Omit<RawMaterial, 'id'>) => Promise<void>;
  updateRawMaterial: (id: string, changes: Partial<Omit<RawMaterial, 'id'>>) => Promise<void>;
  deleteRawMaterial: (id: string) => Promise<void>;
  recordMaterialMovement: (movement: Omit<RawMaterialMovement, 'id'>) => Promise<{ success: boolean; message?: string }>;
};

const PosContext = createContext<PosContextValue | null>(null);

const formatWholesaleFolio = (folioNumber: number) => `MAY-${String(folioNumber).padStart(6, '0')}`;

export const PosProvider: React.FC<{ children: React.ReactNode; brandId: string }> = ({ children, brandId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [financeMovements, setFinanceMovements] = useState<FinanceMovement[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [fridgeLoans, setFridgeLoans] = useState<FridgeLoan[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>([]);
  const [wholesaleFolio, setWholesaleFolio] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [productsRes, clientsRes, salesRes, saleItemsRes, materialsRes, inventoryRes] = await Promise.all([
      supabase.from('products').select('*').eq('brand_id', brandId).order('name', { ascending: true }),
      supabase.from('customers').select('*').eq('brand_id', brandId).order('name', { ascending: true }),
      supabase.from('sales').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
      supabase.from('sale_items').select('*').eq('brand_id', brandId),
      supabase.from('raw_materials').select('*').eq('brand_id', brandId).order('name', { ascending: true }),
      supabase.from('inventory_movements').select('*').eq('brand_id', brandId).order('created_at', { ascending: false }),
    ]);

    const firstError =
      productsRes.error || clientsRes.error || salesRes.error || saleItemsRes.error || materialsRes.error || inventoryRes.error;

    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    setProducts((productsRes.data ?? []).map((p) => ({ id: p.id, name: p.name, price: Number(p.price), stock: p.stock })));

    setClients(
      (clientsRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone ?? '',
        address: c.address ?? '',
        active: c.active,
        notes: c.notes ?? '',
      })),
    );

    const itemsBySale = new Map<string, SaleItem[]>();
    for (const item of saleItemsRes.data ?? []) {
      const current = itemsBySale.get(item.sale_id) ?? [];
      current.push({
        productId: item.product_id,
        name: item.product_name,
        price: Number(item.unit_price),
        quantity: item.quantity,
      });
      itemsBySale.set(item.sale_id, current);
    }

    const mappedSales = (salesRes.data ?? []).map((sale) => ({
      id: sale.id,
      items: itemsBySale.get(sale.id) ?? [],
      total: Number(sale.total_amount),
      date: sale.created_at,
      notes: sale.notes ?? undefined,
      clientId: sale.customer_id ?? undefined,
      clientName: sale.client_name ?? undefined,
      channel: sale.channel,
      folio: sale.folio ?? '',
    }));

    setSales(mappedSales);
    const financeFromSales = mappedSales.map((sale) => ({
      id: `sale-${sale.id}`,
      box: 'grande' as const,
      kind: 'entrada' as const,
      amount: sale.total,
      concept: sale.channel === 'wholesale' ? `Venta Mayoreo ${sale.folio ?? ''}`.trim() : 'Venta POS',
      date: sale.date,
      source: sale.channel === 'wholesale' ? 'sale_wholesale' as const : 'sale' as const,
    }));
    setFinanceMovements(financeFromSales);

    setRawMaterials(
      (materialsRes.data ?? []).map((material) => ({
        id: material.id,
        name: material.name,
        stock: material.stock,
        minStock: material.min_stock,
      })),
    );

    setRawMaterialMovements(
      (inventoryRes.data ?? [])
        .filter((movement) => movement.material_id)
        .map((movement) => ({
          id: movement.id,
          materialId: movement.material_id,
          type: movement.movement_type,
          amount: movement.quantity,
          note: movement.note ?? '',
          date: movement.created_at,
        })),
    );

    const maxFolio = mappedSales
      .filter((sale) => sale.channel === 'wholesale' && sale.folio?.startsWith('MAY-'))
      .map((sale) => Number(sale.folio?.replace('MAY-', '')))
      .reduce((acc, current) => (Number.isFinite(current) ? Math.max(acc, current) : acc), 0);
    setWholesaleFolio(maxFolio + 1);

    setLoading(false);
  }, [brandId]);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const nextWholesaleFolio = () => formatWholesaleFolio(wholesaleFolio);

  const addProduct = async (product: Omit<Product, 'id'>) => {
    const { error: insertError } = await supabase.from('products').insert({
      brand_id: brandId,
      name: product.name.trim(),
      price: product.price,
      stock: Math.max(0, product.stock),
    });
    if (insertError) throw new Error(insertError.message);
    await refreshData();
  };

  const updateProduct = async (id: string, changes: Partial<Omit<Product, 'id'>>) => {
    const payload: Record<string, unknown> = {};
    if (changes.name !== undefined) payload.name = changes.name;
    if (changes.price !== undefined) payload.price = changes.price;
    if (changes.stock !== undefined) payload.stock = Math.max(0, Number(changes.stock));

    const { error: updateError } = await supabase.from('products').update(payload).eq('id', id).eq('brand_id', brandId);
    if (updateError) throw new Error(updateError.message);

    if (changes.stock !== undefined) {
      await supabase.from('inventory_movements').insert({
        brand_id: brandId,
        product_id: id,
        movement_type: 'adjustment',
        quantity: Math.abs(Number(changes.stock)),
        note: 'Ajuste de stock manual',
      });
    }

    await refreshData();
  };

  const deleteProduct = async (id: string) => {
    const { error: deleteError } = await supabase.from('products').delete().eq('id', id).eq('brand_id', brandId);
    if (deleteError) throw new Error(deleteError.message);
    await refreshData();
  };

  const recordSale = async (items: SalePayload) => {
    if (!items.length) return toResult(false, 'El carrito está vacío');

    const currentProducts = [...products];
    const saleItems: SaleItem[] = [];
    let total = 0;

    for (const { productId, quantity } of items) {
      const product = currentProducts.find((p) => p.id === productId);
      if (!product) return toResult(false, 'Producto no encontrado');
      if (product.stock < quantity) return toResult(false, `Stock insuficiente para ${product.name}`);
      saleItems.push({ productId, name: product.name, price: product.price, quantity });
      total += product.price * quantity;
    }

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({ brand_id: brandId, total_amount: total, channel: 'pos' })
      .select('id')
      .single();

    if (saleError || !saleData) return toResult(false, saleError?.message ?? 'No se pudo crear la venta');

    const saleItemsPayload = saleItems.map((item) => ({
      brand_id: brandId,
      sale_id: saleData.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsPayload);
    if (itemsError) return toResult(false, itemsError.message);

    for (const item of saleItems) {
      const product = currentProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.productId).eq('brand_id', brandId);
      await supabase.from('inventory_movements').insert({
        brand_id: brandId,
        product_id: item.productId,
        movement_type: 'sale',
        quantity: item.quantity,
        note: 'Salida por venta POS',
      });
    }

    await refreshData();
    return toResult(true);
  };

  const createWholesaleSale = async ({ items, notes, clientId, clientName, discount }: WholesalePayload) => {
    if (!items.length) return { success: false, message: 'El carrito está vacío' };

    const currentProducts = [...products];
    const saleItems: SaleItem[] = [];
    let total = 0;

    for (const { productId, quantity } of items) {
      const product = currentProducts.find((p) => p.id === productId);
      if (!product) return { success: false, message: 'Producto no encontrado' };
      if (product.stock < quantity) return { success: false, message: `Stock insuficiente para ${product.name}` };
      saleItems.push({ productId, name: product.name, price: product.price, quantity });
      total += product.price * quantity;
    }

    if (discount && discount.value > 0) {
      const discountAmount = discount.type === 'percent' ? Math.min(discount.value, 100) * (total / 100) : discount.value;
      total = Math.max(total - discountAmount, 0);
    }

    const folio = formatWholesaleFolio(wholesaleFolio);

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        brand_id: brandId,
        total_amount: total,
        channel: 'wholesale',
        notes: notes?.trim() || null,
        customer_id: clientId || null,
        client_name: clientName?.trim() || null,
        folio,
      })
      .select('id, created_at')
      .single();

    if (saleError || !saleData) return { success: false, message: saleError?.message ?? 'No se pudo crear la venta' };

    const saleItemsPayload = saleItems.map((item) => ({
      brand_id: brandId,
      sale_id: saleData.id,
      product_id: item.productId,
      product_name: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      line_total: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItemsPayload);
    if (itemsError) return { success: false, message: itemsError.message };

    for (const item of saleItems) {
      const product = currentProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      await supabase.from('products').update({ stock: product.stock - item.quantity }).eq('id', item.productId).eq('brand_id', brandId);
      await supabase.from('inventory_movements').insert({
        brand_id: brandId,
        product_id: item.productId,
        movement_type: 'sale',
        quantity: item.quantity,
        note: `Salida por mayoreo ${folio}`,
      });
    }

    const sale: Sale = {
      id: saleData.id,
      items: saleItems,
      total,
      date: saleData.created_at,
      notes: notes?.trim() || undefined,
      clientId,
      clientName,
      channel: 'wholesale',
      folio,
    };

    await refreshData();

    return { success: true, sale };
  };

  const addFinanceMovement = async () => {};
  const deleteCashMovement = async () => {};

  const addClient = async (client: Omit<Client, 'id'>) => {
    const { error: insertError } = await supabase.from('customers').insert({
      brand_id: brandId,
      name: client.name.trim(),
      phone: client.phone,
      address: client.address,
      active: client.active,
      notes: client.notes,
    });
    if (insertError) throw new Error(insertError.message);
    await refreshData();
  };

  const updateClient = async (id: string, changes: Partial<Omit<Client, 'id'>>) => {
    const { error: updateError } = await supabase.from('customers').update(changes).eq('id', id).eq('brand_id', brandId);
    if (updateError) throw new Error(updateError.message);
    await refreshData();
  };

  const deleteClient = async (id: string) => {
    const { error: deleteError } = await supabase.from('customers').delete().eq('id', id).eq('brand_id', brandId);
    if (deleteError) throw new Error(deleteError.message);
    await refreshData();
  };

  const addCredit = (credit: Omit<Credit, 'id' | 'payments' | 'status'>) => {
    const payload: Credit = {
      ...credit,
      id: crypto.randomUUID(),
      status: 'pendiente',
      payments: [],
    };
    setCredits((prev) => [...prev, payload]);
  };

  const updateCreditStatus = (creditId: string, status: Credit['status']) => {
    setCredits((prev) => prev.map((credit) => (credit.id === creditId ? { ...credit, status } : credit)));
  };

  const addCreditPayment = (creditId: string, payment: Omit<CreditPayment, 'id'>) => {
    setCredits((prev) =>
      prev.map((credit) => {
        if (credit.id !== creditId) return credit;

        const updatedPayments = [...credit.payments, { ...payment, id: crypto.randomUUID() }];
        const paid = updatedPayments.reduce((acc, current) => acc + current.amount, 0);
        const remaining = credit.amount - paid;
        const nextStatus = remaining <= 0 ? 'pagado' : credit.status;
        return { ...credit, payments: updatedPayments, status: nextStatus };
      }),
    );
  };

  const addFridgeLoan = (loan: Omit<FridgeLoan, 'id' | 'status' | 'returnDate'>) => {
    setFridgeLoans((prev) => [...prev, { ...loan, id: crypto.randomUUID(), status: 'entregado' }]);
  };

  const markFridgeReturned = (loanId: string) => {
    setFridgeLoans((prev) =>
      prev.map((loan) =>
        loan.id === loanId ? { ...loan, status: 'devuelto', returnDate: new Date().toISOString() } : loan,
      ),
    );
  };

  const addRawMaterial = async (material: Omit<RawMaterial, 'id'>) => {
    const { error: insertError } = await supabase.from('raw_materials').insert({
      brand_id: brandId,
      name: material.name,
      stock: material.stock,
      min_stock: material.minStock,
    });
    if (insertError) throw new Error(insertError.message);
    await refreshData();
  };

  const updateRawMaterial = async (id: string, changes: Partial<Omit<RawMaterial, 'id'>>) => {
    const payload: Record<string, unknown> = {};
    if (changes.name !== undefined) payload.name = changes.name;
    if (changes.stock !== undefined) payload.stock = changes.stock;
    if (changes.minStock !== undefined) payload.min_stock = changes.minStock;

    const { error: updateError } = await supabase.from('raw_materials').update(payload).eq('id', id).eq('brand_id', brandId);
    if (updateError) throw new Error(updateError.message);
    await refreshData();
  };

  const deleteRawMaterial = async (id: string) => {
    const { error: deleteError } = await supabase.from('raw_materials').delete().eq('id', id).eq('brand_id', brandId);
    if (deleteError) throw new Error(deleteError.message);
    await refreshData();
  };

  const recordMaterialMovement = async (movement: Omit<RawMaterialMovement, 'id'>) => {
    const material = rawMaterials.find((item) => item.id === movement.materialId);
    if (!material) return toResult(false, 'Materia prima no encontrada');

    const delta = movement.type === 'entrada' ? movement.amount : -movement.amount;
    const newStock = material.stock + delta;

    if (newStock < 0) return toResult(false, 'No puedes tener stock negativo');

    await supabase.from('raw_materials').update({ stock: newStock }).eq('id', movement.materialId).eq('brand_id', brandId);

    const { error: movementError } = await supabase.from('inventory_movements').insert({
      brand_id: brandId,
      material_id: movement.materialId,
      movement_type: movement.type,
      quantity: movement.amount,
      note: movement.note,
      created_at: movement.date,
    });
    if (movementError) return toResult(false, movementError.message);

    await refreshData();
    return toResult(true);
  };

  const value = useMemo(
    () => ({
      products,
      sales,
      financeMovements,
      clients,
      credits,
      fridgeLoans,
      rawMaterials,
      rawMaterialMovements,
      loading,
      error,
      nextWholesaleFolio,
      refreshData,
      addProduct,
      updateProduct,
      deleteProduct,
      recordSale,
      createWholesaleSale,
      addFinanceMovement,
      deleteCashMovement,
      addClient,
      updateClient,
      deleteClient,
      addCredit,
      addCreditPayment,
      updateCreditStatus,
      addFridgeLoan,
      markFridgeReturned,
      addRawMaterial,
      updateRawMaterial,
      deleteRawMaterial,
      recordMaterialMovement,
    }),
    [
      products,
      sales,
      financeMovements,
      clients,
      credits,
      fridgeLoans,
      rawMaterials,
      rawMaterialMovements,
      loading,
      error,
      wholesaleFolio,
      refreshData,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export function usePos() {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos debe usarse dentro de PosProvider');
  return context;
}
