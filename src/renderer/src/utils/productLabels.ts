type ProductLabelLike = {
  sku?: string | null;
  presentacion?: string | null;
  tipo?: { nombre?: string | null } | null;
  sabor?: { nombre?: string | null } | null;
};

const clean = (value?: string | null) => String(value ?? '').trim();

export const buildProductName = (product: ProductLabelLike) => {
  const tipo = clean(product.tipo?.nombre);
  const sabor = clean(product.sabor?.nombre);
  return [tipo, sabor].filter(Boolean).join(' · ') || 'Producto sin nombre';
};

export const buildProductLabel = (product: ProductLabelLike) => {
  const name = buildProductName(product);
  const presentation = clean(product.presentacion);
  return presentation ? `${name} — ${presentation}` : name;
};

export const buildProductMeta = (product: ProductLabelLike) => {
  const meta = [];
  if (clean(product.sku)) meta.push(`SKU ${clean(product.sku)}`);
  if (clean(product.presentacion)) meta.push(clean(product.presentacion));
  return meta.join(' · ');
};
