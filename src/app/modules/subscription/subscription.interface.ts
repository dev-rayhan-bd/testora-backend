import { Types } from "mongoose";
import {
    TSubscriptionMode,
    TSubscriptionPlan,
    TSubscriptionPlanType,
    TSubscriptionStatus,
} from "./subscription.constant";

export interface ISubscription {
    user: Types.ObjectId;
    product: string;
    plan?: TSubscriptionPlan | null;
    planType: TSubscriptionPlanType;
    billingCycle?: TSubscriptionMode | null;
    status: TSubscriptionStatus;
    price: number;
    currency: string;
    payment: string;
    orderId: string;
    purchaseToken?: string | null;
    startDate: Date;
    activatedAt?: Date | null;
    expiryDate: Date;
    cancelledAt?: Date | null;
    cancellationReason?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}
