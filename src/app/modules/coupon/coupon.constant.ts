export const DISCOUNT_TYPE = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed',
} as const;

export const COUPON_SEARCHABLE_FIELDS = ['code', 'description'];

export const COUPON_FILTERABLE_FIELDS = [
  'searchTerm',
  'discountType',
  'isActive',
  'isDeleted',
  'page',
  'limit',
  'sort',
];
