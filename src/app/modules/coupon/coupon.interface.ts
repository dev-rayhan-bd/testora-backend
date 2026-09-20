import { Document, Model, Types } from 'mongoose';

export type TDiscountType = 'percentage' | 'fixed';

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  description?: string;
  discountType: TDiscountType;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  startDate: Date;
  expiryDate: Date;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ICouponDocument = ICoupon;

export interface ICouponModel extends Model<ICoupon> {
  isCodeTaken(code: string, excludeId?: Types.ObjectId | string): Promise<boolean>;
}

export interface IValidateCouponResult {
  isValid: boolean;
  coupon: {
    _id: Types.ObjectId;
    code: string;
    discountType: TDiscountType;
    discountValue: number;
  };
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
}
