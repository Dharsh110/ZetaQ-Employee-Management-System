import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import connectDB from './config/database';
import routes from './routes/index';
import { startCalendarReminderJob } from './jobs/calendarReminders';

const app = express();
const PORT = process.env.PORT || 5000;

connectDB();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200, message: 'Too many requests, please try again later.' });
app.use('/api', limiter);

app.use('/api/v1', routes);

app.get('/api/v1/health', (_req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbStatus = dbState[mongoose.connection.readyState] || 'unknown';
  res.status(200).json({
    success: true,
    message: 'ZetaQ EMS API is running',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    dbConnected: mongoose.connection.readyState === 1,
  });
});

app.use('*', (_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`🚀 ZetaQ EMS Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV}`);
  startCalendarReminderJob();
});

export default app;
