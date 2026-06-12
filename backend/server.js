import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './src/config/db.js';
import errorHandler from './src/middlewares/errorHandler.js';
import authRouter from './src/routes/auth.js';
import measurementsRouter from './src/routes/measurements.js';
import reportsRouter from './src/routes/reports.js';
import guardiansRouter from './src/routes/guardians.js';
import notificationsRouter from './src/routes/notifications.js';
import internalRouter from './src/routes/internal.js';

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/measurements', measurementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/guardians', guardiansRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/internal', internalRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
