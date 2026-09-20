export const PRODUCT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  HIDDEN: 'hidden',
} as const;

export const PRODUCT_BRAND = 'Testora' as const;

export const PRODUCT_SEARCHABLE_FIELDS = [
  'title',
  'description',
  'category',
  'slug',
];

export const PRODUCT_FILTERABLE_FIELDS = [
  'searchTerm',
  'status',
  'category',
  'minPrice',
  'maxPrice',
  'inStock',
  'isLowStock',
  'sort',
  'page',
  'limit',
  'fields',
];
