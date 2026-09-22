import mongoose, { Schema } from "mongoose";
import {
    PAYMENT_PROVIDER,
    SUBSCRIPTION_MODE,
    SUBSCRIPTION_PLAN,
    SUBSCRIPTION_PLAN_TYPE,
    SUBSCRIPTION_STATUS,
} from "./subscription.constant";
import { ISubscription } from "./subscription.interface";

const SubscriptionSchema = new Schema<ISubscription>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        product: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        plan: {
            type: String,
            enum: [...Object.values(SUBSCRIPTION_PLAN), null],
            default: null,
        },
        planType: {
            type: String,
            enum: Object.values(SUBSCRIPTION_PLAN_TYPE),
            default: SUBSCRIPTION_PLAN_TYPE.YEARLY,
            index: true,
        },
        billingCycle: {
            type: String,
            enum: [...Object.values(SUBSCRIPTION_MODE), null],
            default: null,
        },
        price: {
            type: Number,
            default: 0,
        },
        currency: {
            type: String,
            default: 'EUR',
            trim: true,
        },
        status: {
            type: String,
            enum: Object.values(SUBSCRIPTION_STATUS),
            default: SUBSCRIPTION_STATUS.ACTIVE,
            index: true,
        },
        payment: {
            type: String,
            default: PAYMENT_PROVIDER.APPLE,
            trim: true,
        },
        orderId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        purchaseToken: {
            type: String,
            default: null,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        activatedAt: {
            type: Date,
            default: Date.now,
        },
        expiryDate: {
            type: Date,
            required: true,
            index: true,
        },
        cancelledAt: {
            type: Date,
            default: null,
        },
        cancellationReason: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Compound indexing for ultra-fast query and dashboard filtering
SubscriptionSchema.index({ status: 1, expiryDate: 1 });
SubscriptionSchema.index({ product: 1, planType: 1 });
SubscriptionSchema.index({ createdAt: -1 });

const Subscription = mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
export default Subscription;