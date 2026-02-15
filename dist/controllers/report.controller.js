'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.generateReportController =
    exports.updateReportSettingController =
    exports.getAllReportsController =
        void 0;
const asyncHandler_middlerware_1 = require('../middlewares/asyncHandler.middlerware');
const http_config_1 = require('../config/http.config');
const report_service_1 = require('../services/report.service');
const report_validator_1 = require('../validators/report.validator');
exports.getAllReportsController = (0, asyncHandler_middlerware_1.asyncHandler)(async (req, res) => {
    const userId = req.user?._id;
    const pagination = {
        pageSize: parseInt(req.query.pageSize) || 20,
        pageNumber: parseInt(req.query.pageNumber) || 1,
    };
    const result = await (0, report_service_1.getAllReportsService)(userId, pagination);
    return res.status(http_config_1.HTTPSTATUS.OK).json({
        message: 'Reports history fetched successfully',
        ...result,
    });
});
exports.updateReportSettingController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id;
        const body = report_validator_1.updateReportSettingSchema.parse(req.body);
        await (0, report_service_1.updateReportSettingService)(userId, body);
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            message: 'Reports setting updated successfully',
        });
    }
);
exports.generateReportController = (0, asyncHandler_middlerware_1.asyncHandler)(
    async (req, res) => {
        const userId = req.user?._id;
        const { from, to } = req.query;
        // 1. Convert to Date objects
        const fromDate = new Date(from);
        const toDate = new Date(to);
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
        const result = await (0, report_service_1.generateReportService)(userId, fromDate, toDate);
        // 4. Handle Case where no data is found (Service returns null)
        if (!result) {
            return res.status(404).json({
                message: 'No transactions found for the selected period',
            });
        }
        return res.status(http_config_1.HTTPSTATUS.OK).json({
            message: 'Report generated successfully',
            ...result,
            from,
            to,
        });
    }
);
