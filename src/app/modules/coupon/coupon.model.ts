import { Schema, model, Types } from 'mongoose';
import { BadRequestError } from '../../errors/request/apiError';
import { DISCOUNT_TYPE } from './coupon.constant';
import { ICoupon, ICouponModel } from './coupon.interface';

const couponSchema = new Schema<ICoupon, ICouponModel>(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: {
        values: Object.values(DISCOUNT_TYPE),
        message: 'Discount type must be percentage or fixed',
      },
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value must be non-negative'],
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount must be non-negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, 'Maximum discount amount must be non-negative'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: [true, 'Expiry date is required'],
      index: true,
    },
    usageLimit: {
      type: Number,
      default: 100,
      min: [1, 'Usage limit must be at least 1'],
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

couponSchema.index({ code: 1, isActive: 1, isDeleted: 1 });

couponSchema.statics.isCodeTaken = async function (
  code: string,
  excludeId?: Types.ObjectId | string,
): Promise<boolean> {
  const query: Record<string, unknown> = {
    code: code.trim().toUpperCase(),
  };
  if (excludeId) {
    query._id = { $ne: new Types.ObjectId(excludeId) };
  }
  const existing = await this.findOne(query).select('_id');
  return !!existing;
};

couponSchema.pre('save', async function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }
  if (this.discountType === DISCOUNT_TYPE.PERCENTAGE && this.discountValue > 100) {
    throw new BadRequestError('Percentage discount cannot exceed 100%');
  }
  if (this.expiryDate && this.startDate && this.expiryDate <= this.startDate) {
    throw new BadRequestError('Expiry date must be after start date');
  }
});

const Coupon = model<ICoupon, ICouponModel>('Coupon', couponSchema);

export default Coupon;
