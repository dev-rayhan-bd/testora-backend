import { ClientSession, Types } from 'mongoose';
import QueryBuilder from '../../../builder/QueryBuilder';
import { BadRequestError, NotFoundError } from '../../errors/request/apiError';
import { COUPON_SEARCHABLE_FIELDS, DISCOUNT_TYPE } from './coupon.constant';
import { ICoupon, IValidateCouponResult } from './coupon.interface';
import Coupon from './coupon.model';
import { TCreateCouponPayload, TUpdateCouponPayload } from './coupon.zod';

const createCoupon = async (payload: TCreateCouponPayload): Promise<ICoupon> => {
  const isTaken = await Coupon.isCodeTaken(payload.code);
  if (isTaken) {
    throw new BadRequestError(`Coupon code '${payload.code.toUpperCase()}' already exists.`);
  }

  const coupon = await Coupon.create(payload);
  return coupon;
};

const getAllCoupons = async (
  query: Record<string, unknown>,
  isAdmin = false,
  userId?: string,
) => {
  const filter: Record<string, any> = {
    isDeleted: false,
  };

  const cleanQuery = { ...query };

  // Support status query parameter ('active' | 'inactive' | 'expired')
  if (cleanQuery.status !== undefined) {
    const statusVal = String(cleanQuery.status).toLowerCase();
    if (statusVal === 'active' || statusVal === 'true') {
      filter.isActive = true;
      filter.expiryDate = { $gte: new Date() };
    } else if (statusVal === 'inactive' || statusVal === 'false') {
      filter.isActive = false;
    } else if (statusVal === 'expired') {
      filter.expiryDate = { $lt: new Date() };
    }
    delete cleanQuery.status;
  }

  // Support explicit isActive query parameter
  if (cleanQuery.isActive !== undefined) {
    filter.isActive = cleanQuery.isActive === 'true' || cleanQuery.isActive === true;
    delete cleanQuery.isActive;
  }

  if (!isAdmin) {
    if (filter.isActive === undefined) {
      filter.isActive = true;
    }
    if (!filter.expiryDate) {
      filter.expiryDate = { $gte: new Date() };
    }
    filter.startDate = { $lte: new Date() };
    // Enterprise Filter: Never show coupons that reached global usage limit to customers
    filter.$expr = { $lt: ['$usedCount', '$usageLimit'] };
  }

  const couponQuery = new QueryBuilder<ICoupon>(Coupon.find(filter), cleanQuery)
    .search(COUPON_SEARCHABLE_FIELDS)
    .filter()
    .sort()
    .paginate()
    .fields();

  const data = await couponQuery.modelQuery;
  const meta = await couponQuery.countTotal();

  let formattedData: any[] = data;

  // If student is logged in, attach personal usage information
  if (!isAdmin && userId) {
    const Order = (await import('../order/order.model')).default;
    const { ORDER_STATUS } = await import('../order/order.constant');

    formattedData = await Promise.all(
      data.map(async (item) => {
        const couponObj = item.toObject();
        const userUsageCount = await Order.countDocuments({
          user: new Types.ObjectId(userId),
          'coupon.code': item.code,
          orderStatus: { $ne: ORDER_STATUS.CANCELLED },
        });

        const isUserLimitReached = userUsageCount >= (item.userUsageLimit || 1);
        return {
          ...couponObj,
          userUsageCount,
          isApplicableForUser: !isUserLimitReached,
        };
      }),
    );
  }

  return {
    meta: {
      page: meta.page,
      limit: meta.limit,
      total: meta.total,
      totalPages: meta.totalPage,
    },
    data: formattedData,
  };
};

const getCouponById = async (id: string): Promise<ICoupon> => {
  const coupon = await Coupon.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!coupon) {
    throw new NotFoundError('Coupon not found or has been deleted.');
  }

  return coupon;
};

const updateCoupon = async (
  id: string,
  payload: TUpdateCouponPayload,
): Promise<ICoupon> => {
  const coupon = await Coupon.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!coupon) {
    throw new NotFoundError('Coupon not found or has been deleted.');
  }

  if (payload.code && payload.code !== coupon.code) {
    const isTaken = await Coupon.isCodeTaken(payload.code, id);
    if (isTaken) {
      throw new BadRequestError(`Coupon code '${payload.code}' is already in use.`);
    }
  }

  Object.assign(coupon, payload);
  const updated = await coupon.save();
  return updated;
};

const deleteCoupon = async (id: string): Promise<ICoupon> => {
  const coupon = await Coupon.findOne({
    _id: new Types.ObjectId(id),
    isDeleted: false,
  });

  if (!coupon) {
    throw new NotFoundError('Coupon not found or already deleted.');
  }

  coupon.isDeleted = true;
  coupon.isActive = false;
  await coupon.save();

  return coupon;
};

/**
 * Validates a coupon code and calculates the discount amount on an order total.
 */
const validateAndCalculateDiscount = async (
  code: string,
  orderAmount: number,
  userId?: string,
): Promise<IValidateCouponResult> => {
  const cleanCode = code.trim().toUpperCase();

  const coupon = await Coupon.findOne({
    code: cleanCode,
    isDeleted: false,
  });

  if (!coupon) {
    throw new NotFoundError(`Invalid voucher coupon code '${cleanCode}'.`);
  }

  if (!coupon.isActive) {
    throw new BadRequestError(`Coupon '${cleanCode}' is currently inactive.`);
  }

  const now = new Date();
  if (coupon.startDate && coupon.startDate > now) {
    throw new BadRequestError(`Coupon '${cleanCode}' is not active yet.`);
  }

  if (coupon.expiryDate && coupon.expiryDate < now) {
    throw new BadRequestError(`Coupon '${cleanCode}' has expired.`);
  }

  if (coupon.usedCount >= coupon.usageLimit) {
    throw new BadRequestError(`Coupon '${cleanCode}' has reached its maximum global usage limit.`);
  }

  // Personal user usage limit check
  if (userId) {
    const Order = (await import('../order/order.model')).default;
    const { ORDER_STATUS } = await import('../order/order.constant');

    const userUsageCount = await Order.countDocuments({
      user: new Types.ObjectId(userId),
      'coupon.code': cleanCode,
      orderStatus: { $ne: ORDER_STATUS.CANCELLED },
    });

    if (userUsageCount >= (coupon.userUsageLimit || 1)) {
      throw new BadRequestError(
        `You have already reached your usage limit for coupon '${cleanCode}'.`,
      );
    }
  }

  if (orderAmount < coupon.minOrderAmount) {
    throw new BadRequestError(
      `Minimum purchase of $${coupon.minOrderAmount} required to use coupon '${cleanCode}'. Current subtotal: $${orderAmount}.`,
    );
  }

  let discountAmount = 0;
  if (coupon.discountType === DISCOUNT_TYPE.PERCENTAGE) {
    discountAmount = (orderAmount * coupon.discountValue) / 100;
    if (coupon.maxDiscountAmount && discountAmount > coupon.maxDiscountAmount) {
      discountAmount = coupon.maxDiscountAmount;
    }
  } else {
    discountAmount = coupon.discountValue;
  }

  // Ensure discount does not exceed order total
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  const finalAmount = Math.max(0, orderAmount - discountAmount);

  return {
    isValid: true,
    coupon: {
      _id: coupon._id as Types.ObjectId,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    },
    discountAmount: Number(discountAmount.toFixed(2)),
    originalAmount: Number(orderAmount.toFixed(2)),
    finalAmount: Number(finalAmount.toFixed(2)),
  };
};

/**
 * Atomically increments coupon usage counter during an ACID transaction.
 */
const incrementCouponUsage = async (
  code: string,
  session?: ClientSession,
): Promise<ICoupon> => {
  const cleanCode = code.trim().toUpperCase();

  const updated = await Coupon.findOneAndUpdate(
    {
      code: cleanCode,
      isDeleted: false,
      isActive: true,
      $expr: { $lt: ['$usedCount', '$usageLimit'] },
    },
    { $inc: { usedCount: 1 } },
    { new: true, session },
  );

  if (!updated) {
    throw new BadRequestError(
      `Coupon '${cleanCode}' is no longer available or usage limit was exceeded.`,
    );
  }

  return updated;
};

export const couponService = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateAndCalculateDiscount,
  incrementCouponUsage,
};
