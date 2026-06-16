import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { spawn } from 'child_process';
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

// MCP 서버 시작 (AI 서버가 MongoDB 데이터에 접근하기 위한 MCP HTTP 서버)
const MCP_PORT = process.env.MCP_PORT || 3001;

const mcpServer = spawn('npx', [
  'mongodb-mcp-server',
  '--transport', 'http',
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    MDB_MCP_CONNECTION_STRING: process.env.MONGO_URI,
    MDB_MCP_HTTP_PORT: String(MCP_PORT),
  },
});

mcpServer.on('spawn', () => {
  console.log(`MCP server running on port ${MCP_PORT}`);
});

mcpServer.on('error', (err) => {
  console.error('MCP server failed to start:', err.message);
});

process.on('exit', () => mcpServer.kill());

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/measurements', measurementsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/guardians', guardiansRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/internal', internalRouter);

app.use(errorHandler);

const PORT = process.env.BACKEND_PORT || 3000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.on('error', (err) => console.error(`[ERROR] app.listen failed:`, err.message));
