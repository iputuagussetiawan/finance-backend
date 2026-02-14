import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripeClient } from '../config/stripe.config';
import { Env } from '../config/env.config';
import SubscriptionModel, {
    SubscriptionPlanEnum,
    SubscriptionStatus,
} from '../models/subscription.model';

export const stripeWebhookHandler = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

    try {
        event = stripeClient.webhooks.constructEvent(req.body, sig, Env.STRIPE_WEBHOOK_SECRET);
    } catch (error: any) {
        return res.status(400).send(`Webhook Error: ${error?.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.trial_will_end':
                console.log(
                    `Trial will end foruser ${(event.data.object as Stripe.Subscription).metadata?.userId}`
                );
                break;
            case 'checkout.session.completed':
                await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
                break;
            case 'invoice.payment_succeeded':
                await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            case 'customer.subscription.updated':
                break;
            case 'customer.subscription.deleted':
                break;
        }
    } catch (error: any) {}
};

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    console.log(`Inside checkout.session.completed`);
    const stripeSubscriptionId = session.subscription as string;
    if (!stripeSubscriptionId) return;
    const subscription = await stripeClient.subscriptions.retrieve(stripeSubscriptionId as string);

    const userId = subscription.metadata?.userId;
    if (!userId) return;
    const status = SubscriptionStatus.ACTIVE;
    const update = {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        plan: getPlan(subscription),
        stripeCurrentPeriodStart: new Date(subscription.items.data[0]?.current_period_start * 1000),
        stripeCurrentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end * 1000),
        status,
        upgradedAt: new Date(),
    };
    await SubscriptionModel.findOneAndUpdate(
        {
            userId,
            status: { $ne: SubscriptionStatus.ACTIVE },
        },
        { $set: update },
        { upsert: true }
    );

    console.log(
        `Checkout completed for user${userId}- Status:${status}Stripe status:${subscription.status}`
    );
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
    console.log('Inside Invoice.payment_succeeded', `Amount:${invoice.amount_paid / 100}`);
    const subscriptionId = invoice.lines.data[0]?.subscription as string;
    if (!subscriptionId) return;
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    if (subscription.status === 'trialing' && invoice.amount_paid === 0) {
        console.log(`Skiping $0 invoice(trial setup)`);
        return;
    }

    const update = {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        plan: getPlan(subscription),
        stripeCurrentPeriodStart: new Date(subscription.items.data[0]?.current_period_start * 1000),
        stripeCurrentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end * 1000),
        status: SubscriptionStatus.ACTIVE,
        upgradedAt: new Date(),
    };
    await SubscriptionModel.findOneAndUpdate(
        {
            userId,
            status: { $ne: SubscriptionStatus.ACTIVE },
        },
        { $set: update },
        { upsert: true }
    );

    console.log(`Payment Succeeded - User ${userId} upgraded to ACTIVE`);
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
    const subscriptionId = invoice.lines.data[0]?.subscription as string;
    if (!subscriptionId) return;
    const subscription = await stripeClient.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;
    if (!userId) return;

    await SubscriptionModel.findByIdAndUpdate(
        { userId },
        {
            $set: {
                plan: null,
                status: SubscriptionStatus.PAYMENT_FAILED,
            },
        }
    );

    console.log(`Payment failed - user ${userId}`);
}

function getPlan(subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0].price.id;

    if (priceId === Env.STRIPE_MONTHLY_PLAN_PRICE_ID) {
        return SubscriptionPlanEnum.MONTHLY;
    } else if (priceId === Env.STRIPE_YEARLY_PLAN_PRICE_ID) {
        return SubscriptionPlanEnum.YEARLY;
    }

    return null;
}
