import { Types } from 'mongoose';
import {
  IShippingCalculationResult,
  IShippingSetting,
} from './shipping.interface';
import ShippingSetting from './shipping.model';
import { TUpdateShippingSettingPayload } from './shipping.zod';

const getShippingSettings = async (): Promise<IShippingSetting> => {
  return await ShippingSetting.getSettings();
};

const updateShippingSettings = async (
  payload: TUpdateShippingSettingPayload,
  adminId?: string,
): Promise<IShippingSetting> => {
  let settings = await ShippingSetting.findOne();
  if (!settings) {
    settings = await ShippingSetting.create({
      ...payload,
      updatedBy: adminId ? new Types.ObjectId(adminId) : undefined,
    });
  } else {
    Object.assign(settings, payload);
    if (adminId) {
      settings.updatedBy = new Types.ObjectId(adminId);
    }
    await settings.save();
  }
  return settings;
};

const calculateShippingFee = async (
  subtotal: number,
): Promise<IShippingCalculationResult> => {
  const settings = await ShippingSetting.getSettings();

  if (settings.isFreeShippingEnabled) {
    return {
      shippingFee: 0,
      isFreeShipping: true,
      threshold: settings.freeShippingThreshold,
      amountNeededForFreeShipping: 0,
    };
  }

  if (subtotal >= settings.freeShippingThreshold) {
    return {
      shippingFee: 0,
      isFreeShipping: true,
      threshold: settings.freeShippingThreshold,
      amountNeededForFreeShipping: 0,
    };
  }

  const amountNeeded = Number(
    Math.max(0, settings.freeShippingThreshold - subtotal).toFixed(2),
  );

  return {
    shippingFee: settings.defaultShippingFee,
    isFreeShipping: false,
    threshold: settings.freeShippingThreshold,
    amountNeededForFreeShipping: amountNeeded,
  };
};

export const shippingService = {
  getShippingSettings,
  updateShippingSettings,
  calculateShippingFee,
};
