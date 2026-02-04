import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.middlerware';
import { HTTPSTATUS } from '../config/http.config';
import {
    generateReportService,
    getAllReportsService,
    updateReportSettingService,
} from '../services/report.service';
import { updateReportSettingSchema } from '../validators/report.validator';

export const getAllReportsController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const pagination = {
        pageSize: parseInt(req.query.pageSize as string) || 20,
        pageNumber: parseInt(req.query.pageNumber as string) || 1,
    };

    const result = await getAllReportsService(userId, pagination);

    return res.status(HTTPSTATUS.OK).json({
        message: 'Reports history fetched successfully',
        ...result,
    });
});

export const updateReportSettingController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = updateReportSettingSchema.parse(req.body);

    await updateReportSettingService(userId, body);

    return res.status(HTTPSTATUS.OK).json({
        message: 'Reports setting updated successfully',
    });
});

export const generateReportController = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const { from, to } = req.query;

    // 1. Convert to Date objects
    const fromDate = new Date(from as string);
    const toDate = new Date(to as string);

    // 2. CHECK: If dates are invalid, stop here and return an error
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({
            message:
                "Invalid date format. Please provide valid 'from' and 'to' query parameters (ISO 8601 format).",
            from,
            to,
        });
    }

    // 3. CHECK: Ensure chronological order
    if (fromDate > toDate) {
        return res.status(400).json({
            message: "The 'from' date cannot be later than the 'to' date.",
        });
    }

    const result = await generateReportService(userId, fromDate, toDate);

    // 4. Handle Case where no data is found (Service returns null)
    if (!result) {
        return res.status(404).json({
            message: 'No transactions found for the selected period',
        });
    }

    return res.status(HTTPSTATUS.OK).json({
        message: 'Report generated successfully',
        ...result,
        from,
        to,
    });
});
