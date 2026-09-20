import { z } from 'zod';
import { PRODUCT_STATUS } from './product.constant';

const productVariantSchema = z.object({
  _id: z.string().optional(),
  sku: z.string().trim().optional(),
  color: z.string().trim().optional(),
  size: z.string().trim().optional(),
  price: z.number().min(0, { message: 'Variant price must be non-negative' }).optional(),
  compareAtPrice: z.number().min(0).nullable().optional(),
  stock: z
    .number({ message: 'Variant stock must be a number' })
    .int({ message: 'Variant stock must be an integer' })
    .min(0, { message: 'Variant stock cannot be negative' })
    .default(0),
  image: z.string().url({ message: 'Variant image must be a valid URL' }).optional(),
});

const createProductSchema = z
  .object({
    title: z
      .string({ message: 'Product title must be a string' })
      .trim()
      .min(2, { message: 'Title must be at least 2 characters long' })
      .max(200, { message: 'Title cannot exceed 200 characters' }),
    sku: z.string().trim().optional(),
    description: z
      .string({ message: 'Product description must be a string' })
      .trim()
      .min(10, { message: 'Description must be at least 10 characters long' }),
    price: z
      .number({ message: 'Product price must be a number' })
      .min(0, { message: 'Price must be non-negative' }),
    compareAtPrice: z
      .number({ message: 'Compare at price must be a number' })
      .min(0, { message: 'Compare at price must be non-negative' })
      .nullable()
      .optional(),
    stock: z
      .number({ message: 'Stock must be a number' })
      .int({ message: 'Stock must be an integer' })
      .min(0, { message: 'Stock cannot be negative' })
      .default(0),
    status: z
      .enum(['draft', 'active', 'hidden'], {
        message: 'Status must be draft, active, or hidden',
      })
      .default('draft'),
    category: z
      .string({ message: 'Product category is required' })
      .trim()
      .min(1, { message: 'Category cannot be empty' }),
    brand: z.literal('Testora').default('Testora'),
    images: z
      .array(
        z.string().url({ message: 'Each image must be a valid URL' }),
      )
      .default([]),
    variants: z.array(productVariantSchema).default([]),
    lowStockAlert: z
      .number()
      .int({ message: 'Low stock alert threshold must be an integer' })
      .min(0, { message: 'Threshold cannot be negative' })
      .default(5),
  })
  .superRefine((data, ctx) => {
    // Enterprise Workflow Validation: No product can go live without at least one image
    if (data.status === 'active' && (!data.images || data.images.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'No product can go live without at least one image.',
      });
    }

    // Compare at price should be higher than or equal to current price if set
    if (
      data.compareAtPrice !== null &&
      data.compareAtPrice !== undefined &&
      data.compareAtPrice < data.price
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['compareAtPrice'],
        message: 'Compare at price must be greater than or equal to selling price.',
      });
    }
  });

const updateProductSchema = z
  .object({
    title: z
      .string({ message: 'Product title must be a string' })
      .trim()
      .min(2, { message: 'Title must be at least 2 characters long' })
      .max(200, { message: 'Title cannot exceed 200 characters' })
      .optional(),
    sku: z.string().trim().optional(),
    description: z
      .string({ message: 'Product description must be a string' })
      .trim()
      .min(10, { message: 'Description must be at least 10 characters long' })
      .optional(),
    price: z
      .number({ message: 'Price must be a number' })
      .min(0, { message: 'Price must be non-negative' })
      .optional(),
    compareAtPrice: z
      .number({ message: 'Compare at price must be a number' })
      .min(0, { message: 'Compare at price must be non-negative' })
      .nullable()
      .optional(),
    stock: z
      .number({ message: 'Stock must be a number' })
      .int({ message: 'Stock must be an integer' })
      .min(0, { message: 'Stock cannot be negative' })
      .optional(),
    status: z
      .enum(['draft', 'active', 'hidden'], {
        message: 'Status must be draft, active, or hidden',
      })
      .optional(),
    category: z
      .string({ message: 'Category must be a string' })
      .trim()
      .min(1, { message: 'Category cannot be empty' })
      .optional(),
    brand: z.literal('Testora').optional(),
    images: z
      .array(
        z.string().url({ message: 'Each image must be a valid URL' }),
      )
      .optional(),
    variants: z.array(productVariantSchema).optional(),
    lowStockAlert: z
      .number()
      .int({ message: 'Low stock alert must be an integer' })
      .min(0, { message: 'Threshold cannot be negative' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'active' && data.images !== undefined && data.images.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['images'],
        message: 'Active products require at least one image before going live.',
      });
    }

    if (
      data.price !== undefined &&
      data.compareAtPrice !== null &&
      data.compareAtPrice !== undefined &&
      data.compareAtPrice < data.price
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['compareAtPrice'],
        message: 'Compare at price must be greater than or equal to selling price.',
      });
    }
  });

const checkStockAvailabilitySchema = z.object({
  productId: z
    .string({ message: 'Product ID is required' })
    .regex(/^[a-f\d]{24}$/i, { message: 'Invalid product ID format' }),
  variantId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, { message: 'Invalid variant ID format' })
    .optional(),
  quantity: z
    .number({ message: 'Quantity is required' })
    .int({ message: 'Quantity must be an integer' })
    .min(1, { message: 'Quantity must be at least 1' }),
});

const getProductsQuerySchema = z.object({
  searchTerm: z.string().trim().optional(),
  status: z
    .enum(['draft', 'active', 'hidden'])
    .optional(),
  category: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  inStock: z.enum(['true', 'false']).optional(),
  isLowStock: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10).optional(),
  sort: z.string().optional(),
  fields: z.string().optional(),
});

export type TCreateProductPayload = z.infer<typeof createProductSchema>;
export type TUpdateProductPayload = z.infer<typeof updateProductSchema>;
export type TCheckStockPayload = z.infer<typeof checkStockAvailabilitySchema>;
export type TGetProductsQueryPayload = z.infer<typeof getProductsQuerySchema>;

const productZodSchema = {
  createProductSchema,
  updateProductSchema,
  checkStockAvailabilitySchema,
  getProductsQuerySchema,
};

export default productZodSchema;
