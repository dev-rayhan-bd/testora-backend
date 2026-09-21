import { z } from 'zod';

const createCategorySchema = z.object({
  name: z
    .string({ message: 'Category name is required' })
    .trim()
    .min(2, { message: 'Category name must be at least 2 characters long' })
    .max(100, { message: 'Category name cannot exceed 100 characters' }),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.boolean().default(true),
});

const updateCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: 'Category name must be at least 2 characters long' })
    .max(100, { message: 'Category name cannot exceed 100 characters' })
    .optional(),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.boolean().optional(),
});

export type TCreateCategoryPayload = z.infer<typeof createCategorySchema>;
export type TUpdateCategoryPayload = z.infer<typeof updateCategorySchema>;

const categoryZodSchema = {
  createCategorySchema,
  updateCategorySchema,
};

export default categoryZodSchema;
