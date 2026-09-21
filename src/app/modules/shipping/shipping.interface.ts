import { Document, Model, Types } from 'mongoose';

export interface IShippingSetting extends Document {
  _id: Types.ObjectId;
  isFreeShippingEnabled: boolean;
  defaultShippingFee: number;
  freeShippingThreshold: number;
  estimatedDeliveryDays: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type IShippingSettingDocument = IShippingSetting;

export interface IShippingSettingModel extends Model<IShippingSetting> {
  getSettings(): Promise<IShippingSetting>;
}

export interface IShippingCalculationResult {
  shippingFee: number;
  isFreeShipping: boolean;
  threshold: number;
  amountNeededForFreeShipping: number;
}
