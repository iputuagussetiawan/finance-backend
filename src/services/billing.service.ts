import { session } from 'passport';
import { Env } from '../config/env.config';
import { stripeClient } from '../config/stripe.config';
import { planFeatures } from '../constant/subscription';
import {
    SubscriptionPlanEnum,
    SubscriptionPriceEnum,
    SubscriptionStatus,
    type SubscriptionDocument,
} from '../models/subscription.model';
import UserModel from '../models/user.model';
import {
    BadRequestException,
    InternalServerException,
    NotFoundException,
    UnauthorizedException,
} from '../utils/app-error';
import { convertToDollarUnit } from '../utils/format-currency';
import type {
    switchToSubscriptionPlanSchemaType,
    upgradeToProSubscriptionSchemaType,
} from '../validators/billing.validator';

export const getUserSubscriptionStatusService = async (userId: string) => {
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>('subscriptionId');
    if (!user || !user.subscriptionId) {
        throw new NotFoundException('No subscription found');
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
        [SubscriptionPlanEnum.MONTHLY]: {
            price: convertToDollarUnit(SubscriptionPriceEnum.MONTHLY),
            billing: 'month',
            savings: null,
            features: planFeatures[SubscriptionPlanEnum.MONTHLY],
        },
        [SubscriptionPlanEnum.YEARLY]: {
            price: convertToDollarUnit(SubscriptionPriceEnum.MONTHLY),
            billing: 'year',
            savings: 'Save 17%',
            features: planFeatures[SubscriptionPlanEnum.YEARLY],
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

export const upgradeToProSubscriptionService = async (
    userId: string,
    body: upgradeToProSubscriptionSchemaType
) => {
    const { callbackUrl, plan } = body;
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>('subscriptionId');

    if (!user) throw new NotFoundException('User not found');
    if (user.subscriptionId?.status === SubscriptionStatus.ACTIVE) {
        throw new UnauthorizedException('You already have an active subscription');
    }

    if (!user.stripeCustomerId) {
        const customer = await stripeClient.customers.create({
            email: user.email,
            name: user.name,
        });
        user.stripeCustomerId = customer.id;
        await user.save();
    }

    const _userId = user.id?.toString();
    const priceld =
        plan === SubscriptionPlanEnum.MONTHLY
            ? Env.STRIPE_MONTHLY_PLAN_PRICE_ID
            : Env.STRIPE_YEARLY_PLAN_PRICE_ID;

    const session = await stripeClient.checkout.sessions.create({
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

export const manageSubscriptionBillingPortalService = async (
    userId: string,
    callbackUrl: string
) => {
    if (!userId) throw new BadRequestException('User ID is missing');
    if (!callbackUrl) throw new BadRequestException('Callback URL is required');

    const user = await UserModel.findById(userId)
        .populate<{ subscriptionId: SubscriptionDocument }>('subscriptionId')
        .orFail(() => new NotFoundException('User not found'));

    if (!user.stripeCustomerId) {
        throw new BadRequestException('User does not have a Stripe customer account');
    }

    try {
        const portalSession = await stripeClient.billingPortal.sessions.create({
            customer: user.stripeCustomerId,
            return_url: callbackUrl,
        });

        if (!portalSession.url) {
            throw new InternalServerException('Failed to create billing portal session');
        }

        return portalSession.url;
    } catch (err: any) {
        console.error('Stripe Billing Portal Error:', err);

        if (
            err.type === 'StripeInvalidRequestError' &&
            err?.raw?.message?.includes('No configuration provided')
        ) {
            throw new InternalServerException(
                'Billing portal is not configured in Stripe dashboard'
            );
        }

        throw new InternalServerException('Unable to open billing portal');
    }
};

export const swithToSubscriptionPlanService = async (
    userId: string,
    body: switchToSubscriptionPlanSchemaType
) => {
    const { newPlan } = body;
    const user = await UserModel.findById(userId).populate<{
        subscriptionId: SubscriptionDocument;
    }>('subscriptionId');

    console.log(user);

    if (!user || !user.subscriptionId.stripeSubscriptionId) {
        throw new UnauthorizedException('you dont have an active subscription to switch');
    }

    if (user.subscriptionId.plan === newPlan) {
        throw new BadRequestException(`You already on the ${newPlan} plan`);
    }

    const subscription = await stripeClient.subscriptions.retrieve(
        user.subscriptionId.stripeSubscriptionId
    );

    const priceId =
        newPlan === SubscriptionPlanEnum.YEARLY
            ? Env.STRIPE_YEARLY_PLAN_PRICE_ID
            : Env.STRIPE_MONTHLY_PLAN_PRICE_ID;

    if (!priceId) throw new InternalServerException('Subscription PriceId Configure Error');

    await stripeClient.subscriptions.update(subscription.id, {
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
