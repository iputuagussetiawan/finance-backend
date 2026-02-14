import { Request, Response } from 'express';
import { HTTPSTATUS } from '../config/http.config';
import { asyncHandler } from '../middlewares/asyncHandler.middlerware';
import {
    getUserSubscriptionStatusService,
    manageSubscriptionBillingPortalService,
    swithToSubscriptionPlanService,
    upgradeToProSubscriptionService,
} from '../services/billing.service';
import {
    manageSubscriptionBillingPortalSchema,
    switchToSubscriptionPlanSchema,
    upgradeToProSubscriptionSchema,
} from '../validators/billing.validator';
import { UnauthorizedException } from '../utils/app-error';

export const getUserSubscriptionStatusController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const { subscriptionData } = await getUserSubscriptionStatusService(userId);
        return res.status(HTTPSTATUS.OK).json({
            message: 'Subscription fetched successfully',
            data: subscriptionData,
        });
    }
);

export const upgradeToProSubscriptionController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const body = upgradeToProSubscriptionSchema.parse(req.body);
        const { url } = await upgradeToProSubscriptionService(userId, body);
        return res.status(HTTPSTATUS.OK).json({
            message: 'Payment Url Generated successfully',
            url,
        });
    }
);

export const manageSubscriptionBillingPortalController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id.toString();
        if (!userId) {
            throw new UnauthorizedException('User not authenticated');
        }
        const body = manageSubscriptionBillingPortalSchema.parse(req.body);
        const url = await manageSubscriptionBillingPortalService(userId, body.callbackUrl);
        return res.status(HTTPSTATUS.OK).json({
            message: 'Payment URL generated successfully',
            url,
        });
    }
);

export const switchToSubscriptionPlanController = asyncHandler(
    async (req: Request, res: Response) => {
        const userId = req.user?._id;
        const body = switchToSubscriptionPlanSchema.parse(req.body);
        await swithToSubscriptionPlanService(userId, body);
        return res.status(HTTPSTATUS.OK).json({});
    }
);
