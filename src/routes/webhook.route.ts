import express, { Router, Request, Response } from 'express';
import { stripeWebhookHandler } from '../webhooks/stripe.webhook';

const webhookRoutes = Router();

// Use raw body parser ONLY for Stripe webhooks
webhookRoutes.post(
    '/stripe',
    express.raw({ type: 'application/json' }), // ✅ raw body
    async (req: Request, res: Response) => {
        await stripeWebhookHandler(req, res);
    }
);

export default webhookRoutes;
