import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import { Env } from './config/env.config';
import cors from 'cors';
import { HTTPSTATUS } from './config/http.config';

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

app.get('/', (req: Request, res: Response, next: NextFunction) => {
    res.status(HTTPSTATUS.OK).json({ message: 'API is running' });
});

app.listen(Env.PORT, () => {
    console.log(`Server is running on port ${Env.PORT}`);
});
