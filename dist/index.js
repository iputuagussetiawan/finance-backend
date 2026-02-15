"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
require("./config/passport.config");
const express_1 = __importDefault(require("express"));
const env_config_1 = require("./config/env.config");
const cors_1 = __importDefault(require("cors"));
const errorHandler_middleware_1 = require("./middlewares/errorHandler.middleware");
const asyncHandler_middlerware_1 = require("./middlewares/asyncHandler.middlerware");
const database_config_1 = __importDefault(require("./config/database.config"));
const passport_1 = __importDefault(require("passport"));
const passport_config_1 = require("./config/passport.config");
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const user_route_1 = __importDefault(require("./routes/user.route"));
const transaction_route_1 = __importDefault(require("./routes/transaction.route"));
const scheduler_1 = require("./cron/scheduler");
const cron_1 = require("./cron");
const report_route_1 = __importDefault(require("./routes/report.route"));
const analytics_route_1 = __importDefault(require("./routes/analytics.route"));
const billing_route_1 = __importDefault(require("./routes/billing.route"));
const webhook_route_1 = __importDefault(require("./routes/webhook.route"));
const app = (0, express_1.default)();
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
const BASE_PATH = env_config_1.Env.BASE_PATH;
app.use('/webhook', webhook_route_1.default);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use(passport_1.default.initialize());
app.use((0, cors_1.default)({
    origin: env_config_1.Env.FRONTEND_ORIGIN,
    credentials: true,
}));
app.get('/', (0, asyncHandler_middlerware_1.asyncHandler)(async (req, res, next) => {
    res.status(200).json({
        success: true,
        message: 'Welcome to the Finance AI Service API',
        version: '1.0.0',
        status: 'Server is up and running',
    });
}));
(0, scheduler_1.startJobs)();
app.use(`${BASE_PATH}/auth`, auth_route_1.default);
app.use(`${BASE_PATH}/user`, passport_config_1.passportAuthenticateJwt, user_route_1.default);
app.use(`${BASE_PATH}/transaction`, passport_config_1.passportAuthenticateJwt, transaction_route_1.default);
app.use(`${BASE_PATH}/report`, passport_config_1.passportAuthenticateJwt, report_route_1.default);
app.use(`${BASE_PATH}/analytics`, passport_config_1.passportAuthenticateJwt, analytics_route_1.default);
app.use(`${BASE_PATH}/billing`, passport_config_1.passportAuthenticateJwt, billing_route_1.default);
app.use(errorHandler_middleware_1.errorHandler);
app.listen(env_config_1.Env.PORT, async () => {
    await (0, database_config_1.default)();
    if (env_config_1.Env.NODE_ENV === 'development') {
        await (0, cron_1.initializeCrons)();
    }
    console.log(`Server is running on port ${env_config_1.Env.PORT}`);
});
