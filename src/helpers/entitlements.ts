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
  // Find active subscription that has not expired
  const activeSubscription = await Subscription.findOne({
    user: user._id,
    status: SUBSCRIPTION_STATUS.ACTIVE,
    $or: [
      { expiryDate: { $gte: now } },
      { endDate: { $gte: now } },
    ],
  })
    .sort({ expiryDate: -1, createdAt: -1 })
    .lean();

  if (!activeSubscription) {
    return {
      hasActiveSubscription: false,
      planStatus: null,
      purchasedPlans: [],
      purchasedFaculties: [],
      subscriptionExpiresAt: null,
    };
  }

  const normalizedPlan = normalizePlanStatus(activeSubscription.plan || (user as any).plan);

  if (!normalizedPlan) {
    return {
      hasActiveSubscription: false,
      planStatus: null,
      purchasedPlans: [],
      purchasedFaculties: [],
      subscriptionExpiresAt: null,
    };
  }

  let purchasedPlans: string[] = [];
  if (normalizedPlan === "full_access") {
    purchasedPlans = [
      EXAM_TYPES.MATURA,
      EXAM_TYPES.SEMI_MATURA,
      EXAM_TYPES.ENTRANCE_EXAM,
    ]; // ["matura", "semi_matura", "provime"]
  } else if (normalizedPlan === "matura") {
    purchasedPlans = [EXAM_TYPES.MATURA];
  } else if (normalizedPlan === "semi_matura") {
    purchasedPlans = [EXAM_TYPES.SEMI_MATURA];
  } else if (normalizedPlan === "provime") {
    purchasedPlans = [EXAM_TYPES.ENTRANCE_EXAM];
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

  const expiresAt = activeSubscription.expiryDate || (activeSubscription as any).endDate;

  return {
    hasActiveSubscription: true,
    planStatus: normalizedPlan,
    purchasedPlans,
    purchasedFaculties,
    subscriptionExpiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
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

