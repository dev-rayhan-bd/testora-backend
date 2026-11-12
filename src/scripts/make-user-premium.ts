import mongoose, { Types } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../app/modules/user/user.model';
import Subscription from '../app/modules/subscription/subscription.model';
import { SUBSCRIPTION_PLAN, SUBSCRIPTION_PLAN_TYPE, SUBSCRIPTION_STATUS } from '../app/modules/subscription/subscription.constant';

async function makePremium() {
  const email = process.argv[2];
  if (!email) {
    console.log('Usage: npx ts-node src/scripts/make-user-premium.ts <user-email>');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URL as string);
  console.log('Connected to DB');

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User with email "${email}" not found.`);
    process.exit(1);
  }

  const startDate = new Date();
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1); // 1 year active

  const orderId = `MANUAL_PREMIUM_${Date.now()}`;

  const subscription = await Subscription.create({
    user: user._id,
    product: 'Full Access Pass',
    plan: SUBSCRIPTION_PLAN.FULL_ACCESS,
    planType: SUBSCRIPTION_PLAN_TYPE.YEARLY,
    price: 0,
    currency: 'EUR',
    payment: 'manual',
    orderId,
    startDate,
    activatedAt: startDate,
    expiryDate,
    status: SUBSCRIPTION_STATUS.ACTIVE,
  });

  user.subscription = subscription._id as any;
  if (!user.plan) {
    user.plan = 'provime';
  }
  await user.save();

  console.log(`\n SUCCESS: User "${user.email}" is now a PREMIUM user!`);
  console.log(`   Subscription ID: ${subscription._id}`);
  console.log(`   Plan: ${user.plan}`);
  console.log(`   Expiry Date: ${expiryDate.toISOString()}`);

  await mongoose.disconnect();
}

makePremium().catch(console.error);

