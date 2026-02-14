import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { stripeClient } from '../config/stripe.config';
import { Env } from '../config/env.config';
import SubscriptionModel, {
    SubscriptionPlanEnum,
    SubscriptionStatus,
} from '../models/subscription.model';

export const stripeWebhookHandler = async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).send('Missing Stripe signature');
    }

    let event: Stripe.Event;

    try {
        // ⚠️ req.body must be raw (express.raw({ type: 'application/json' }))
        event = stripeClient.webhooks.constructEvent(req.body, sig, Env.STRIPE_WEBHOOK_SECRET);
    } catch (error: any) {
        console.error('Webhook signature verification failed:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case 'customer.subscription.trial_will_end': {
                const subscription = event.data.object as Stripe.Subscription;
                console.log(`Trial will end for user ${subscription.metadata?.userId}`);
                break;
            }

            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;
                await handleCheckoutSessionCompleted(session);
                break;
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaymentSucceeded(invoice);
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as Stripe.Invoice;
                await handleInvoicePaymentFailed(invoice);
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleCustomerSubscriptionUpdated(subscription);
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                await handleCustomerSubscriptionDeleted(subscription);
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // ✅ Respond 200 after successful handling
        return res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('Error processing Stripe event:', error.message);
        // ⚠ Respond 500 to Stripe; optionally retry webhook later
        return res.status(500).send('Webhook handler error');
    }
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
    const subscriptionId = invoice.parent?.subscription_details?.subscription as string;
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

async function handleCustomerSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    console.log(`Inside customer.subscription.updated`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;

    if (stripeSubscription.status === 'trialing') {
        console.log('Skiping trialing subscirption');
        return;
    }

    const priceId = stripeSubscription.items.data[0].price.id;
    const plan = getPlan(stripeSubscription);

    const currentSub = await SubscriptionModel.findOne({ userId });

    if (!currentSub) return;
    const isPlanSwitch = currentSub?.plan !== plan || currentSub.stripePriceId !== priceId;

    if (isPlanSwitch && stripeSubscription.status === 'active') {
        await SubscriptionModel.findByIdAndUpdate(
            { userId },
            {
                $set: {
                    plan,
                    stripePriceId: priceId,
                    stripeCurrentPeriodStart: new Date(
                        stripeSubscription.items.data[0].current_period_start * 1000
                    ),
                    stripeCurrentPeriodEnd: new Date(
                        stripeSubscription.items.data[0].current_period_end * 1000
                    ),
                },
            },
            { upsert: true }
        );
        console.log(`Plan switch - user ${userId} from ${currentSub?.plan} to ${plan}`);
    } else {
        console.log(`No Plan Switch detected for user ${userId}`);
    }
}

async function handleCustomerSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    console.log(`Inside customer.subscription.deleted`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;

    if (!userId) return;
    const isTrialExpired = stripeSubscription.trial_end && stripeSubscription.status === 'canceled';

    await SubscriptionModel.findByIdAndUpdate(
        { userId },
        {
            $set: {
                status: isTrialExpired
                    ? SubscriptionStatus.TRIAL_EXPIRED
                    : SubscriptionStatus.CANCELED,
                ...(!isTrialExpired && { canceledAt: new Date() }),
            },
        }
    );

    console.log(`Subscription ${isTrialExpired ? 'trial expired' : 'canceled'} - User ${userId}`);
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
