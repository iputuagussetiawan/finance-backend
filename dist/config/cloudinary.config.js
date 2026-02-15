"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
const env_config_1 = require("./env.config");
cloudinary_1.v2.config({
    cloud_name: env_config_1.Env.CLOUDINARY_CLOUD_NAME,
    api_key: env_config_1.Env.CLOUDINARY_API_KEY,
    api_secret: env_config_1.Env.CLOUDINARY_API_SECRET,
});
const STORAGE_PARAMS = {
    folder: 'images',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    rescource_type: 'image',
    quality: 'auto:good',
};
const storage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: (req, file) => ({
        ...STORAGE_PARAMS,
    }),
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_, file, cb) => {
        const isValid = /^image\/(jpe?g|png)$/.test(file.mimetype);
        if (!isValid) {
            return;
        }
        cb(null, true);
    },
});
