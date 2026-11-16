import { Types } from "mongoose";
import { ACCESS_TYPES, EXAM_TYPES } from "../interfaces";
import { IUser } from "../app/modules/user/user.interface";
import Subscription from "../app/modules/subscription/subscription.model";
import { SUBSCRIPTION_STATUS } from "../app/modules/subscription/subscription.constant";
import Faculty from "../app/modules/faculty/faculty.model";

export type TStandardizedPlanStatus =
  | "matura"
  | "semi_matura"
  | "provime"
  | "full_access"
  | null;

export interface IUserEntitlements {
  hasActiveSubscription: boolean;
  planStatus: TStandardizedPlanStatus;
  purchasedPlans: string[];
  purchasedFaculties: string[];
  subscriptionExpiresAt: string | null;
}

export const normalizePlanStatus = (
  rawPlan?: string | null
): TStandardizedPlanStatus => {
  if (!rawPlan) return null;
  const p = rawPlan.toLowerCase().trim().replace(/[-_]/g, "");
  if (p.includes("full")) return "full_access";
  if (p.includes("semi")) return "semi_matura";
  if (p.includes("matur")) return "matura";
  if (p.includes("provim") || p.includes("entrance")) return "provime";
  return null;
};

export const getUserEntitlements = async (
  user: IUser | { _id: Types.ObjectId | string; plan?: string; faculty?: string; purchasedFaculties?: any[] }
): Promise<IUserEntitlements> => {
  if (!user || !user._id) {
    return {
      hasActiveSubscription: false,
      planStatus: null,
      purchasedPlans: [],
      purchasedFaculties: [],
      subscriptionExpiresAt: null,
    };
  }

  const now = new Date();
  // Find ALL active subscriptions that have not expired
  const activeSubscriptions = await Subscription.find({
    user: user._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    $or: [
      { expiryDate: { $gte: now } },
      { endDate: { $gte: now } },
    ],
  })
    .sort({ expiryDate: -1, createdAt: -1 })
    .lean();

  const purchasedPlansSet = new Set<string>();
  let hasFullAccess = false;
  let latestExpiresAt: Date | null = null;
  let primaryPlanStatus: TStandardizedPlanStatus = null;

  for (const sub of activeSubscriptions) {
    const exp = sub.expiryDate || (sub as any).endDate;
    if (exp) {
      const expDate = new Date(exp);
      if (!latestExpiresAt || expDate > latestExpiresAt) {
        latestExpiresAt = expDate;
      }
    }

    const norm = normalizePlanStatus(sub.plan);
    if (norm === "full_access") {
      hasFullAccess = true;
    } else if (norm === "matura") {
      purchasedPlansSet.add(EXAM_TYPES.MATURA);
      if (!primaryPlanStatus) primaryPlanStatus = "matura";
    } else if (norm === "semi_matura") {
      purchasedPlansSet.add(EXAM_TYPES.SEMI_MATURA);
      if (!primaryPlanStatus) primaryPlanStatus = "semi_matura";
    } else if (norm === "provime") {
      purchasedPlansSet.add(EXAM_TYPES.ENTRANCE_EXAM);
      if (!primaryPlanStatus) primaryPlanStatus = "provime";
    }
  }

  // Also take user.plan into account if set
  if ((user as any).plan) {
    const userNorm = normalizePlanStatus((user as any).plan);
    if (userNorm === "full_access") {
      hasFullAccess = true;
    } else if (userNorm === "matura") {
      purchasedPlansSet.add(EXAM_TYPES.MATURA);
    } else if (userNorm === "semi_matura") {
      purchasedPlansSet.add(EXAM_TYPES.SEMI_MATURA);
    } else if (userNorm === "provime") {
      purchasedPlansSet.add(EXAM_TYPES.ENTRANCE_EXAM);
    }
  }

  let purchasedPlans: string[] = [];
  let planStatus: TStandardizedPlanStatus = null;

  if (hasFullAccess) {
    purchasedPlans = [
      EXAM_TYPES.MATURA,
      EXAM_TYPES.SEMI_MATURA,
      EXAM_TYPES.ENTRANCE_EXAM,
    ];
    planStatus = "full_access";
  } else {
    purchasedPlans = Array.from(purchasedPlansSet);
    if (
      purchasedPlans.includes(EXAM_TYPES.MATURA) &&
      purchasedPlans.includes(EXAM_TYPES.SEMI_MATURA) &&
      purchasedPlans.includes(EXAM_TYPES.ENTRANCE_EXAM)
    ) {
      planStatus = "full_access";
    } else if (purchasedPlans.length > 1) {
      planStatus =
        normalizePlanStatus((user as any).plan) ||
        primaryPlanStatus ||
        "full_access";
    } else {
      planStatus =
        primaryPlanStatus ||
        normalizePlanStatus((user as any).plan) ||
        null;
    }
  }

  if (purchasedPlans.length === 0) {
    return {
      hasActiveSubscription: false,
      planStatus: null,
      purchasedPlans: [],
      purchasedFaculties: [],
      subscriptionExpiresAt: null,
    };
  }

  // Resolve purchased faculties for provime/full_access
  const purchasedFacultiesSet = new Set<string>();

  // 1. From user.purchasedFaculties array
  const rawPurchasedFaculties = (user as any).purchasedFaculties || [];
  for (const f of rawPurchasedFaculties) {
    if (f) {
      purchasedFacultiesSet.add(f.toString());
    }
  }

  // 2. From user.faculty field (string name or ObjectId)
  if (user.faculty) {
    const rawFaculty = user.faculty.toString().trim();
    if (Types.ObjectId.isValid(rawFaculty)) {
      purchasedFacultiesSet.add(rawFaculty);
    } else {
      const facultyDoc = await Faculty.findOne({
        name: { $regex: new RegExp(`^${rawFaculty.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      })
        .select("_id")
        .lean();
      if (facultyDoc) {
        purchasedFacultiesSet.add(facultyDoc._id.toString());
      }
    }
  }

  const purchasedFaculties = Array.from(purchasedFacultiesSet);

  return {
    hasActiveSubscription: true,
    planStatus,
    purchasedPlans,
    purchasedFaculties,
    subscriptionExpiresAt: latestExpiresAt ? latestExpiresAt.toISOString() : null,
  };
};

export const isUserEntitledToTest = (
  entitlements: IUserEntitlements,
  test: {
    access?: string;
    examType: string;
    faculty?: any;
  }
): boolean => {
  // If test is free, anyone can access
  if (test.access === ACCESS_TYPES.FREE || test.access === "free") {
    return true;
  }

  // If user has no active subscription, premium is locked
  if (!entitlements.hasActiveSubscription) {
    return false;
  }

  const examType = test.examType;
  if (!entitlements.purchasedPlans.includes(examType)) {
    return false;
  }

  // If provime, verify faculty matches purchasedFaculties
  if (examType === EXAM_TYPES.ENTRANCE_EXAM || examType === "provime") {
    if (!test.faculty) {
      return true; // if test has no faculty restriction, allowed
    }

    const testFacultyId = (typeof test.faculty === "object" && test.faculty?._id)
      ? test.faculty._id.toString()
      : test.faculty.toString();

    return entitlements.purchasedFaculties.includes(testFacultyId);
  }

  return true;
};

