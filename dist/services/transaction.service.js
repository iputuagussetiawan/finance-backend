'use strict';
var __importDefault =
    (this && this.__importDefault) ||
    function (mod) {
        return mod && mod.__esModule ? mod : { default: mod };
    };
Object.defineProperty(exports, '__esModule', { value: true });
exports.scanReceiptService =
    exports.bulkTransactionService =
    exports.bulkDeleteTransactionService =
    exports.deleteTransactionService =
    exports.updateTransactionService =
    exports.duplicateTransactionService =
    exports.getTransactionByIdService =
    exports.getAllTransactionService =
    exports.createTransactionService =
        void 0;
const axios_1 = __importDefault(require('axios'));
const transaction_model_1 = __importDefault(require('../models/transaction.model'));
const app_error_1 = require('../utils/app-error');
const helper_1 = require('../utils/helper');
const google_ai_config_1 = require('../config/google-ai.config');
const genai_1 = require('@google/genai');
const prompt_1 = require('../utils/prompt');
const createTransactionService = async (body, userId) => {
    let nextRecurringDate;
    const currentDate = new Date();
    if (body.isRecurring && body.recurringInterval) {
        const calculatedDate = (0, helper_1.calculateNextOccurrence)(
            body.date,
            body.recurringInterval
        );
        nextRecurringDate =
            calculatedDate < currentDate
                ? (0, helper_1.calculateNextOccurrence)(currentDate, body.recurringInterval)
                : calculatedDate;
    }
    const transaction = await transaction_model_1.default.create({
        ...body,
        userId,
        category: body.category,
        amount: Number(body.amount),
        isRecurring: body.isRecurring || false,
        recurringInterval: body.recurringInterval || null,
        nextRecurringDate,
        lastProcessed: null,
    });
    return transaction;
};
exports.createTransactionService = createTransactionService;
const getAllTransactionService = async (
    // ID of the user whose transactions will be fetched
    userId,
    // Filter options object
    filters,
    // Pagination configuration
    pagination
) => {
    // Destructure filter values for easier usage
    const { keyword, type, recurringStatus } = filters;
    // Base filter condition, always scoped to the user
    const filterConditions = {
        userId,
    };
    // If keyword exists, add OR condition for title or category search (case-insensitive)
    if (keyword) {
        filterConditions.$or = [
            { title: { $regex: keyword, $options: 'i' } }, // Match title
            { category: { $regex: keyword, $options: 'i' } }, // Match category
        ];
    }
    // If transaction type filter is provided, apply it
    if (type) {
        filterConditions.type = type;
    }
    // If recurring status filter is provided
    if (recurringStatus) {
        // Show only recurring transactions
        if (recurringStatus === 'RECURRING') {
            filterConditions.isRecurring = true;
        }
        // Show only non-recurring transactions
        else if (recurringStatus === 'NON_RECURRING') {
            filterConditions.isRecurring = false;
        }
    }
    // Extract pagination values
    const { pageSize, pageNumber } = pagination;
    // Calculate how many records to skip for pagination
    const skip = (pageNumber - 1) * pageSize;
    // Run both queries in parallel:
    // 1. Get paginated transactions
    // 2. Count total matching documents
    const [transactions, totalCount] = await Promise.all([
        transaction_model_1.default
            .find(filterConditions) // Apply filters
            .skip(skip) // Skip records for pagination
            .limit(pageSize) // Limit number of records
            .sort({ createdAt: -1 }), // Sort by newest first
        transaction_model_1.default.countDocuments(filterConditions), // Count total results
    ]);
    // Calculate total number of pages
    const totalPages = Math.ceil(totalCount / pageSize);
    // Return transactions and pagination metadata
    return {
        transactions,
        pagination: {
            pageSize,
            pageNumber,
            totalCount,
            totalPages,
            skip,
        },
    };
};
exports.getAllTransactionService = getAllTransactionService;
const getTransactionByIdService = async (userId, transactionId) => {
    const transaction = await transaction_model_1.default.findOne({
        _id: transactionId,
        userId,
    });
    if (!transaction) throw new app_error_1.NotFoundException('Transaction not found');
    return transaction;
};
exports.getTransactionByIdService = getTransactionByIdService;
const duplicateTransactionService = async (userId, transactionId) => {
    const transaction = await transaction_model_1.default.findOne({
        _id: transactionId,
        userId,
    });
    if (!transaction) throw new app_error_1.NotFoundException('Transaction not found');
    const duplicated = await transaction_model_1.default.create({
        ...transaction.toObject(),
        _id: undefined,
        title: `Duplicate - ${transaction.title}`,
        description: transaction.description
            ? `${transaction.description} (Duplicate)`
            : 'Duplicated transaction',
        isRecurring: false,
        recurringInterval: undefined,
        nextRecurringDate: undefined,
        createdAt: undefined,
        updatedAt: undefined,
    });
    return duplicated;
};
exports.duplicateTransactionService = duplicateTransactionService;
const updateTransactionService = async (userId, transactionId, body) => {
    const existingTransaction = await transaction_model_1.default.findOne({
        _id: transactionId,
        userId,
    });
    if (!existingTransaction) throw new app_error_1.NotFoundException('Transaction not found');
    const now = new Date();
    const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;
    const date = body.date !== undefined ? new Date(body.date) : existingTransaction.date;
    const recurringInterval = body.recurringInterval || existingTransaction.recurringInterval;
    let nextRecurringDate;
    if (isRecurring && recurringInterval) {
        const calculatedDate = (0, helper_1.calculateNextOccurrence)(date, recurringInterval);
        nextRecurringDate =
            calculatedDate < now
                ? (0, helper_1.calculateNextOccurrence)(now, recurringInterval)
                : calculatedDate;
    }
    existingTransaction.set({
        ...(body.title && { title: body.title }),
        ...(body.description && { description: body.description }),
        ...(body.category && { category: body.category }),
        ...(body.type && { type: body.type }),
        ...(body.paymentMethod && { paymentMethod: body.paymentMethod }),
        ...(body.amount !== undefined && { amount: Number(body.amount) }),
        date,
        isRecurring,
        recurringInterval,
        nextRecurringDate,
    });
    await existingTransaction.save();
    return;
};
exports.updateTransactionService = updateTransactionService;
const deleteTransactionService = async (userId, transactionId) => {
    const deleted = await transaction_model_1.default.findByIdAndDelete({
        _id: transactionId,
        userId,
    });
    if (!deleted) throw new app_error_1.NotFoundException('Transaction not found');
    return;
};
exports.deleteTransactionService = deleteTransactionService;
const bulkDeleteTransactionService = async (userId, transactionIds) => {
    const result = await transaction_model_1.default.deleteMany({
        _id: { $in: transactionIds },
        userId,
    });
    if (result.deletedCount === 0) throw new app_error_1.NotFoundException('No transactions found');
    return {
        success: true,
        deletedCount: result.deletedCount,
    };
};
exports.bulkDeleteTransactionService = bulkDeleteTransactionService;
const bulkTransactionService = async (userId, transactions) => {
    try {
        const bulkOps = transactions.map(tx => ({
            insertOne: {
                document: {
                    ...tx,
                    userId,
                    isRecurring: false,
                    nextRecurringDate: null,
                    recurringInterval: null,
                    lastProcesses: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        }));
        const result = await transaction_model_1.default.bulkWrite(bulkOps, {
            ordered: true,
        });
        return {
            insertedCount: result.insertedCount,
            success: true,
        };
    } catch (error) {
        throw error;
    }
};
exports.bulkTransactionService = bulkTransactionService;
const scanReceiptService = async file => {
    if (!file) throw new app_error_1.BadRequestException('No file uploaded');
    try {
        if (!file.path) throw new app_error_1.BadRequestException('failed to upload file');
        console.log(file.path);
        const responseData = await axios_1.default.get(file.path, {
            responseType: 'arraybuffer',
        });
        const base64String = Buffer.from(responseData.data).toString('base64');
        if (!base64String) throw new app_error_1.BadRequestException('Could not process file');
        const result = await google_ai_config_1.genAI.models.generateContent({
            model: google_ai_config_1.genAIModel,
            contents: [
                (0, genai_1.createUserContent)([
                    prompt_1.receiptPrompt,
                    (0, genai_1.createPartFromBase64)(base64String, file.mimetype),
                ]),
            ],
            config: {
                temperature: 0,
                topP: 1,
                responseMimeType: 'application/json',
            },
        });
        const response = result.text;
        const cleanedText = response?.replace(/```(?:json)?\n?/g, '').trim();
        if (!cleanedText)
            return {
                error: 'Could not read reciept  content',
            };
        const data = JSON.parse(cleanedText);
        if (!data.amount || !data.date) {
            return { error: 'Reciept missing required information' };
        }
        return {
            title: data.title || 'Receipt',
            amount: data.amount,
            date: data.date,
            description: data.description,
            category: data.category,
            paymentMethod: data.paymentMethod,
            type: data.type,
            receiptUrl: file.path,
        };
    } catch (error) {
        return { error: 'Receipt scanning  service unavailable' };
    }
};
exports.scanReceiptService = scanReceiptService;
