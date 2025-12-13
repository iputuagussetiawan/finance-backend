import { ErrorRequestHandler } from 'express';
import { HTTPSTATUS } from '../config/http.config';

export const errorHandler: ErrorRequestHandler = (error, req, res, next): any => {
    console.log('Error occurred on PATH:', req.path, 'Error:', error);

    return res.status(HTTPSTATUS.INTERNAL_SERVER_ERROR).json({
        message: 'Internal Server Error',
        error: error?.message || 'Unknow error occurred',
    });
};
