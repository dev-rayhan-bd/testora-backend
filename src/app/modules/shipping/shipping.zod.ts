import { z } from 'zod';

const updateShippingSettingSchema = z.object({
  isFreeShippingEnabled: z.boolean().optional(),
  defaultShippingFee: z
    .number({ message: 'Default shipping fee must be a number' })
    .min(0, { message: 'Shipping fee cannot be negative' })
    .optional(),
  freeShippingThreshold: z
    .number({ message: 'Free shipping threshold must be a number' })
    .min(0, { message: 'Free shipping threshold cannot be negative' })
    .optional(),
  estimatedDeliveryDays: z
    .string({ message: 'Estimated delivery days must be text' })
    .trim()
    .min(1, { message: 'Estimated delivery days cannot be empty' })
    .optional(),
});

export type TUpdateShippingSettingPayload = z.infer<
  typeof updateShippingSettingSchema
>;

const shippingZodSchema = {
  updateShippingSettingSchema,
};

export default shippingZodSchema;
