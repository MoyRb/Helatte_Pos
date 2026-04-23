import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DocumentArrowDownIcon, PlusIcon, CheckBadgeIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { usePos } from '../context/PosContext';
import { supabase } from '../lib/supabase';

type PlanStatus = 'draft' | 'confirmed';

type ProductionPlan = {
  id: string;
  brandId: string;
  planDate: string;
  status: PlanStatus;
  responsible: string;
  notes: string;
  appliedAt: string | null;
  createdAt: string;
};

type ProductionItem = {
  id?: string;
  productId: string;
  productName: string;
  variant: string;
  presentation: string;
  plannedQuantity: number;
  unit: string;
  notes: string;
  sortOrder: number;
};

type FormState = {
  id: string | null;
  planDate: string;
  status: PlanStatus;
  responsible: string;
  notes: string;
  items: ProductionItem[];
};

const today = new Date().toISOString().slice(0, 10);

const emptyItem: ProductionItem = {
  productId: '',
  productName: '',
  variant: '',
  presentation: '',
  plannedQuantity: 0,
  unit: 'pza',
  notes: '',
  sortOrder: 0,
};

const emptyForm: FormState = {
  id: null,
  planDate: today,
  status: 'draft',
  responsible: '',
  notes: '',
  items: [{ ...emptyItem }],
};

const formatDisplayDate = (value: string) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
};

export const ProductionPage: React.FC<{ brandId: string; brandName: string }> = ({ brandId, brandName }) => {
  const { products, refreshData } = usePos();
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const sortedProducts = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products]);

  const resetFormState = useCallback(() => {
    setForm({ ...emptyForm, planDate: new Date().toISOString().slice(0, 10), items: [{ ...emptyItem }] });
  }, []);

  const loadPlans = useCallback(async (targetBrandId: string) => {
    setLoadingPlans(true);
    const { data, error } = await supabase
      .from('production_plans')
      .select('id, brand_id, plan_date, status, responsible, notes, applied_at, created_at')
      .eq('brand_id', targetBrandId)
      .order('plan_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      window.alert(error.message);
      setLoadingPlans(false);
      return;
    }

    console.log('ProductionPage loadPlans', {
      activeBrandId: targetBrandId,
      loadedPlanBrandIds: (data ?? []).map((plan) => plan.brand_id),
    });

    setPlans(
      (data ?? []).map((plan) => ({
        id: plan.id,
        brandId: plan.brand_id,
        planDate: plan.plan_date,
        status: plan.status,
        responsible: plan.responsible ?? '',
        notes: plan.notes ?? '',
        appliedAt: plan.applied_at,
        createdAt: plan.created_at,
      })),
    );
    setLoadingPlans(false);
  }, []);

  useEffect(() => {
    console.log('ProductionPage active brand changed', { activeBrandId: brandId });
    setPlans([]);
    resetFormState();
    void loadPlans(brandId);
  }, [brandId, loadPlans, resetFormState]);

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem, sortOrder: prev.items.length }],
    }));
  };

  const duplicateItem = (index: number) => {
    setForm((prev) => {
      const source = prev.items[index];
      if (!source) return prev;
      const nextItems = [...prev.items];
      nextItems.splice(index + 1, 0, { ...source, id: undefined, sortOrder: index + 1 });
      return { ...prev, items: nextItems.map((item, idx) => ({ ...item, sortOrder: idx })) };
    });
  };

  const removeItem = (index: number) => {
    setForm((prev) => {
      if (prev.items.length === 1) {
        return { ...prev, items: [{ ...emptyItem }] };
      }
      const nextItems = prev.items.filter((_, itemIndex) => itemIndex !== index);
      return { ...prev, items: nextItems.map((item, idx) => ({ ...item, sortOrder: idx })) };
    });
  };

  const updateItem = <K extends keyof ProductionItem>(index: number, key: K, value: ProductionItem[K]) => {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const target = nextItems[index];
      if (!target) return prev;

      const updated = { ...target, [key]: value };
      if (key === 'productId') {
        const selected = sortedProducts.find((product) => product.id === value);
        updated.productName = selected?.name ?? '';
      }

      nextItems[index] = updated;
      return { ...prev, items: nextItems };
    });
  };

  const loadPlanIntoForm = async (planId: string) => {
    const { data: planData, error: planError } = await supabase
      .from('production_plans')
      .select('id, brand_id, plan_date, status, responsible, notes')
      .eq('id', planId)
      .eq('brand_id', brandId)
      .single();

    if (planError || !planData) {
      window.alert(planError?.message ?? 'No se pudo cargar el plan');
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('production_plan_items')
      .select('id, product_id, product_name_snapshot, variant, presentation, planned_quantity, unit, notes, sort_order')
      .eq('plan_id', planId)
      .order('sort_order', { ascending: true });

    if (itemsError) {
      window.alert(itemsError.message);
      return;
    }

    setForm({
      id: planData.id,
      planDate: planData.plan_date,
      status: planData.status,
      responsible: planData.responsible ?? '',
      notes: planData.notes ?? '',
      items:
        (itemsData ?? []).map((item) => ({
          id: item.id,
          productId: item.product_id,
          productName: item.product_name_snapshot,
          variant: item.variant ?? '',
          presentation: item.presentation ?? '',
          plannedQuantity: Number(item.planned_quantity),
          unit: item.unit,
          notes: item.notes ?? '',
          sortOrder: item.sort_order,
        })) || [{ ...emptyItem }],
    });
  };

  const savePlan = async (nextStatus: PlanStatus) => {
    const validItems = form.items
      .filter((item) => item.productId && item.plannedQuantity > 0)
      .map((item, index) => ({ ...item, sortOrder: index }));

    if (!form.planDate) {
      window.alert('Debes seleccionar una fecha');
      return;
    }

    if (!validItems.length) {
      window.alert('Agrega al menos un producto con cantidad planificada mayor a 0');
      return;
    }

    setSaving(true);
    const planPayload = {
      brand_id: brandId,
      plan_date: form.planDate,
      status: nextStatus,
      responsible: form.responsible.trim() || null,
      notes: form.notes.trim() || null,
    };
    console.log('ProductionPage save payload', { activeBrandId: brandId, payloadBrandId: planPayload.brand_id });

    let planId = form.id;

    if (planId) {
      const { error: planUpdateError } = await supabase.from('production_plans').update(planPayload).eq('id', planId).eq('brand_id', brandId);
      if (planUpdateError) {
        setSaving(false);
        window.alert(planUpdateError.message);
        return;
      }

      const { error: deleteItemsError } = await supabase.from('production_plan_items').delete().eq('plan_id', planId);
      if (deleteItemsError) {
        setSaving(false);
        window.alert(deleteItemsError.message);
        return;
      }
    } else {
      const createPayload = { ...planPayload };
      console.log('production_plans insert payload', createPayload);
      const { data: createdPlan, error: createPlanError } = await supabase
        .from('production_plans')
        .insert(createPayload)
        .select('id')
        .single();

      if (createPlanError || !createdPlan) {
        setSaving(false);
        window.alert(createPlanError?.message ?? 'No se pudo crear el plan');
        return;
      }

      planId = createdPlan.id;
    }

    if (!planId) {
      setSaving(false);
      window.alert('No se encontró el identificador del plan.');
      return;
    }

    const itemsPayload = validItems.map((item, index) => ({
      plan_id: planId,
      product_id: item.productId,
      product_name_snapshot: sortedProducts.find((product) => product.id === item.productId)?.name ?? item.productName,
      variant: item.variant.trim() || null,
      presentation: item.presentation.trim() || null,
      planned_quantity: item.plannedQuantity,
      unit: item.unit.trim() || 'pza',
      notes: item.notes.trim() || null,
      sort_order: index,
    }));

    const { error: insertItemsError } = await supabase.from('production_plan_items').insert(itemsPayload);

    if (insertItemsError) {
      setSaving(false);
      window.alert(insertItemsError.message);
      return;
    }

    setSaving(false);
    await loadPlans(brandId);
    await loadPlanIntoForm(planId);

    if (nextStatus === 'confirmed') {
      window.alert('Plan confirmado. Puedes aplicar producción para impactar inventario.');
    }
  };

  const applyPlan = async () => {
    const currentPlanId = form.id;
    if (!currentPlanId) return;
    const planInActiveBrand = plans.find((plan) => plan.id === currentPlanId && plan.brandId === brandId);
    if (!planInActiveBrand) {
      window.alert('El plan actual no pertenece a la marca activa.');
      resetFormState();
      return;
    }

    const approved = window.confirm('¿Aplicar producción? Esto incrementará inventario de producto terminado.');
    if (!approved) return;

    const { error } = await supabase.rpc('apply_production_plan', { target_plan: currentPlanId });

    if (error) {
      window.alert(error.message);
      return;
    }

    await Promise.all([loadPlans(brandId), loadPlanIntoForm(currentPlanId), refreshData()]);
    window.alert('Producción aplicada e inventario actualizado.');
  };

  const generatePdf = async () => {
    const validItems = form.items.filter((item) => item.productId && item.plannedQuantity > 0);
    if (!validItems.length) {
      window.alert('No hay renglones válidos para exportar.');
      return;
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(252, 239, 244);
    doc.rect(0, 0, 210, 30, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(47, 49, 51);
    doc.setFontSize(18);
    doc.text('Helatte POS', 14, 14);

    doc.setFontSize(20);
    doc.text('Plan de Producción', 14, 24);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Marca: ${brandName}`, 14, 38);
    doc.text(`Fecha: ${formatDisplayDate(form.planDate)}`, 14, 45);
    if (form.responsible.trim()) {
      doc.text(`Responsable: ${form.responsible.trim()}`, 14, 52);
    }

    autoTable(doc, {
      startY: form.responsible.trim() ? 58 : 52,
      head: [['Producto', 'Variante/Sabor', 'Presentación', 'Cantidad', 'Unidad', 'Notas']],
      body: validItems.map((item) => [
        item.productName || sortedProducts.find((product) => product.id === item.productId)?.name || '',
        item.variant || '-',
        item.presentation || '-',
        item.plannedQuantity.toString(),
        item.unit,
        item.notes || '-',
      ]),
      headStyles: {
        fillColor: [223, 159, 195],
        textColor: [47, 49, 51],
      },
      styles: {
        fontSize: 10,
        cellPadding: 2,
      },
      alternateRowStyles: {
        fillColor: [249, 247, 240],
      },
    });

    const finalY = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 130;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones:', 14, finalY + 12);
    doc.setFont('helvetica', 'normal');
    const notes = form.notes.trim() || 'Sin observaciones generales.';
    doc.text(doc.splitTextToSize(notes, 180), 14, finalY + 18);

    doc.line(20, 260, 90, 260);
    doc.line(120, 260, 190, 260);
    doc.setFontSize(10);
    doc.text('Firma producción', 40, 266);
    doc.text('Firma responsable', 142, 266);

    doc.save(`plan-produccion-${form.planDate}.pdf`);
  };

  const selectedPlan = plans.find((plan) => plan.id === form.id);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <section className="card p-6 space-y-4 xl:col-span-1">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Planes de producción</h2>
          <button
            className="btn-secondary text-xs"
            onClick={() => resetFormState()}
          >
            Nuevo plan
          </button>
        </div>

        <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
          {plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => void loadPlanIntoForm(plan.id)}
              className={`w-full text-left border rounded-xl p-3 transition ${form.id === plan.id ? 'border-primary/50 bg-primarySoft/40' : 'border-borderSoft hover:bg-secondarySoft/40'}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">{formatDisplayDate(plan.planDate)}</p>
                <span className={plan.status === 'confirmed' ? 'badge-success' : 'badge-warning'}>
                  {plan.status === 'confirmed' ? 'Confirmado' : 'Borrador'}
                </span>
              </div>
              <p className="text-xs text-coffee/70 mt-1">Responsable: {plan.responsible || 'Sin asignar'}</p>
              {plan.appliedAt ? <p className="text-xs text-mintDeep mt-1">Aplicado: {new Date(plan.appliedAt).toLocaleString()}</p> : null}
            </button>
          ))}
          {!plans.length && !loadingPlans && <p className="text-sm text-coffee/70">Aún no hay planes de producción.</p>}
          {loadingPlans && <p className="text-sm text-coffee/70">Cargando planes...</p>}
        </div>
      </section>

      <section className="card p-6 space-y-4 xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-semibold">{form.id ? 'Editar plan' : 'Nuevo plan de producción'}</h2>
            <p className="text-sm text-coffee/70">Planifica producción diaria y genera PDF imprimible.</p>
          </div>
          {selectedPlan?.appliedAt ? <span className="badge-info">Inventario aplicado</span> : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Fecha
            <input type="date" value={form.planDate} onChange={(e) => setForm((prev) => ({ ...prev, planDate: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Responsable
            <input value={form.responsible} onChange={(e) => setForm((prev) => ({ ...prev, responsible: e.target.value }))} placeholder="Nombre de responsable" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium md:col-span-2">
            Observaciones generales
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas para operación diaria"
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Renglones de producción</h3>
            <button type="button" onClick={addItem} className="btn-secondary gap-2 text-sm">
              <PlusIcon className="h-4 w-4" />
              Agregar renglón
            </button>
          </div>

          <div className="space-y-3">
            {form.items.map((item, index) => (
              <div key={`${item.id ?? 'new'}-${index}`} className="border border-borderSoft rounded-xl p-3 bg-surface">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <label className="flex flex-col gap-1 text-xs font-semibold md:col-span-2">
                    Producto
                    <select
                      value={item.productId}
                      onChange={(e) => updateItem(index, 'productId', e.target.value)}
                    >
                      <option value="">Seleccionar producto</option>
                      {sortedProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Variante/Sabor
                    <input value={item.variant} onChange={(e) => updateItem(index, 'variant', e.target.value)} placeholder="Opcional" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Presentación
                    <input value={item.presentation} onChange={(e) => updateItem(index, 'presentation', e.target.value)} placeholder="Ej. 1L" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Cantidad
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={item.plannedQuantity}
                      onChange={(e) => updateItem(index, 'plannedQuantity', Number(e.target.value))}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Unidad
                    <input value={item.unit} onChange={(e) => updateItem(index, 'unit', e.target.value)} placeholder="pza" />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold md:col-span-4">
                    Notas
                    <input value={item.notes} onChange={(e) => updateItem(index, 'notes', e.target.value)} placeholder="Detalle operativo" />
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button type="button" onClick={() => duplicateItem(index)} className="btn-secondary text-xs gap-1 px-3 py-1.5">
                    <DocumentDuplicateIcon className="h-4 w-4" /> Duplicar
                  </button>
                  <button type="button" onClick={() => removeItem(index)} className="btn-secondary text-xs px-3 py-1.5">
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-borderSoft">
          <button type="button" onClick={() => void savePlan('draft')} className="btn-secondary" disabled={saving}>
            Guardar borrador
          </button>
          <button type="button" onClick={() => void savePlan('confirmed')} className="btn-primary gap-2" disabled={saving}>
            <CheckBadgeIcon className="h-5 w-5" />
            Confirmar plan
          </button>
          <button type="button" onClick={() => void generatePdf()} className="btn-secondary gap-2">
            <DocumentArrowDownIcon className="h-5 w-5" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => void applyPlan()}
            className="btn-secondary"
            disabled={!form.id || form.status !== 'confirmed' || Boolean(selectedPlan?.appliedAt) || selectedPlan?.brandId !== brandId}
          >
            Aplicar a inventario
          </button>
        </div>
      </section>
    </div>
  );
};
