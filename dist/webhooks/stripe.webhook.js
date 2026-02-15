'use strict';
var __createBinding =
    (this && this.__createBinding) ||
    (Object.create
        ? function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              var desc = Object.getOwnPropertyDescriptor(m, k);
              if (!desc || ('get' in desc ? !m.__esModule : desc.writable || desc.configurable)) {
                  desc = {
                      enumerable: true,
                      get: function () {
                          return m[k];
                      },
                  };
              }
              Object.defineProperty(o, k2, desc);
          }
        : function (o, m, k, k2) {
              if (k2 === undefined) k2 = k;
              o[k2] = m[k];
          });
var __setModuleDefault =
    (this && this.__setModuleDefault) ||
    (Object.create
        ? function (o, v) {
              Object.defineProperty(o, 'default', { enumerable: true, value: v });
          }
        : function (o, v) {
              o['default'] = v;
          });
var __importStar =
    (this && this.__importStar) ||
    (function () {
        var ownKeys = function (o) {
            ownKeys =
                Object.getOwnPropertyNames ||
                function (o) {
                    var ar = [];
                    for (var k in o)
                        if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
                    return ar;
                };
            return ownKeys(o);
        };
        return function (mod) {
            if (mod && mod.__esModule) return mod;
            var result = {};
            if (mod != null)
                for (var k = ownKeys(mod), i = 0; i < k.length; i++)
                    if (k[i] !== 'default') __createBinding(result, mod, k[i]);
            __setModuleDefault(result, mod);
            return result;
        };
    })();
Object.defineProperty(exports, '__esModule', { value: true });
exports.stripeWebhookHandler = void 0;
const stripe_config_1 = require('../config/stripe.config');
const env_config_1 = require('../config/env.config');
const subscription_model_1 = __importStar(require('../models/subscription.model'));
const stripeWebhookHandler = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        console.error('Missing stripe-signature header');
        return res.status(400).send('Missing Stripe signature');
    }
    let event;
    try {
        // ⚠️ req.body must be raw (express.raw({ type: 'application/json' }))
        event = stripe_config_1.stripeClient.webhooks.constructEvent(
            req.body,
            sig,
            env_config_1.Env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error('Webhook signature verification failed:', error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }
    try {
        switch (event.type) {
            case 'customer.subscription.trial_will_end': {
                const subscription = event.data.object;
                console.log(`Trial will end for user ${subscription.metadata?.userId}`);
                break;
            }
            case 'checkout.session.completed': {
                const session = event.data.object;
                await handleCheckoutSessionCompleted(session);
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                await handleInvoicePaymentSucceeded(invoice);
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                await handleInvoicePaymentFailed(invoice);
                break;
            }
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await handleCustomerSubscriptionUpdated(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await handleCustomerSubscriptionDeleted(subscription);
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        // ✅ Respond 200 after successful handling
        return res.status(200).json({ received: true });
    } catch (error) {
        console.error('Error processing Stripe event:', error.message);
        // ⚠ Respond 500 to Stripe; optionally retry webhook later
        return res.status(500).send('Webhook handler error');
    }
};
exports.stripeWebhookHandler = stripeWebhookHandler;
async function handleCheckoutSessionCompleted(session) {
    console.log(`Inside checkout.session.completed`);
    const stripeSubscriptionId = session.subscription;
    if (!stripeSubscriptionId) return;
    const subscription =
        await stripe_config_1.stripeClient.subscriptions.retrieve(stripeSubscriptionId);
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    const status = subscription_model_1.SubscriptionStatus.ACTIVE;
    const update = {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id,
        plan: getPlan(subscription),
        stripeCurrentPeriodStart: new Date(subscription.items.data[0]?.current_period_start * 1000),
        stripeCurrentPeriodEnd: new Date(subscription.items.data[0]?.current_period_end * 1000),
        status,
        upgradedAt: new Date(),
    };
    await subscription_model_1.default.findOneAndUpdate(
        {
            userId,
            status: { $ne: subscription_model_1.SubscriptionStatus.ACTIVE },
        },
        { $set: update },
        { upsert: true }
    );
    console.log(
        `Checkout completed for user${userId}- Status:${status}Stripe status:${subscription.status}`
    );
}
async function handleInvoicePaymentSucceeded(invoice) {
    console.log('Inside Invoice.payment_succeeded', `Amount:${invoice.amount_paid / 100}`);
    const subscriptionId = invoice.parent?.subscription_details?.subscription;
    console.log('subscription Id', subscriptionId);
    console.log(invoice.lines.data[0].parent?.subscription_item_details);
    if (!subscriptionId) return;
    const subscription = await stripe_config_1.stripeClient.subscriptions.retrieve(subscriptionId);
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
        status: subscription_model_1.SubscriptionStatus.ACTIVE,
        upgradedAt: new Date(),
    };
    await subscription_model_1.default.findOneAndUpdate(
        {
            userId,
            status: { $ne: subscription_model_1.SubscriptionStatus.ACTIVE },
        },
        { $set: update },
        { upsert: true }
    );
    console.log(`Payment Succeeded - User ${userId} upgraded to ACTIVE`);
}
async function handleInvoicePaymentFailed(invoice) {
    const subscriptionId = invoice.lines.data[0]?.subscription;
    if (!subscriptionId) return;
    const subscription = await stripe_config_1.stripeClient.subscriptions.retrieve(subscriptionId);
    const userId = subscription.metadata?.userId;
    if (!userId) return;
    await subscription_model_1.default.findOneAndUpdate(
        { userId },
        {
            $set: {
                plan: null,
                status: subscription_model_1.SubscriptionStatus.PAYMENT_FAILED,
            },
        }
    );
    console.log(`Payment failed - user ${userId}`);
}
async function handleCustomerSubscriptionUpdated(stripeSubscription) {
    console.log(`Inside customer.subscription.updated`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;
    if (stripeSubscription.status === 'trialing') {
        console.log('Skiping trialing subscirption');
        return;
    }
    const priceId = stripeSubscription.items.data[0].price.id;
    const plan = getPlan(stripeSubscription);
    const currentSub = await subscription_model_1.default.findOne({ userId });
    if (!currentSub) return;
    const isPlanSwitch = currentSub?.plan !== plan || currentSub.stripePriceId !== priceId;
    if (isPlanSwitch && stripeSubscription.status === 'active') {
        await subscription_model_1.default.findOneAndUpdate(
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
async function handleCustomerSubscriptionDeleted(stripeSubscription) {
    console.log(`Inside customer.subscription.deleted`, stripeSubscription.status);
    const userId = stripeSubscription.metadata?.userId;
    if (!userId) return;
    const isTrialExpired = stripeSubscription.trial_end && stripeSubscription.status === 'canceled';
    await subscription_model_1.default.findOneAndUpdate(
        { userId },
        {
            $set: {
                status: isTrialExpired
                    ? subscription_model_1.SubscriptionStatus.TRIAL_EXPIRED
                    : subscription_model_1.SubscriptionStatus.CANCELED,
                ...(!isTrialExpired && { canceledAt: new Date() }),
            },
        }
    );
    console.log(`Subscription ${isTrialExpired ? 'trial expired' : 'canceled'} - User ${userId}`);
}
function getPlan(subscription) {
    const priceId = subscription.items.data[0].price.id;
    if (priceId === env_config_1.Env.STRIPE_MONTHLY_PLAN_PRICE_ID) {
        return subscription_model_1.SubscriptionPlanEnum.MONTHLY;
    } else if (priceId === env_config_1.Env.STRIPE_YEARLY_PLAN_PRICE_ID) {
        return subscription_model_1.SubscriptionPlanEnum.YEARLY;
    }
    return null;
}
