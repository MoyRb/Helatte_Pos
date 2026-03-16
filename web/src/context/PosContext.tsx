import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadFromStorage, saveToStorage } from '../utils/storage';

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

type PosContextValue = {
  products: Product[];
  sales: Sale[];
  financeMovements: FinanceMovement[];
  clients: Client[];
  credits: Credit[];
  fridgeLoans: FridgeLoan[];
  rawMaterials: RawMaterial[];
  rawMaterialMovements: RawMaterialMovement[];
  nextWholesaleFolio: () => string;
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (id: string, changes: Partial<Omit<Product, 'id'>>) => void;
  deleteProduct: (id: string) => void;
  recordSale: (items: SalePayload) => { success: boolean; message?: string };
  createWholesaleSale: (
    payload: WholesalePayload,
  ) => { success: boolean; message?: string; sale?: Sale };
  addFinanceMovement: (movement: Omit<FinanceMovement, 'id'>) => void;
  deleteCashMovement: (box: FinanceMovement['box'], movementId: string) => void;
  addClient: (client: Omit<Client, 'id'>) => void;
  updateClient: (id: string, changes: Partial<Omit<Client, 'id'>>) => void;
  deleteClient: (id: string) => void;
  addCredit: (credit: Omit<Credit, 'id' | 'payments' | 'status'>) => void;
  addCreditPayment: (creditId: string, payment: Omit<CreditPayment, 'id'>) => void;
  updateCreditStatus: (creditId: string, status: Credit['status']) => void;
  addFridgeLoan: (loan: Omit<FridgeLoan, 'id' | 'status' | 'returnDate'>) => void;
  markFridgeReturned: (loanId: string) => void;
  addRawMaterial: (material: Omit<RawMaterial, 'id'>) => void;
  updateRawMaterial: (id: string, changes: Partial<Omit<RawMaterial, 'id'>>) => void;
  deleteRawMaterial: (id: string) => void;
  recordMaterialMovement: (movement: Omit<RawMaterialMovement, 'id'>) => { success: boolean; message?: string };
};

const PosContext = createContext<PosContextValue | null>(null);
const PRODUCTS_KEY = 'helatte_products';
const SALES_KEY = 'helatte_sales';
const FINANCE_KEY = 'helatte_finance';
const CLIENTS_KEY = 'helatte_clients';
const CREDITS_KEY = 'helatte_credits';
const FRIDGES_KEY = 'helatte_fridge_loans';
const RAW_MATERIALS_KEY = 'helatte_raw_materials';
const RAW_MATERIAL_MOVEMENTS_KEY = 'helatte_raw_material_movements';
const WHOLESALE_FOLIO_KEY = 'helatte_wholesale_folio';

function generateId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);
}

const normalizeSales = (storedSales: Sale[]) => {
  if (!Array.isArray(storedSales)) return [];

  return storedSales.map((sale) => ({
    ...sale,
    channel: (sale as Sale).channel ?? 'pos',
    folio: (sale as Sale).folio ?? '',
    notes: (sale as Sale).notes ?? (sale as Sale & { note?: string }).note ?? undefined,
  }));
};

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(() => loadFromStorage(PRODUCTS_KEY, []));
  const [sales, setSales] = useState<Sale[]>(() => normalizeSales(loadFromStorage(SALES_KEY, [])));
  const [financeMovements, setFinanceMovements] = useState<FinanceMovement[]>(() => {
    const stored = loadFromStorage<FinanceMovement[]>(FINANCE_KEY, []);
    if (!Array.isArray(stored)) return [];

    return stored.map((movement) => ({
      ...movement,
      source:
        movement.source === 'venta'
          ? 'sale'
          : movement.source === undefined
            ? 'manual'
            : movement.source,
    }));
  });
  const [clients, setClients] = useState<Client[]>(() => {
    const storedClients = loadFromStorage<Client[]>(CLIENTS_KEY, []);
    if (!Array.isArray(storedClients)) return [];

    return storedClients.map((client) => ({
      ...client,
      phone: client.phone ?? '',
      address: client.address ?? '',
    }));
  });
  const [credits, setCredits] = useState<Credit[]>(() => loadFromStorage(CREDITS_KEY, []));
  const [fridgeLoans, setFridgeLoans] = useState<FridgeLoan[]>(() => loadFromStorage(FRIDGES_KEY, []));
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>(
    () => loadFromStorage(RAW_MATERIALS_KEY, []),
  );
  const [rawMaterialMovements, setRawMaterialMovements] = useState<RawMaterialMovement[]>(
    () => loadFromStorage(RAW_MATERIAL_MOVEMENTS_KEY, []),
  );
  const [wholesaleFolio, setWholesaleFolio] = useState<number>(
    () => Number(loadFromStorage(WHOLESALE_FOLIO_KEY, 1)) || 1,
  );

  useEffect(() => {
    const syncFromStorage = () => {
      setProducts(loadFromStorage(PRODUCTS_KEY, []));
      setSales(normalizeSales(loadFromStorage(SALES_KEY, [])));
    };

    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  useEffect(() => {
    saveToStorage(PRODUCTS_KEY, products);
  }, [products]);

  useEffect(() => {
    saveToStorage(SALES_KEY, sales);
  }, [sales]);

  useEffect(() => {
    saveToStorage(FINANCE_KEY, financeMovements);
  }, [financeMovements]);

  useEffect(() => {
    saveToStorage(CLIENTS_KEY, clients);
  }, [clients]);

  useEffect(() => {
    saveToStorage(CREDITS_KEY, credits);
  }, [credits]);

  useEffect(() => {
    saveToStorage(FRIDGES_KEY, fridgeLoans);
  }, [fridgeLoans]);

  useEffect(() => {
    saveToStorage(RAW_MATERIALS_KEY, rawMaterials);
  }, [rawMaterials]);

  useEffect(() => {
    saveToStorage(RAW_MATERIAL_MOVEMENTS_KEY, rawMaterialMovements);
  }, [rawMaterialMovements]);

  useEffect(() => {
    saveToStorage(WHOLESALE_FOLIO_KEY, wholesaleFolio);
  }, [wholesaleFolio]);

  const formatWholesaleFolio = (folioNumber: number) => `MAY-${String(folioNumber).padStart(6, '0')}`;

  const nextWholesaleFolio = () => formatWholesaleFolio(wholesaleFolio);

  const addProduct = (product: Omit<Product, 'id'>) => {
    const safeStock = Math.max(0, product.stock);
    const newProduct: Product = { ...product, stock: safeStock, id: generateId() };
    setProducts((prev) => [...prev, newProduct]);
  };

  const updateProduct = (id: string, changes: Partial<Omit<Product, 'id'>>) => {
    setProducts((prev) =>
      prev.map((product) => {
        if (product.id !== id) return product;
        const nextStock =
          changes.stock === undefined ? product.stock : Math.max(0, Number.isNaN(changes.stock) ? 0 : changes.stock);

        return { ...product, ...changes, stock: nextStock };
      }),
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((product) => product.id !== id));
  };

  const recordSale = (items: SalePayload) => {
    if (!items.length) return { success: false, message: 'El carrito está vacío' };

    const updatedProducts = [...products];
    const saleItems: SaleItem[] = [];
    let total = 0;

    for (const { productId, quantity } of items) {
      const productIndex = updatedProducts.findIndex((p) => p.id === productId);
      if (productIndex === -1) return { success: false, message: 'Producto no encontrado' };

      const product = updatedProducts[productIndex];
      if (product.stock < quantity) {
        return { success: false, message: `Stock insuficiente para ${product.name}` };
      }

      updatedProducts[productIndex] = { ...product, stock: product.stock - quantity };
      saleItems.push({ productId, name: product.name, price: product.price, quantity });
      total += product.price * quantity;
    }

    const sale: Sale = {
      id: generateId(),
      items: saleItems,
      total,
      date: new Date().toISOString(),
      channel: 'pos',
      folio: '',
    };

    setProducts(updatedProducts);
    setSales((prev) => [...prev, sale]);
    setFinanceMovements((prev) => [
      ...prev,
      {
        id: generateId(),
        box: 'grande',
        kind: 'entrada',
        amount: total,
        concept: 'Venta POS',
        date: sale.date,
        source: 'sale',
      },
    ]);
    return { success: true };
  };

  const createWholesaleSale = ({ items, notes, clientId, clientName, discount }: WholesalePayload) => {
    if (!items.length) return { success: false, message: 'El carrito está vacío' };

    const updatedProducts = [...products];
    const saleItems: SaleItem[] = [];
    let total = 0;

    for (const { productId, quantity } of items) {
      const productIndex = updatedProducts.findIndex((p) => p.id === productId);
      if (productIndex === -1) return { success: false, message: 'Producto no encontrado' };

      const product = updatedProducts[productIndex];
      if (product.stock < quantity) {
        return { success: false, message: `Stock insuficiente para ${product.name}` };
      }

      updatedProducts[productIndex] = { ...product, stock: product.stock - quantity };
      saleItems.push({ productId, name: product.name, price: product.price, quantity });
      total += product.price * quantity;
    }

    if (discount && discount.value > 0) {
      const discountAmount =
        discount.type === 'percent' ? Math.min(discount.value, 100) * (total / 100) : discount.value;
      total = Math.max(total - discountAmount, 0);
    }

    const date = new Date().toISOString();
    const folio = formatWholesaleFolio(wholesaleFolio);

    const sale: Sale = {
      id: generateId(),
      items: saleItems,
      total,
      date,
      notes: notes?.trim() ? notes.trim() : undefined,
      clientId,
      clientName: clientName?.trim() ? clientName.trim() : undefined,
      channel: 'wholesale',
      folio,
    };

    setProducts(updatedProducts);
    setSales((prev) => [...prev, sale]);
    setFinanceMovements((prev) => [
      ...prev,
      {
        id: generateId(),
        box: 'grande',
        kind: 'entrada',
        amount: total,
        concept: `Venta Mayoreo ${folio}`,
        date,
        source: 'sale_wholesale',
      },
    ]);
    setWholesaleFolio((prev) => prev + 1);

    return { success: true, sale };
  };

  const addFinanceMovement = (movement: Omit<FinanceMovement, 'id'>) => {
    setFinanceMovements((prev) => [
      ...prev,
      { ...movement, id: generateId(), source: movement.source ?? 'manual' },
    ]);
  };

  const deleteCashMovement = (box: FinanceMovement['box'], movementId: string) => {
    setFinanceMovements((prev) =>
      prev.filter((movement) => movement.box !== box || movement.id !== movementId),
    );
  };

  const addClient = (client: Omit<Client, 'id'>) => {
    setClients((prev) => [...prev, { ...client, id: generateId() }]);
  };

  const updateClient = (id: string, changes: Partial<Omit<Client, 'id'>>) => {
    setClients((prev) => prev.map((client) => (client.id === id ? { ...client, ...changes } : client)));
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((client) => client.id !== id));
  };

  const addCredit = (credit: Omit<Credit, 'id' | 'payments' | 'status'>) => {
    const payload: Credit = { ...credit, id: generateId(), status: 'pendiente', payments: [] };
    setCredits((prev) => [...prev, payload]);
  };

  const updateCreditStatus = (creditId: string, status: Credit['status']) => {
    setCredits((prev) => prev.map((credit) => (credit.id === creditId ? { ...credit, status } : credit)));
  };

  const addCreditPayment = (creditId: string, payment: Omit<CreditPayment, 'id'>) => {
    setCredits((prev) =>
      prev.map((credit) => {
        if (credit.id !== creditId) return credit;

        const updatedPayments = [...credit.payments, { ...payment, id: generateId() }];
        const paid = updatedPayments.reduce((acc, current) => acc + current.amount, 0);
        const remaining = credit.amount - paid;
        const nextStatus = remaining <= 0 ? 'pagado' : credit.status;
        return { ...credit, payments: updatedPayments, status: nextStatus };
      }),
    );
  };

  const addFridgeLoan = (loan: Omit<FridgeLoan, 'id' | 'status' | 'returnDate'>) => {
    setFridgeLoans((prev) => [...prev, { ...loan, id: generateId(), status: 'entregado' }]);
  };

  const markFridgeReturned = (loanId: string) => {
    setFridgeLoans((prev) =>
      prev.map((loan) =>
        loan.id === loanId ? { ...loan, status: 'devuelto', returnDate: new Date().toISOString() } : loan,
      ),
    );
  };

  const addRawMaterial = (material: Omit<RawMaterial, 'id'>) => {
    setRawMaterials((prev) => [...prev, { ...material, id: generateId() }]);
  };

  const updateRawMaterial = (id: string, changes: Partial<Omit<RawMaterial, 'id'>>) => {
    setRawMaterials((prev) => prev.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  };

  const deleteRawMaterial = (id: string) => {
    setRawMaterials((prev) => prev.filter((item) => item.id !== id));
    setRawMaterialMovements((prev) => prev.filter((movement) => movement.materialId !== id));
  };

  const recordMaterialMovement = (movement: Omit<RawMaterialMovement, 'id'>) => {
    const material = rawMaterials.find((item) => item.id === movement.materialId);
    if (!material) return { success: false, message: 'Materia prima no encontrada' };

    const delta = movement.type === 'entrada' ? movement.amount : -movement.amount;
    const newStock = material.stock + delta;

    if (newStock < 0) return { success: false, message: 'No puedes tener stock negativo' };

    updateRawMaterial(material.id, { stock: newStock });
    setRawMaterialMovements((prev) => [...prev, { ...movement, id: generateId() }]);
    return { success: true };
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
      nextWholesaleFolio,
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
      wholesaleFolio,
    ],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export function usePos() {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos debe usarse dentro de PosProvider');
  return context;
}
