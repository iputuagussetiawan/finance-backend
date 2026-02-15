"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeClient = void 0;
const stripe_1 = __importDefault(require("stripe"));
const env_config_1 = require("./env.config");
exports.stripeClient = new stripe_1.default(env_config_1.Env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
    maxNetworkRetries: 2,
    timeout: 3000,
});
