'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.switchToSubscriptionPlanSchema =
    exports.manageSubscriptionBillingPortalSchema =
    exports.upgradeToProSubscriptionSchema =
        void 0;
const zod_1 = require('zod');
const subscription_model_1 = require('../models/subscription.model');
const callbackUrlSchema = zod_1.z.string().url();
const newPlanSchema = zod_1.z.enum([
    subscription_model_1.SubscriptionPlanEnum.MONTHLY,
    subscription_model_1.SubscriptionPlanEnum.YEARLY,
]);
exports.upgradeToProSubscriptionSchema = zod_1.z.object({
    callbackUrl: callbackUrlSchema,
    plan: newPlanSchema,
});
exports.manageSubscriptionBillingPortalSchema = zod_1.z.object({
    callbackUrl: callbackUrlSchema,
});
exports.switchToSubscriptionPlanSchema = zod_1.z.object({
    newPlan: newPlanSchema,
});
