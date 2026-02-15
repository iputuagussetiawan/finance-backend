'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.swithToSubscriptionPlanService =
    exports.manageSubscriptionBillingPortalService =
    exports.upgradeToProSubscriptionService =
    exports.getUserSubscriptionStatusService =
        void 0;
const env_config_1 = require('../config/env.config');
const stripe_config_1 = require('../config/stripe.config');
const subscription_1 = require('../constant/subscription');
const subscription_model_1 = require('../models/subscription.model');
const user_model_1 = __importDefault(require('../models/user.model'));
const app_error_1 = require('../utils/app-error');
const format_currency_1 = require('../utils/format-currency');
const getUserSubscriptionStatusService = async userId => {
    const user = await user_model_1.default.findById(userId).populate('subscriptionId');
    if (!user || !user.subscriptionId) {
        throw new app_error_1.NotFoundException('No subscription found');
    }
    const subscriptionDoc = user.subscriptionId;
    const isTrialActive = subscriptionDoc.isTrialActive();
    const now = new Date();
    const daysLeft = subscriptionDoc.trialEndsAt
        ? Math.max(
              0,
              Math.ceil(
                  (subscriptionDoc.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              )
          )
        : 0;
    const planData = {
        [subscription_model_1.SubscriptionPlanEnum.MONTHLY]: {
            price: (0, format_currency_1.convertToDollarUnit)(
                subscription_model_1.SubscriptionPriceEnum.MONTHLY
            ),
            billing: 'month',
            savings: null,
            features:
                subscription_1.planFeatures[subscription_model_1.SubscriptionPlanEnum.MONTHLY],
        },
        [subscription_model_1.SubscriptionPlanEnum.YEARLY]: {
            price: (0, format_currency_1.convertToDollarUnit)(
                subscription_model_1.SubscriptionPriceEnum.YEARLY
            ),
            billing: 'year',
            savings: 'Save 17%',
            features: subscription_1.planFeatures[subscription_model_1.SubscriptionPlanEnum.YEARLY],
        },
    };
    const subscriptionData = {
        isTrialActive,
        currentPlan: subscriptionDoc.plan,
        trialEndAt: subscriptionDoc.trialEndsAt,
        trialDays: subscriptionDoc.trialDays,
        status: subscriptionDoc.status,
        daysLeft: isTrialActive ? daysLeft : 0,
        planData,
    };
    return {
        subscriptionData,
    };
};
exports.getUserSubscriptionStatusService = getUserSubscriptionStatusService;
const upgradeToProSubscriptionService = async (userId, body) => {
    const { callbackUrl, plan } = body;
    const user = await user_model_1.default.findById(userId).populate('subscriptionId');
    if (!user) throw new app_error_1.NotFoundException('User not found');
    if (user.subscriptionId?.status === subscription_model_1.SubscriptionStatus.ACTIVE) {
        throw new app_error_1.UnauthorizedException('You already have an active subscription');
    }
    if (!user.stripeCustomerId) {
        const customer = await stripe_config_1.stripeClient.customers.create({
            email: user.email,
            name: user.name,
        });
        user.stripeCustomerId = customer.id;
        await user.save();
    }
    const _userId = user.id?.toString();
    const priceld =
        plan === subscription_model_1.SubscriptionPlanEnum.MONTHLY
            ? env_config_1.Env.STRIPE_MONTHLY_PLAN_PRICE_ID
            : env_config_1.Env.STRIPE_YEARLY_PLAN_PRICE_ID;
    const session = await stripe_config_1.stripeClient.checkout.sessions.create({
        mode: 'subscription',
        customer: user.stripeCustomerId,
        success_url: `${callbackUrl}?success=true&plan=${plan}`,
        cancel_url: `${callbackUrl}?success=false&plan=${plan}`,
        payment_method_types: ['card'],
        billing_address_collection: 'auto',
        line_items: [
            {
                price: priceld,
                quantity: 1,
            },
        ],
        subscription_data: {
            metadata: {
                userId: _userId,
                plan,
            },
        },
    });
    return {
        url: session.url,
    };
};
exports.upgradeToProSubscriptionService = upgradeToProSubscriptionService;
const manageSubscriptionBillingPortalService = async (userId, callbackUrl) => {
    if (!userId) throw new app_error_1.BadRequestException('User ID is missing');
    if (!callbackUrl) throw new app_error_1.BadRequestException('Callback URL is required');
    const user = await user_model_1.default
        .findById(userId)
        .populate('subscriptionId')
        .orFail(() => new app_error_1.NotFoundException('User not found'));
    if (!user.stripeCustomerId) {
        throw new app_error_1.BadRequestException('User does not have a Stripe customer account');
    }
    try {
        const portalSession = await stripe_config_1.stripeClient.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: callbackUrl,
        });
        if (!portalSession.url) {
            throw new app_error_1.InternalServerException(
                'Failed to create billing portal session'
            );
        }
        return portalSession.url;
    } catch (err) {
        console.error('Stripe Billing Portal Error:', err);
        if (
            err.type === 'StripeInvalidRequestError' &&
            err?.raw?.message?.includes('No configuration provided')
        ) {
            throw new app_error_1.InternalServerException(
                'Billing portal is not configured in Stripe dashboard'
            );
        }
        throw new app_error_1.InternalServerException('Unable to open billing portal');
    }
};
exports.manageSubscriptionBillingPortalService = manageSubscriptionBillingPortalService;
const swithToSubscriptionPlanService = async (userId, body) => {
    const { newPlan } = body;
    const user = await user_model_1.default.findById(userId).populate('subscriptionId');
    console.log(user);
    if (!user || !user.subscriptionId.stripeSubscriptionId) {
        throw new app_error_1.UnauthorizedException(
            'you dont have an active subscription to switch'
        );
    }
    if (user.subscriptionId.plan === newPlan) {
        throw new app_error_1.BadRequestException(`You already on the ${newPlan} plan`);
    }
    const subscription = await stripe_config_1.stripeClient.subscriptions.retrieve(
        user.subscriptionId.stripeSubscriptionId
    );
    const priceId =
        newPlan === subscription_model_1.SubscriptionPlanEnum.YEARLY
            ? env_config_1.Env.STRIPE_YEARLY_PLAN_PRICE_ID
            : env_config_1.Env.STRIPE_MONTHLY_PLAN_PRICE_ID;
    if (!priceId)
        throw new app_error_1.InternalServerException('Subscription PriceId Configure Error');
    await stripe_config_1.stripeClient.subscriptions.update(subscription.id, {
        items: [
            {
                id: subscription.items.data[0].id,
                price: priceId,
            },
        ],
        proration_behavior: 'create_prorations',
        payment_behavior: 'error_if_incomplete',
        metadata: {
            userId: user.id,
            plan: newPlan,
        },
    });
    return {
        success: true,
        message: `Plan switch to ${newPlan} is being processed`,
    };
};
exports.swithToSubscriptionPlanService = swithToSubscriptionPlanService;
