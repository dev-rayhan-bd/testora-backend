import { Types } from "mongoose";
import { BadRequestError, NotFoundError } from "../../errors/request/apiError";
import User from "../user/user.model";
import {
  PAYMENT_PROVIDER,
  SUBSCRIPTION_PLAN,
  SUBSCRIPTION_PLAN_TYPE,
  SUBSCRIPTION_STATUS,
  TSubscriptionPlan,
} from "./subscription.constant";
import { ISubscription } from "./subscription.interface";
import Subscription from "./subscription.model";
import {
  TInAppPurchasePayload,
  TUpdateSubscriptionStatusPayload,
} from "./subscription.zod";

// Helper to map product title to internal plan enum if matching
const mapProductToPlan = (productName: string): TSubscriptionPlan | null => {
  const p = productName.toLowerCase();
  if (p.includes("full")) return SUBSCRIPTION_PLAN.FULL_ACCESS;
  if (p.includes("semi")) return SUBSCRIPTION_PLAN.SEMI_MATURA;
  if (p.includes("matura")) return SUBSCRIPTION_PLAN.MATURA;
  if (p.includes("entrance") || p.includes("provime")) {
    return SUBSCRIPTION_PLAN.PROVIME;
  }
  return null;
};

// Helper to map payment provider to clean UI display name
const normalizePaymentProvider = (
  payment?: string,
  provider?: string
): string => {
  const val = (payment || provider || "").trim().toLowerCase();
  if (val.includes("apple") || val === "apple_iap")
    return PAYMENT_PROVIDER.APPLE;
  if (val.includes("google") || val === "google_play")
    return PAYMENT_PROVIDER.GOOGLE_PLAY;
  if (val.includes("stripe")) return PAYMENT_PROVIDER.STRIPE;
  if (val.includes("card")) return PAYMENT_PROVIDER.CARD;
  if (val.includes("paypal")) return PAYMENT_PROVIDER.PAYPAL;
  if (val.includes("manual")) return PAYMENT_PROVIDER.MANUAL;
  return payment || PAYMENT_PROVIDER.APPLE;
};

// Format planType to UI display title
const formatPlanType = (type: string): string => {
  const t = (type || "").toLowerCase();
  if (t === "yearly") return "Yearly";
  if (t === "monthly") return "Monthly";
  if (t === "one-time" || t === "onetime") return "One-time";
  return type;
};

// Format status to UI display title
const formatStatus = (status: string): string => {
  const s = (status || "").toLowerCase();
  if (s === "active") return "Active";
  if (s === "expired") return "Expired";
  if (s === "cancelled") return "Cancelled";
  return status;
};

// ── 1. Mobile In-App Purchase Sync ──────────────────────────────────────────
const recordInAppPurchase = async (
  userId: string,
  payload: TInAppPurchasePayload
): Promise<ISubscription> => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const startDate = payload.startDate ? new Date(payload.startDate) : new Date();

  // Compute expiry date if not explicitly passed
  let expiryDate: Date;
  if (payload.expiryDate) {
    expiryDate = new Date(payload.expiryDate);
  } else {
    expiryDate = new Date(startDate.getTime());
    if (payload.planType === SUBSCRIPTION_PLAN_TYPE.MONTHLY) {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else if (payload.planType === SUBSCRIPTION_PLAN_TYPE.YEARLY) {
      expiryDate.setDate(expiryDate.getDate() + 365);
    } else {
      // One-time entrance exam prep access (default 180 days)
      expiryDate.setDate(expiryDate.getDate() + 180);
    }
  }

  const payment = normalizePaymentProvider(
    payload.payment,
    payload.paymentProvider
  );
  const internalPlan = mapProductToPlan(payload.product);

  const subscriptionData: Partial<ISubscription> = {
    user: new Types.ObjectId(userId),
    product: payload.product,
    plan: internalPlan,
    planType: payload.planType,
    price: payload.price || 0,
    currency: payload.currency || "EUR",
    payment,
    orderId: payload.orderId,
    purchaseToken: payload.purchaseToken || null,
    startDate,
    activatedAt: startDate,
    expiryDate,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  };

  // Check if this orderId was already recorded (idempotent / renew)
  let subscription = await Subscription.findOne({ orderId: payload.orderId });

  if (subscription) {
    Object.assign(subscription, subscriptionData);
    await subscription.save();
  } else {
    subscription = await Subscription.create(subscriptionData);
  }

  // Update user's active subscription reference and plan
  user.subscription = subscription._id as any;
  if (internalPlan) {
    user.plan = internalPlan as any;
  }
  await user.save();

  return subscription;
};

// ── 2. Admin: Subscription Stats Overview ────────────────────────────────────
const getSubscriptionOverview = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [activeCount, expiredThisMonthCount, cancelledCount, expiringSoonCount] =
    await Promise.all([
      // 1. Active Subscriptions
      Subscription.countDocuments({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiryDate: { $gt: now },
      }),

      // 2. Expired This Month
      Subscription.countDocuments({
        $or: [
          {
            status: SUBSCRIPTION_STATUS.EXPIRED,
            expiryDate: { $gte: startOfMonth },
          },
          {
            status: SUBSCRIPTION_STATUS.ACTIVE,
            expiryDate: { $gte: startOfMonth, $lt: now },
          },
        ],
      }),

      // 3. Cancelled Plans
      Subscription.countDocuments({
        status: SUBSCRIPTION_STATUS.CANCELLED,
      }),

      // 4. Expiring Soon (within 30 days)
      Subscription.countDocuments({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiryDate: { $gte: now, $lte: next30Days },
      }),
    ]);

  return {
    activeSubscriptions: activeCount,
    activeGrowthRate: "+12%",
    expiredThisMonth: expiredThisMonthCount,
    cancelledPlans: cancelledCount,
    expiringSoon: expiringSoonCount,
  };
};

// ── 3. Admin: Filtered & Paginated Subscription List ─────────────────────────
const getAllSubscriptions = async (query: Record<string, unknown>) => {
  const {
    page = 1,
    limit = 10,
    searchTerm,
    plan,
    product,
    planType,
    status,
    expiring,
  } = query;

  const now = new Date();
  const andConditions: any[] = [];

  // Filter: Product or Plan
  const targetProductOrPlan = (product || plan) as string | undefined;
  if (targetProductOrPlan && typeof targetProductOrPlan === "string") {
    const clean = targetProductOrPlan.trim().toLowerCase();
    if (clean !== "all" && clean !== "all products" && clean !== "all packages") {
      let regexPattern = clean;
      if (clean === "semi_matura" || clean.includes("semi")) regexPattern = "semi";
      else if (clean === "matura") regexPattern = "^matura|matura package";
      else if (clean === "provime" || clean.includes("entrance")) regexPattern = "provime|entrance";
      else if (clean === "full-access" || clean.includes("full")) regexPattern = "full";

      andConditions.push({
        $or: [
          { product: { $regex: new RegExp(regexPattern, "i") } },
          { plan: { $regex: new RegExp(regexPattern, "i") } },
        ],
      });
    }
  }

  // Filter: Plan Type (monthly, yearly, one-time)
  if (planType && typeof planType === "string") {
    const cleanType = planType.trim().toLowerCase();
    if (cleanType !== "all") {
      andConditions.push({
        planType: { $regex: new RegExp(`^${cleanType}$`, "i") },
      });
    }
  }

  // Filter: Status (active, expired, cancelled)
  if (status && typeof status === "string") {
    const cleanStatus = status.trim().toLowerCase();
    if (cleanStatus !== "all") {
      andConditions.push({
        status: { $regex: new RegExp(`^${cleanStatus}$`, "i") },
      });
    }
  }

  // Filter: Expiring soon (7d, 30d)
  if (expiring && typeof expiring === "string") {
    const cleanExp = expiring.trim().toLowerCase();
    if (cleanExp === "7d") {
      const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      andConditions.push({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiryDate: { $gte: now, $lte: next7Days },
      });
    } else if (cleanExp === "30d") {
      const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      andConditions.push({
        status: SUBSCRIPTION_STATUS.ACTIVE,
        expiryDate: { $gte: now, $lte: next30Days },
      });
    }
  }

  const baseMatchStage =
    andConditions.length > 0 ? { $match: { $and: andConditions } } : null;

  // Search filter across Order ID or Populated User's Name / Email
  const searchMatchStage: any = {};
  if (searchTerm && typeof searchTerm === "string") {
    const term = searchTerm.trim();
    searchMatchStage.$or = [
      { orderId: { $regex: term, $options: "i" } },
      { "userDoc.fullName": { $regex: term, $options: "i" } },
      { "userDoc.email": { $regex: term, $options: "i" } },
    ];
  }

  const pipeline: any[] = [];

  if (baseMatchStage) {
    pipeline.push(baseMatchStage);
  }

  // Lookup user details
  pipeline.push({
    $lookup: {
      from: "users",
      localField: "user",
      foreignField: "_id",
      as: "userDoc",
    },
  });

  pipeline.push({
    $unwind: {
      path: "$userDoc",
      preserveNullAndEmptyArrays: true,
    },
  });

  if (searchTerm) {
    pipeline.push({ $match: searchMatchStage });
  }

  const facetPipeline = [
    ...pipeline,
    {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: (Number(page) - 1) * Number(limit) },
          { $limit: Number(limit) },
        ],
        total: [{ $count: "count" }],
      },
    },
  ];

  const result = await Subscription.aggregate(facetPipeline);
  const rawData = result[0]?.data || [];
  const total = result[0]?.total[0]?.count || 0;

  const data = rawData.map((sub: any) => {
    const expDate = new Date(sub.expiryDate);
    const diffMs = expDate.getTime() - now.getTime();
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      id: sub._id,
      _id: sub._id,
      user: {
        id: sub.userDoc?._id || sub.user,
        fullName: sub.userDoc?.fullName || "Student",
        email: sub.userDoc?.email || "N/A",
        avatar: sub.userDoc?.avatar || null,
      },
      product: sub.product,
      plan: sub.plan || null,
      planType: formatPlanType(sub.planType),
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      daysLeft: daysLeft > 0 ? daysLeft : 0,
      isExpiringSoon: daysLeft > 0 && daysLeft <= 30,
      status: formatStatus(sub.status),
      payment: sub.payment,
      orderId: sub.orderId,
      price: sub.price,
      currency: sub.currency,
      createdAt: sub.createdAt,
    };
  });

  return {
    meta: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
    data,
  };
};

// ── 4. User: Get Current Active Subscription ─────────────────────────────────
const getMySubscription = async (userId: string) => {
  const subscription = await Subscription.findOne({
    user: new Types.ObjectId(userId),
    status: SUBSCRIPTION_STATUS.ACTIVE,
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!subscription) {
    return null;
  }

  const now = new Date();
  const expDate = new Date(subscription.expiryDate);
  const diffMs = expDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    ...subscription,
    daysLeft: daysLeft > 0 ? daysLeft : 0,
    planType: formatPlanType(subscription.planType),
    status: formatStatus(subscription.status),
  };
};

// ── 5. Admin: Update Subscription Status (Cancel / Extend) ───────────────────
const updateSubscriptionStatus = async (
  subscriptionId: string,
  payload: TUpdateSubscriptionStatusPayload
) => {
  const sub = await Subscription.findById(subscriptionId);
  if (!sub) {
    throw new NotFoundError("Subscription not found.");
  }

  if (payload.status) {
    sub.status = payload.status;
    if (payload.status === SUBSCRIPTION_STATUS.CANCELLED) {
      sub.cancelledAt = new Date();
      sub.cancellationReason =
        payload.cancellationReason || "Cancelled by admin";
    }
  }

  if (payload.extensionDays && payload.extensionDays > 0) {
    const currentExp = new Date(sub.expiryDate);
    currentExp.setDate(currentExp.getDate() + Number(payload.extensionDays));
    sub.expiryDate = currentExp;
    sub.status = SUBSCRIPTION_STATUS.ACTIVE;
  }

  if (payload.expiryDate) {
    sub.expiryDate = new Date(payload.expiryDate);
    sub.status = SUBSCRIPTION_STATUS.ACTIVE;
  }

  await sub.save();
  return sub;
};

export const subscriptionService = {
  recordInAppPurchase,
  getSubscriptionOverview,
  getAllSubscriptions,
  getMySubscription,
  updateSubscriptionStatus,
};
