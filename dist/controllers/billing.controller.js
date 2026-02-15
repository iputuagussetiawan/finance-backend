'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.switchToSubscriptionPlanController =
    exports.manageSubscriptionBillingPortalController =
    exports.upgradeToProSubscriptionController =
    exports.getUserSubscriptionStatusController =
        void 0;
const http_config_1 = require('../config/http.config');
const asyncHandler_middlerware_1 = require('../middlewares/asyncHandler.middlerware');
const billing_service_1 = require('../services/billing.service');
const billing_validator_1 = require('../validators/billing.validator');
const app_error_1 = require('../utils/app-error');
exports.getUserSubscriptionStatusController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id;
        const { subscriptionData } = await (0, billing_service_1.getUserSubscriptionStatusService)(
            userId
        );
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            message: 'Subscription fetched successfully',
            data: subscriptionData,
        });
    }
);
exports.upgradeToProSubscriptionController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id;
        const body = billing_validator_1.upgradeToProSubscriptionSchema.parse(req.body);
        const { url } = await (0, billing_service_1.upgradeToProSubscriptionService)(userId, body);
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            message: 'Payment Url Generated successfully',
            url,
        });
    }
);
exports.manageSubscriptionBillingPortalController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id.toString();
        if (!userId) {
            throw new app_error_1.UnauthorizedException('User not authenticated');
        }
        const body = billing_validator_1.manageSubscriptionBillingPortalSchema.parse(req.body);
        const url = await (0, billing_service_1.manageSubscriptionBillingPortalService)(
            userId,
            body.callbackUrl
        );
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            message: 'Payment URL generated successfully',
            url,
        });
    }
);
exports.switchToSubscriptionPlanController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id;
        const body = billing_validator_1.switchToSubscriptionPlanSchema.parse(req.body);
        await (0, billing_service_1.swithToSubscriptionPlanService)(userId, body);
        return res.status(http_config_1.HTTPSTATUS.OK).json({});
    }
);
