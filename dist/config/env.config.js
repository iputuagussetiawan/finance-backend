'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.Env = void 0;
const get_env_1 = require('../utils/get-env');
const envConfig = () => ({
    NODE_ENV: (0, get_env_1.getEnv)('NODE_ENV', 'development'),
    PORT: (0, get_env_1.getEnv)('PORT', '8000'),
    BASE_PATH: (0, get_env_1.getEnv)('BASE_PATH', '/api'),
    MONGO_URI: (0, get_env_1.getEnv)('MONGO_URI'),
    JWT_SECRET: (0, get_env_1.getEnv)('JWT_SECRET', 'secert_jwt'),
    JWT_EXPIRES_IN: (0, get_env_1.getEnv)('JWT_EXPIRES_IN', '15m'),
    JWT_REFRESH_SECRET: (0, get_env_1.getEnv)('JWT_REFRESH_SECRET', 'secert_jwt_refresh'),
    JWT_REFRESH_EXPIRES_IN: (0, get_env_1.getEnv)('JWT_REFRESH_EXPIRES_IN', '7d'),
    GEMINI_API_KEY: (0, get_env_1.getEnv)('GEMINI_API_KEY'),
    CLOUDINARY_CLOUD_NAME: (0, get_env_1.getEnv)('CLOUDINARY_CLOUD_NAME'),
    CLOUDINARY_API_KEY: (0, get_env_1.getEnv)('CLOUDINARY_API_KEY'),
    CLOUDINARY_API_SECRET: (0, get_env_1.getEnv)('CLOUDINARY_API_SECRET'),
    RESEND_API_KEY: (0, get_env_1.getEnv)('RESEND_API_KEY'),
    RESEND_MAILER_SENDER: (0, get_env_1.getEnv)('RESEND_MAILER_SENDER', ''),
    FRONTEND_ORIGIN: (0, get_env_1.getEnv)('FRONTEND_ORIGIN', 'localhost'),
    STRIPE_SECRET_KEY: (0, get_env_1.getEnv)('STRIPE_SECRET_KEY'),
    STRIPE_MONTHLY_PLAN_PRICE_ID: (0, get_env_1.getEnv)('STRIPE_MONTHLY_PLAN_PRICE_ID'),
    STRIPE_YEARLY_PLAN_PRICE_ID: (0, get_env_1.getEnv)('STRIPE_YEARLY_PLAN_PRICE_ID'),
    STRIPE_WEBHOOK_SECRET: (0, get_env_1.getEnv)('STRIPE_WEBHOOK_SECRET'),
    TRIAL_DAYS: (0, get_env_1.getEnv)('TRIAL_DAYS', '7'),
});
exports.Env = envConfig();
