"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const env_config_1 = require("./config/env.config");
const cors_1 = __importDefault(require("cors"));
const http_config_1 = require("./config/http.config");
const app = (0, express_1.default)();
const BASE_PATH = env_config_1.Env.BASE_PATH;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cors_1.default)({
    origin: env_config_1.Env.FRONTEND_ORIGIN,
    credentials: true,
}));
app.get('/', (req, res, next) => {
    res.status(http_config_1.HTTPSTATUS.OK).json({ message: 'API is running' });
});
app.listen(env_config_1.Env.PORT, () => {
    console.log(`Server is running on port ${env_config_1.Env.PORT}`);
});
