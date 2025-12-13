import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { Env } from './config/env.config';
import cors from 'cors';
import { HTTPSTATUS } from './config/http.config';
import { error } from 'console';
import { errorHandler } from './middlewares/errorHandler.middleware';
import { BadRequestException } from './utils/app-error';
import { asyncHandler } from './middlewares/asyncHandler.middlerware';

const app = express();
const BASE_PATH = Env.BASE_PATH;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    cors({
        origin: Env.FRONTEND_ORIGIN,
        credentials: true,
    })
);

app.get(
    '/',
    asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
        throw new BadRequestException('This is a bad request example');
        res.status(HTTPSTATUS.OK).json({ message: 'API is running' });
    })
);

app.use(errorHandler);

app.listen(Env.PORT, () => {
    console.log(`Server is running on port ${Env.PORT}`);
});
