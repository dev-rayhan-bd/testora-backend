import { z } from 'zod';
import { DISCOUNT_TYPE } from './coupon.constant';

const preprocessCouponPayload = (val: any) => {
  if (val && typeof val === 'object') {
    const obj = { ...val };
    // Map alias discountAmount -> discountValue
    if (obj.discountAmount !== undefined && obj.discountValue === undefined) {
      obj.discountValue = obj.discountAmount;
    }
    // Map alias minimumOrderAmount -> minOrderAmount
    if (obj.minimumOrderAmount !== undefined && obj.minOrderAmount === undefined) {
      obj.minOrderAmount = obj.minimumOrderAmount;
    }
    // Map alias status ('active' / 'inactive') -> isActive
    if (obj.status !== undefined && obj.isActive === undefined) {
      obj.isActive = obj.status === 'active';
    }
    return obj;
  }
  return val;
};

const createCouponSchema = z
  .preprocess(
    preprocessCouponPayload,
    z.object({
      code: z
        .string({ message: 'Coupon code is required' })
        .trim()
        .min(3, { message: 'Coupon code must be at least 3 characters' })
        .max(30, { message: 'Coupon code cannot exceed 30 characters' })
        .regex(/^[A-Z0-9_-]+$/i, {
          message: 'Coupon code can only contain letters, numbers, hyphens, and underscores',
        }),
      description: z.string().trim().optional(),
      discountType: z.enum(['percentage', 'fixed'], {
        message: 'Discount type must be percentage or fixed',
      }),
      discountValue: z
        .number({ message: 'Discount value is required' })
        .min(0.01, { message: 'Discount value must be greater than zero' }),
      minOrderAmount: z
        .number({ message: 'Minimum order amount must be a number' })
        .min(0, { message: 'Minimum order amount cannot be negative' })
        .default(0),
      maxDiscountAmount: z
        .number({ message: 'Maximum discount amount must be a number' })
        .min(0, { message: 'Maximum discount amount cannot be negative' })
        .nullable()
        .optional(),
      startDate: z.coerce.date().default(() => new Date()),
      expiryDate: z.coerce.date({ message: 'Expiry date is required' }),
      usageLimit: z
        .number()
        .int({ message: 'Usage limit must be an integer' })
        .min(1, { message: 'Usage limit must be at least 1' })
        .default(100),
      userUsageLimit: z
        .number()
        .int({ message: 'User usage limit must be an integer' })
        .min(1, { message: 'User usage limit must be at least 1' })
        .default(1),
      isActive: z.boolean().default(true),
    }),
  )
  .superRefine((data: any, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }

    if (data.expiryDate && data.startDate && data.expiryDate <= data.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['expiryDate'],
        message: 'Expiry date must be after start date',
      });
    }
  });

const updateCouponSchema = z
  .preprocess(
    preprocessCouponPayload,
    z.object({
      code: z
        .string()
        .trim()
        .min(3)
        .max(30)
        .regex(/^[A-Z0-9_-]+$/i)
        .optional(),
      description: z.string().trim().optional(),
      discountType: z.enum(['percentage', 'fixed']).optional(),
      discountValue: z.number().min(0.01).optional(),
      minOrderAmount: z.number().min(0).optional(),
      maxDiscountAmount: z.number().min(0).nullable().optional(),
      startDate: z.coerce.date().optional(),
      expiryDate: z.coerce.date().optional(),
      usageLimit: z.number().int().min(1).optional(),
      userUsageLimit: z.number().int().min(1).optional(),
      isActive: z.boolean().optional(),
    }),
  )
  .superRefine((data: any, ctx) => {
    if (data.discountType === 'percentage' && data.discountValue && data.discountValue > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['discountValue'],
        message: 'Percentage discount cannot exceed 100%',
      });
    }
  });

const validateCouponSchema = z.object({
  code: z
    .string({ message: 'Coupon code is required' })
    .trim()
    .min(1, { message: 'Coupon code cannot be empty' }),
  orderAmount: z
    .number({ message: 'Order amount is required' })
    .min(0, { message: 'Order amount cannot be negative' }),
});

export type TCreateCouponPayload = z.infer<typeof createCouponSchema>;
export type TUpdateCouponPayload = z.infer<typeof updateCouponSchema>;
export type TValidateCouponPayload = z.infer<typeof validateCouponSchema>;

const couponZodSchema = {
  createCouponSchema,
  updateCouponSchema,
  validateCouponSchema,
};

export default couponZodSchema;
