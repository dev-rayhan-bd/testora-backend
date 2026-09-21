import { Schema, model } from 'mongoose';
import { DEFAULT_SHIPPING_CONFIG } from './shipping.constant';
import {
  IShippingSetting,
  IShippingSettingModel,
} from './shipping.interface';

const shippingSettingSchema = new Schema<IShippingSetting, IShippingSettingModel>(
  {
    isFreeShippingEnabled: {
      type: Boolean,
      default: DEFAULT_SHIPPING_CONFIG.isFreeShippingEnabled,
    },
    defaultShippingFee: {
      type: Number,
      required: [true, 'Default shipping fee is required'],
      min: [0, 'Shipping fee cannot be negative'],
      default: DEFAULT_SHIPPING_CONFIG.defaultShippingFee,
    },
    freeShippingThreshold: {
      type: Number,
      required: [true, 'Free shipping threshold is required'],
      min: [0, 'Free shipping threshold cannot be negative'],
      default: DEFAULT_SHIPPING_CONFIG.freeShippingThreshold,
    },
    estimatedDeliveryDays: {
      type: String,
      trim: true,
      default: DEFAULT_SHIPPING_CONFIG.estimatedDeliveryDays,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Singleton static method: ensures there is always one settings record
shippingSettingSchema.statics.getSettings = async function (): Promise<IShippingSetting> {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create(DEFAULT_SHIPPING_CONFIG);
  }
  return settings;
};

const ShippingSetting = model<IShippingSetting, IShippingSettingModel>(
  'ShippingSetting',
  shippingSettingSchema,
);

export default ShippingSetting;
