'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.SubscriptionPriceEnum = exports.SubscriptionPlanEnum = exports.SubscriptionStatus = void 0;
const mongoose_1 = __importDefault(require('mongoose'));
const mongoose_2 = require('mongoose');
const env_config_1 = require('../config/env.config');
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus['ACTIVE'] = 'active';
    SubscriptionStatus['CHECKOUT_INITIATED'] = 'checkout_initiated';
    SubscriptionStatus['TRIALING'] = 'trialing';
    SubscriptionStatus['PAST_DUE'] = 'past_due';
    SubscriptionStatus['CANCELED'] = 'canceled';
    SubscriptionStatus['TRIAL_EXPIRED'] = 'trial_expired';
    SubscriptionStatus['PAYMENT_FAILED'] = 'payment_failed';
})(SubscriptionStatus || (exports.SubscriptionStatus = SubscriptionStatus = {}));
var SubscriptionPlanEnum;
(function (SubscriptionPlanEnum) {
    SubscriptionPlanEnum['MONTHLY'] = 'MONTHLY';
    SubscriptionPlanEnum['YEARLY'] = 'YEARLY';
})(SubscriptionPlanEnum || (exports.SubscriptionPlanEnum = SubscriptionPlanEnum = {}));
// price in cents
var SubscriptionPriceEnum;
(function (SubscriptionPriceEnum) {
    SubscriptionPriceEnum[(SubscriptionPriceEnum['MONTHLY'] = 999)] = 'MONTHLY';
    SubscriptionPriceEnum[(SubscriptionPriceEnum['YEARLY'] = 9999)] = 'YEARLY';
})(SubscriptionPriceEnum || (exports.SubscriptionPriceEnum = SubscriptionPriceEnum = {}));
const subscriptionSchema = new mongoose_2.Schema(
    {
        userId: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        stripeSubscriptionId: { type: String, default: null },
        stripePriceId: { type: String, default: null },
        stripeCurrentPeriodStart: { type: Date, default: null },
        stripeCurrentPeriodEnd: { type: Date, default: null },
        trialStartsAt: {
            type: Date,
            required: true,
            default: () => new Date(),
        },
        trialEndsAt: { type: Date, required: true },
        trialDays: { type: Number, default: Number(env_config_1.Env.TRIAL_DAYS) },
        plan: {
            type: String,
            enum: Object.values(SubscriptionPlanEnum),
        },
        status: {
            type: String,
            enum: Object.values(SubscriptionStatus),
        },
        upgradedAt: { type: Date, default: null },
        canceledAt: { type: Date, default: null },
        metadata: {
            type: mongoose_2.Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);
subscriptionSchema.methods.isTrialActive = function () {
    if (!this.trialEndsAt || this.status !== SubscriptionStatus.TRIALING) return false;
    return new Date() < this.trialEndsAt;
};
const SubscriptionModel = mongoose_1.default.model('Subscription', subscriptionSchema);
exports.default = SubscriptionModel;
