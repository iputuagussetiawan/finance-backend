import 'dotenv/config';
import './config/passport.config';
import express, { NextFunction, Request, Response } from 'express';
import { Env } from './config/env.config';
import cors from 'cors';
import { HTTPSTATUS } from './config/http.config';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { BadRequestException } from './utils/app-error';
import { asyncHandler } from './middlewares/asyncHandler.middlerware';
import connectDatabase from './config/database.config';
import passport from 'passport';
import { passportAuthenticateJwt } from './config/passport.config';
import authRoutes from './routes/auth.route';
import userRoutes from './routes/user.route';
import transactionRoutes from './routes/transaction.route';
import { startJobs } from './cron/scheduler';
import { initializeCrons } from './cron';
import reportRoutes from './routes/report.route';
import { calculateNextReportDate } from './utils/helper';
import analyticsRoutes from './routes/analytics.route';
import billingRoutes from './routes/billing.route';
import webhookRoutes from './routes/webhook.route';

const app = express();
// app.use(
//     cors({
//         origin: [
//             'http://localhost:5173', // Vite default
//             'http://localhost:3000', // Create React App default
//             'https://aifinance-five.vercel.app', // Your production URL
//         ],
//         methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//         credentials: true, // Required if you are sending cookies/JWT in headers
//     })
// );
const BASE_PATH = Env.BASE_PATH;
app.use('/webhook', webhookRoutes);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use(
    cors({
        origin: Env.FRONTEND_ORIGIN,
        credentials: true,
    })
);

app.get(
    '/',
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        res.status(200).json({
            success: true,
            message: 'Welcome to the Finance AI Service API',
            version: '1.0.0',
            status: 'Server is up and running',
        });
    })
);
startJobs();
app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, passportAuthenticateJwt, userRoutes);
app.use(`${BASE_PATH}/transaction`, passportAuthenticateJwt, transactionRoutes);
app.use(`${BASE_PATH}/report`, passportAuthenticateJwt, reportRoutes);
app.use(`${BASE_PATH}/analytics`, passportAuthenticateJwt, analyticsRoutes);
app.use(`${BASE_PATH}/billing`, passportAuthenticateJwt, billingRoutes);
app.use(errorHandler);

app.listen(Env.PORT, async () => {
    await connectDatabase();
    if (Env.NODE_ENV === 'development') {
        await initializeCrons();
    }
    console.log(`Server is running on port ${Env.PORT}`);
});
