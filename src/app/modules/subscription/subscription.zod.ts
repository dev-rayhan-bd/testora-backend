import { z } from "zod";
import { SUBSCRIPTION_PLAN_TYPE, SUBSCRIPTION_STATUS } from "./subscription.constant";

const inAppPurchaseSchema = z.object({
  product: z
    .string({ message: "Product name is required" })
    .trim()
    .min(1, { message: "Product name cannot be empty" }),
  planType: z.enum(
    [
      SUBSCRIPTION_PLAN_TYPE.MONTHLY,
      SUBSCRIPTION_PLAN_TYPE.YEARLY,
      SUBSCRIPTION_PLAN_TYPE.ONE_TIME,
    ],
    {
      message: "Plan type must be monthly, yearly, or one-time",
    }
  ),
  paymentProvider: z.string().trim().optional(),
  payment: z.string().trim().optional(),
  orderId: z
    .string({ message: "Order ID / Transaction ID is required" })
    .trim()
    .min(1, { message: "Order ID cannot be empty" }),
  purchaseToken: z.string().trim().optional(),
  price: z.coerce.number().min(0).optional().default(0),
  currency: z.string().trim().optional().default("EUR"),
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
});

const updateSubscriptionStatusSchema = z
  .object({
    status: z
      .enum(
        [
          SUBSCRIPTION_STATUS.ACTIVE,
          SUBSCRIPTION_STATUS.EXPIRED,
          SUBSCRIPTION_STATUS.CANCELLED,
        ],
        {
          message: "Status must be active, expired, or cancelled",
        }
      )
      .optional(),
    cancellationReason: z.string().trim().optional(),
    extensionDays: z.coerce.number().int().min(1).optional(),
    expiryDate: z.string().optional(),
  })
  .refine(
    (data) => data.status || data.extensionDays || data.expiryDate,
    {
      message:
        "At least one of 'status', 'extensionDays', or 'expiryDate' must be provided",
    }
  );

const getSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  searchTerm: z.string().trim().optional(),
  product: z.string().trim().optional(),
  planType: z.string().trim().optional(),
  status: z.string().trim().optional(),
  expiring: z.string().trim().optional(),
});

export type TInAppPurchasePayload = z.infer<typeof inAppPurchaseSchema>;
export type TUpdateSubscriptionStatusPayload = z.infer<
  typeof updateSubscriptionStatusSchema
>;

const subscriptionZodSchema = {
  inAppPurchaseSchema,
  updateSubscriptionStatusSchema,
  getSubscriptionsQuerySchema,
};

export default subscriptionZodSchema;