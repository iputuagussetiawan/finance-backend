import axios from 'axios';
import TransactionModel, { TransactionTypeEnum } from '../models/transaction.model';
import { BadRequestException, NotFoundException } from '../utils/app-error';
import { calculateNextOccurrence } from '../utils/helper';
import { CreateTransactionType, UpdateTransactionType } from '../validators/transaction.validator';
// import { genAI, genAIModel } from '../config/google-ai.config';
// import { createPartFromBase64, createUserContent } from '@google/genai';
// import { receiptPrompt } from '../utils/prompt';

export const createTransactionService = async (body: CreateTransactionType, userId: string) => {
    let nextRecurringDate: Date | undefined;
    const currentDate = new Date();

    if (body.isRecurring && body.recurringInterval) {
        const calculatedDate = calculateNextOccurrence(body.date, body.recurringInterval);

        nextRecurringDate =
            calculatedDate < currentDate
                ? calculateNextOccurrence(currentDate, body.recurringInterval)
                : calculatedDate;
    }

    const transaction = await TransactionModel.create({
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

export const getAllTransactionService = async (
    // ID of the user whose transactions will be fetched
    userId: string,

    // Filter options object
    filters: {
        keyword?: string; // Search keyword for title or category
        type?: keyof typeof TransactionTypeEnum; // Transaction type (enum key)
        recurringStatus?: 'RECURRING' | 'NON_RECURRING'; // Recurring filter
    },

    // Pagination configuration
    pagination: {
        pageSize: number; // Number of items per page
        pageNumber: number; // Current page number
    }
) => {
    // Destructure filter values for easier usage
    const { keyword, type, recurringStatus } = filters;

    // Base filter condition, always scoped to the user
    const filterConditions: Record<string, any> = {
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
        TransactionModel.find(filterConditions) // Apply filters
            .skip(skip) // Skip records for pagination
            .limit(pageSize) // Limit number of records
            .sort({ createdAt: -1 }), // Sort by newest first

        TransactionModel.countDocuments(filterConditions), // Count total results
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

export const getTransactionByIdService = async (userId: string, transactionId: string) => {
    const transaction = await TransactionModel.findOne({
        _id: transactionId,
        userId,
    });
    if (!transaction) throw new NotFoundException('Transaction not found');

    return transaction;
};

export const duplicateTransactionService = async (userId: string, transactionId: string) => {
    const transaction = await TransactionModel.findOne({
        _id: transactionId,
        userId,
    });
    if (!transaction) throw new NotFoundException('Transaction not found');

    const duplicated = await TransactionModel.create({
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

export const updateTransactionService = async (
    userId: string,
    transactionId: string,
    body: UpdateTransactionType
) => {
    const existingTransaction = await TransactionModel.findOne({
        _id: transactionId,
        userId,
    });
    if (!existingTransaction) throw new NotFoundException('Transaction not found');

    const now = new Date();
    const isRecurring = body.isRecurring ?? existingTransaction.isRecurring;

    const date = body.date !== undefined ? new Date(body.date) : existingTransaction.date;

    const recurringInterval = body.recurringInterval || existingTransaction.recurringInterval;

    let nextRecurringDate: Date | undefined;

    if (isRecurring && recurringInterval) {
        const calculatedDate = calculateNextOccurrence(date, recurringInterval);

        nextRecurringDate =
            calculatedDate < now ? calculateNextOccurrence(now, recurringInterval) : calculatedDate;
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

export const deleteTransactionService = async (userId: string, transactionId: string) => {
    const deleted = await TransactionModel.findByIdAndDelete({
        _id: transactionId,
        userId,
    });
    if (!deleted) throw new NotFoundException('Transaction not found');

    return;
};

export const bulkDeleteTransactionService = async (userId: string, transactionIds: string[]) => {
    const result = await TransactionModel.deleteMany({
        _id: { $in: transactionIds },
        userId,
    });

    if (result.deletedCount === 0) throw new NotFoundException('No transactions found');

    return {
        success: true,
        deletedCount: result.deletedCount,
    };
};

export const bulkTransactionService = async (
    userId: string,
    transactions: CreateTransactionType[]
) => {
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

        const result = await TransactionModel.bulkWrite(bulkOps, {
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

// export const scanReceiptService = async (file: Express.Multer.File | undefined) => {
//     if (!file) throw new BadRequestException('No file uploaded');

//     try {
//         if (!file.path) throw new BadRequestException('failed to upload file');

//         console.log(file.path);

//         const responseData = await axios.get(file.path, {
//             responseType: 'arraybuffer',
//         });
//         const base64String = Buffer.from(responseData.data).toString('base64');

//         if (!base64String) throw new BadRequestException('Could not process file');

//         const result = await genAI.models.generateContent({
//             model: genAIModel,
//             contents: [
//                 createUserContent([
//                     receiptPrompt,
//                     createPartFromBase64(base64String, file.mimetype),
//                 ]),
//             ],
//             config: {
//                 temperature: 0,
//                 topP: 1,
//                 responseMimeType: 'application/json',
//             },
//         });

//         const response = result.text;
//         const cleanedText = response?.replace(/```(?:json)?\n?/g, '').trim();

//         if (!cleanedText)
//             return {
//                 error: 'Could not read reciept  content',
//             };

//         const data = JSON.parse(cleanedText);

//         if (!data.amount || !data.date) {
//             return { error: 'Reciept missing required information' };
//         }

//         return {
//             title: data.title || 'Receipt',
//             amount: data.amount,
//             date: data.date,
//             description: data.description,
//             category: data.category,
//             paymentMethod: data.paymentMethod,
//             type: data.type,
//             receiptUrl: file.path,
//         };
//     } catch (error) {
//         return { error: 'Receipt scanning  service unavailable' };
//     }
// };
