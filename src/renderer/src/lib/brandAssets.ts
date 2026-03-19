import type { Brand } from '../../../preload';

const BRAND_ICON_PATHS: Record<string, string> = {
  helatte: 'brands/helatte-icon.svg',
  'las-purepechas': 'brands/las-purepechas-icon.svg'
};

export const getBrandIconPath = (brand?: Pick<Brand, 'slug'> | null) =>
  `${import.meta.env.BASE_URL}${brand ? BRAND_ICON_PATHS[brand.slug] ?? 'brands/helatte-icon.svg' : 'brands/helatte-icon.svg'}`;
