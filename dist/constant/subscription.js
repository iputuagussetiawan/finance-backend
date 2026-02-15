"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planFeatures = void 0;
const subscription_model_1 = require("../models/subscription.model");
exports.planFeatures = {
    [subscription_model_1.SubscriptionPlanEnum.MONTHLY]: [
        'Unlimited transactions',
        'Advanced analytics',
        'Email support',
        'Basic reports',
    ],
    [subscription_model_1.SubscriptionPlanEnum.YEARLY]: [
        'Everything in Monthly',
        'Priority support',
        'Advanced reports',
        'API access',
    ],
};
