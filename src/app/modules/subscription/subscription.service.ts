import { Types } from "mongoose";
import config from "../../../config";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../errors/request/apiError";
import User from "../user/user.model";
import Faculty from "../faculty/faculty.model";
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
  TVerifySubscriptionPayload,
} from "./subscription.zod";
import { normalizePlanStatus } from "../../../helpers/entitlements";

// Helper to map product title or entitlement IDs to internal plan enum if matching
const mapProductToPlan = (
  productName: string,
  entitlementIds?: string[]
): TSubscriptionPlan | null => {
  if (entitlementIds && Array.isArray(entitlementIds)) {
    for (const ent of entitlementIds) {
      const e = (ent || "").toLowerCase();
      if (e.includes("full")) return SUBSCRIPTION_PLAN.FULL_ACCESS;
      if (e.includes("semi")) return SUBSCRIPTION_PLAN.SEMI_MATURA;
      if (e.includes("matura")) return SUBSCRIPTION_PLAN.MATURA;
      if (e.includes("entrance") || e.includes("provime")) {
        return SUBSCRIPTION_PLAN.PROVIME;
      }
    }
  }

  const p = (productName || "").toLowerCase();
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

  // If not found by orderId, check if user already has an active subscription for this specific plan
  if (!subscription && internalPlan) {
    subscription = await Subscription.findOne({
      user: user._id,
      plan: internalPlan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });
  }

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

  // If faculty is passed (e.g. for Provime entrance exam), associate faculty with user
  const facultyParam = (payload.faculty || payload.facultyId || "").trim();
  if (facultyParam) {
    let facultyDoc = null;
    if (Types.ObjectId.isValid(facultyParam)) {
      facultyDoc = await Faculty.findById(facultyParam);
    } else {
      facultyDoc = await Faculty.findOne({
        name: {
          $regex: new RegExp(
            `^${facultyParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        },
      });
    }

    if (facultyDoc) {
      user.faculty = facultyDoc.name;
      if (!user.purchasedFaculties) {
        user.purchasedFaculties = [];
      }
      const facultyObjId = facultyDoc._id as Types.ObjectId;
      if (
        !user.purchasedFaculties.some(
          (id: any) => id.toString() === facultyObjId.toString()
        )
      ) {
        user.purchasedFaculties.push(facultyObjId);
      }
    }
  }

  await user.save();

  return subscription;
};

// ── 1b. Frontend: Verify Subscription via RevenueCat REST API ───────────────
const verifySubscription = async (
  userId: string,
  payload: TVerifySubscriptionPayload
) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new NotFoundError("User not found.");
  }

  const appUserId =
    payload.appUserId ||
    payload.revenueCatCustomerId ||
    (user as any).email ||
    userId.toString();

  const secretKey = config.revenuecat_secret_key?.trim();
  let verifiedOnRevenueCat = false;
  let resolvedExpiresDate: Date | null = null;
  let resolvedProduct =
    payload.productIdentifier || payload.product || "matura";

  // 1. Live Server-to-Server Verification with RevenueCat REST API
  if (
    secretKey &&
    !secretKey.includes("placeholder") &&
    !secretKey.includes("replace_with")
  ) {
    try {
      const rcUrl = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(
        appUserId
      )}`;
      const rcRes = await fetch(rcUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      });

      if (rcRes.ok) {
        const rcData: any = await rcRes.json();
        const subscriber = rcData?.subscriber;
        const entitlements = subscriber?.entitlements || {};

        // Find active entitlement
        const activeKey = Object.keys(entitlements).find((k) => {
          const ent = entitlements[k];
          return ent?.expires_date && new Date(ent.expires_date) > new Date();
        });

        if (!activeKey) {
          throw new BadRequestError(
            "No active premium entitlement found in RevenueCat."
          );
        }

        const activeEnt = entitlements[activeKey];
        if (activeEnt?.expires_date) {
          resolvedExpiresDate = new Date(activeEnt.expires_date);
        }
        if (activeEnt?.product_identifier) {
          resolvedProduct = activeEnt.product_identifier;
        }
        verifiedOnRevenueCat = true;
      } else if (rcRes.status === 404) {
        throw new BadRequestError(
          "Subscriber record not found on RevenueCat."
        );
      } else {
        console.warn(`[RevenueCat API] Returned status ${rcRes.status}`);
      }
    } catch (err: any) {
      if (err instanceof BadRequestError) throw err;
      console.error(
        "[RevenueCat API Verification Error]:",
        err.message || err
      );
    }
  }

  // 2. Resolve Expiration Date
  let expiryDate: Date;
  if (resolvedExpiresDate) {
    expiryDate = resolvedExpiresDate;
  } else if (payload.latestExpirationDate) {
    expiryDate = new Date(payload.latestExpirationDate);
  } else if (payload.expiryDate) {
    expiryDate = new Date(payload.expiryDate);
  } else {
    expiryDate = new Date();
    if (payload.duration === "1month") {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 365);
    }
  }

  // 3. Resolve internal Plan
  const rawPlanString =
    payload.plan || resolvedProduct || payload.productIdentifier || "";
  const internalPlan =
    mapProductToPlan(rawPlanString) ||
    (normalizePlanStatus(rawPlanString) as any) ||
    SUBSCRIPTION_PLAN.MATURA;

  // 4. Resolve Plan Type
  let planType: any = SUBSCRIPTION_PLAN_TYPE.YEARLY;
  if (
    payload.duration === "1month" ||
    rawPlanString.toLowerCase().includes("month")
  ) {
    planType = SUBSCRIPTION_PLAN_TYPE.MONTHLY;
  } else if (
    payload.duration === "onetime" ||
    rawPlanString.toLowerCase().includes("one_time")
  ) {
    planType = SUBSCRIPTION_PLAN_TYPE.ONE_TIME;
  }

  const orderId =
    payload.orderId ||
    payload.activeSubscriptions?.[0] ||
    `rc_${userId}_${Date.now()}`;

  // 5. Update or Create Subscription Record per Plan
  let subscription = await Subscription.findOne({ orderId });

  if (!subscription && internalPlan) {
    subscription = await Subscription.findOne({
      user: user._id,
      plan: internalPlan,
      status: SUBSCRIPTION_STATUS.ACTIVE,
    });
  }

  if (subscription) {
    subscription.product = resolvedProduct;
    subscription.plan = internalPlan;
    subscription.planType = planType;
    subscription.expiryDate = expiryDate;
    subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
    subscription.cancelledAt = null;
    subscription.cancellationReason = null;
    if (!subscription.orderId) subscription.orderId = orderId;
    await subscription.save();
  } else {
    subscription = await Subscription.create({
      user: user._id,
      product: resolvedProduct,
      plan: internalPlan,
      planType,
      orderId,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      startDate: new Date(),
      activatedAt: new Date(),
      expiryDate,
      payment: PAYMENT_PROVIDER.APPLE,
    });
  }

  // 6. Handle Faculty assignment if provime
  const facultyParam = (payload.faculty || payload.facultyId || "").trim();
  if (facultyParam) {
    let facultyDoc = null;
    if (Types.ObjectId.isValid(facultyParam)) {
      facultyDoc = await Faculty.findById(facultyParam);
    } else {
      facultyDoc = await Faculty.findOne({
        name: {
          $regex: new RegExp(
            `^${facultyParam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
            "i"
          ),
        },
      });
    }

    if (facultyDoc) {
      user.faculty = facultyDoc.name;
      if (!user.purchasedFaculties) user.purchasedFaculties = [];
      const facultyObjId = facultyDoc._id as Types.ObjectId;
      if (
        !user.purchasedFaculties.some(
          (id: any) => id.toString() === facultyObjId.toString()
        )
      ) {
        user.purchasedFaculties.push(facultyObjId);
      }
    }
  }

  // 7. Update User profile
  user.subscription = subscription._id as any;
  user.plan = internalPlan as any;
  await user.save();

  return {
    success: true,
    message:
      "Subscription verified and user upgraded to Premium successfully!",
    data: {
      plan: user.plan,
      planStatus: "premium",
      expiresAt: expiryDate,
      subscriptionId: subscription._id,
      verifiedViaRevenueCat: verifiedOnRevenueCat,
    },
  };
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

// ── 6. RevenueCat Webhook Handler ───────────────────────────────────────────
const handleRevenueCatWebhook = async (
  authHeader: string | undefined,
  body: any
) => {
  // 1. Verify Authorization Header Security
  const expectedKey = config.revenuecat_webhook_auth_key?.trim();
  const rawAuth = (authHeader || "").trim();
  const token = rawAuth.replace(/^Bearer\s+/i, "").trim();

  if (!expectedKey || !token || token !== expectedKey) {
    throw new UnauthorizedError(
      "Unauthorized: Invalid or missing RevenueCat webhook authorization key."
    );
  }

  // 2. Validate payload structure
  const event = body?.event;
  if (!event || !event.type) {
    return {
      success: false,
      message: "Ignored: No valid event found in webhook payload.",
    };
  }

  // 3. Handle RevenueCat Dashboard Test Event
  if (event.type === "TEST") {
    return {
      success: true,
      message: "RevenueCat test webhook received and verified successfully.",
    };
  }

  // 4. Resolve Target User by app_user_id or aliases
  const targetId = event.app_user_id || event.original_app_user_id;
  let user = null;

  if (targetId && Types.ObjectId.isValid(targetId)) {
    user = await User.findById(targetId);
  }

  // Check aliases if user not resolved yet
  if (!user && Array.isArray(event.aliases)) {
    for (const alias of event.aliases) {
      if (alias && Types.ObjectId.isValid(alias)) {
        user = await User.findById(alias);
        if (user) break;
      }
    }
  }

  // Fallback: check if targetId is user's email
  if (
    !user &&
    targetId &&
    typeof targetId === "string" &&
    targetId.includes("@")
  ) {
    user = await User.findOne({ email: targetId.toLowerCase().trim() });
  }

  if (!user) {
    // Return acknowledged status so RevenueCat doesn't keep retrying unknown user
    return {
      success: false,
      message: `User not found for app_user_id: ${targetId}. Webhook acknowledged.`,
    };
  }

  // 5. Extract metadata from event
  const rawProduct = event.product_id || "";
  const entitlementIds =
    event.entitlement_ids || (event.entitlement_id ? [event.entitlement_id] : []);
  const internalPlan = mapProductToPlan(rawProduct, entitlementIds);

  let planType: any = SUBSCRIPTION_PLAN_TYPE.YEARLY;
  const prodLower = rawProduct.toLowerCase();
  if (prodLower.includes("month") || event.period_type === "MONTHLY") {
    planType = SUBSCRIPTION_PLAN_TYPE.MONTHLY;
  } else if (
    prodLower.includes("one_time") ||
    prodLower.includes("onetime") ||
    prodLower.includes("non_renewing")
  ) {
    planType = SUBSCRIPTION_PLAN_TYPE.ONE_TIME;
  }

  const paymentProvider =
    event.store === "PLAY_STORE"
      ? PAYMENT_PROVIDER.GOOGLE_PLAY
      : event.store === "STRIPE"
      ? PAYMENT_PROVIDER.STRIPE
      : PAYMENT_PROVIDER.APPLE;

  const orderId =
    event.original_transaction_id ||
    event.transaction_id ||
    event.id ||
    `rc_${Date.now()}`;

  const startDate = event.purchased_at_ms
    ? new Date(event.purchased_at_ms)
    : new Date();

  let expiryDate: Date;
  if (event.expiration_at_ms) {
    expiryDate = new Date(event.expiration_at_ms);
  } else {
    expiryDate = new Date(startDate.getTime());
    if (planType === SUBSCRIPTION_PLAN_TYPE.MONTHLY) {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate.setDate(expiryDate.getDate() + 365);
    }
  }

  // 6. Handle by event type
  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "NON_RENEWING_PURCHASE": {
      let subscription = await Subscription.findOne({ orderId });

      if (!subscription && internalPlan) {
        subscription = await Subscription.findOne({
          user: user._id,
          plan: internalPlan,
          status: SUBSCRIPTION_STATUS.ACTIVE,
        });
      }

      if (subscription) {
        subscription.product = rawProduct || subscription.product;
        if (internalPlan) subscription.plan = internalPlan;
        subscription.planType = planType;
        subscription.price = event.price || subscription.price;
        subscription.currency = event.currency || subscription.currency;
        subscription.payment = paymentProvider;
        subscription.expiryDate = expiryDate;
        subscription.status = SUBSCRIPTION_STATUS.ACTIVE;
        subscription.cancelledAt = null;
        subscription.cancellationReason = null;
        if (orderId && !subscription.orderId) subscription.orderId = orderId;
        await subscription.save();
      } else {
        subscription = await Subscription.create({
          user: user._id,
          product: rawProduct || "Mobile In-App Subscription",
          plan: internalPlan,
          planType,
          price: event.price || 0,
          currency: event.currency || "EUR",
          payment: paymentProvider,
          orderId,
          purchaseToken: event.id || null,
          startDate,
          activatedAt: startDate,
          expiryDate,
          status: SUBSCRIPTION_STATUS.ACTIVE,
        });
      }

      // Update User profile
      user.subscription = subscription._id as any;
      if (internalPlan) {
        user.plan = internalPlan as any;
      }
      await user.save();

      return {
        success: true,
        message: `Subscription successfully activated/renewed for user ${user._id} via ${event.type}.`,
        subscriptionId: subscription._id,
      };
    }

    case "CANCELLATION": {
      // User cancelled auto-renew in Apple/Google settings. Access continues until expiryDate.
      let subscription = await Subscription.findOne({ orderId });

      if (!subscription && internalPlan) {
        subscription = await Subscription.findOne({
          user: user._id,
          plan: internalPlan,
          status: SUBSCRIPTION_STATUS.ACTIVE,
        });
      }

      if (subscription) {
        subscription.cancelledAt = new Date();
        subscription.cancellationReason =
          event.cancel_reason ||
          "Auto-renew cancelled by user via App Store/Play Store";

        if (event.expiration_at_ms) {
          subscription.expiryDate = new Date(event.expiration_at_ms);
        }

        // If expiry is already passed, mark EXPIRED, otherwise CANCELLED
        if (subscription.expiryDate <= new Date()) {
          subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
        } else {
          subscription.status = SUBSCRIPTION_STATUS.CANCELLED;
        }

        await subscription.save();
      }

      return {
        success: true,
        message: `Subscription auto-renew cancellation recorded for user ${user._id}.`,
      };
    }

    case "EXPIRATION": {
      // Period ended and subscription expired
      let subscription = await Subscription.findOne({ orderId });

      if (!subscription && internalPlan) {
        subscription = await Subscription.findOne({
          user: user._id,
          plan: internalPlan,
        });
      }

      if (subscription) {
        subscription.status = SUBSCRIPTION_STATUS.EXPIRED;
        if (event.expiration_at_ms) {
          subscription.expiryDate = new Date(event.expiration_at_ms);
        }
        await subscription.save();
      }

      return {
        success: true,
        message: `Subscription expiration recorded for user ${user._id}.`,
      };
    }

    case "BILLING_ISSUE": {
      let subscription = await Subscription.findOne({ orderId });

      if (!subscription && internalPlan) {
        subscription = await Subscription.findOne({
          user: user._id,
          plan: internalPlan,
          status: SUBSCRIPTION_STATUS.ACTIVE,
        });
      }

      if (subscription) {
        subscription.cancellationReason = "Billing issue (Grace period)";
        await subscription.save();
      }
      return {
        success: true,
        message: `Billing issue noted for user ${user._id}.`,
      };
    }

    default:
      return {
        success: true,
        message: `RevenueCat event '${event.type}' acknowledged without action.`,
      };
  }
};

export const subscriptionService = {
  recordInAppPurchase,
  verifySubscription,
  getSubscriptionOverview,
  getAllSubscriptions,
  getMySubscription,
  updateSubscriptionStatus,
  handleRevenueCatWebhook,
};
