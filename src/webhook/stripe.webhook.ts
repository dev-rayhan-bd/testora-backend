import { Request, Response } from 'express';
import Stripe from 'stripe';
import { BadRequestError } from '../app/errors/request/apiError';
import { ORDER_STATUS, PAYMENT_STATUS } from '../app/modules/order/order.constant';
import Order from '../app/modules/order/order.model';
import { productService } from '../app/modules/product/product.service';
import config from '../config';

const stripe = new Stripe(config.stripe_secret_key as string);

export const stripeWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = config.stripe_webhook_secret as string;

  if (!sig || !webhookSecret) {
    res.status(400).json({ error: 'Missing stripe signature or webhook secret' });
    return;
  }

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('⚠️ Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  console.log(`🔔 Received Stripe Webhook Event: ${event.type}`);

  try {
    switch (event.type) {
      // ── 1. Checkout Session Completed (Order Paid) ──────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const orderId = session.metadata?.orderId;

        if (orderId) {
          const order = await Order.findById(orderId);
          if (order) {
            order.payment.status = PAYMENT_STATUS.PAID;
            order.payment.paidAt = new Date();
            order.payment.stripeSessionId = session.id;
            if (session.payment_intent) {
              order.payment.stripePaymentIntentId = session.payment_intent as string;
            }
            if (order.orderStatus === ORDER_STATUS.PENDING) {
              order.orderStatus = ORDER_STATUS.CONFIRMED;
            }
            await order.save();
            console.log(`✅ Order '${order.orderNumber}' marked as PAID via Stripe Checkout.`);
          }
        }
        break;
      }

      // ── 2. Payment Intent Succeeded ─────────────────────────────────────────
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as any;
        const orderId = paymentIntent.metadata?.orderId;

        const order = orderId
          ? await Order.findById(orderId)
          : await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id });

        if (order && order.payment.status !== PAYMENT_STATUS.PAID) {
          order.payment.status = PAYMENT_STATUS.PAID;
          order.payment.paidAt = new Date();
          order.payment.stripePaymentIntentId = paymentIntent.id;
          if (order.orderStatus === ORDER_STATUS.PENDING) {
            order.orderStatus = ORDER_STATUS.CONFIRMED;
          }
          await order.save();
          console.log(`✅ Order '${order.orderNumber}' payment succeeded.`);
        }
        break;
      }

      // ── 3. Payment Intent Failed ────────────────────────────────────────────
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as any;
        const orderId = paymentIntent.metadata?.orderId;

        const order = orderId
          ? await Order.findById(orderId)
          : await Order.findOne({ 'payment.stripePaymentIntentId': paymentIntent.id });

        if (order && order.payment.status !== PAYMENT_STATUS.PAID) {
          order.payment.status = PAYMENT_STATUS.FAILED;
          await order.save();
          console.log(`❌ Order '${order.orderNumber}' payment failed.`);
        }
        break;
      }

      // ── 4. Charge Refunded ──────────────────────────────────────────────────
      case 'charge.refunded': {
        const charge = event.data.object as any;
        const paymentIntentId = charge.payment_intent as string;

        if (paymentIntentId) {
          const order = await Order.findOne({
            'payment.stripePaymentIntentId': paymentIntentId,
          });

          if (order && order.orderStatus !== ORDER_STATUS.REFUNDED) {
            order.orderStatus = ORDER_STATUS.REFUNDED;
            order.payment.status = PAYMENT_STATUS.REFUNDED;
            order.payment.refundedAt = new Date();
            order.cancellationReason = 'Refund processed via Stripe dashboard';

            // Restore inventory for refunded items
            for (const item of order.items) {
              await productService.restoreStock(
                item.product.toString(),
                item.quantity,
                item.variantId?.toString(),
              );
            }

            await order.save();
            console.log(`↩️ Order '${order.orderNumber}' marked as REFUNDED and stock restored.`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Error processing Stripe webhook event:', err);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
};
