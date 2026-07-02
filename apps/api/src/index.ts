import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import memorialRoutes from './routes/memorials';
import photoRoutes from './routes/photos';
import locationRoutes from './routes/locations';
import publicRoutes from './routes/public';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import { UPLOADS_DIR } from './lib/uploads';
import { printServerUrls } from './lib/network';
import { env } from './lib/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = env.PORT;
const HOST = env.HOST;

function buildCorsOrigin():
  | boolean
  | string[]
  | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const corsEnv = env.CORS_ORIGIN;
  
  // In development with *, allow all origins for local network demo
  if (corsEnv === '*' && env.NODE_ENV === 'development') {
    return (_origin, callback) => callback(null, true);
  }

  // In production, never allow *
  if (corsEnv === '*' && env.NODE_ENV === 'production') {
    console.warn('⚠️  CORS_ORIGIN=* is not allowed in production. Using default origins.');
  }

  const defaults = [
    env.ADMIN_URL || 'http://localhost:5173',
    env.MEMORIAL_URL || 'http://localhost:5174',
  ];

  // Parse comma-separated origins
  const extra = corsEnv && corsEnv !== '*'
    ? corsEnv.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return [...new Set([...defaults, ...extra])];
}

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: buildCorsOrigin(),
  credentials: true,
}));

// Structured logging
if (env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buffer) => {
    (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
  },
}));
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'memorialconnect-api', version: 'v1' });
});

// API v1 routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/memorials', memorialRoutes);
app.use('/api/v1/memorials/:id/locations', locationRoutes);
app.use('/api/v1/memorials/:id/photos', photoRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);

// Legacy routes for backward compatibility (will be deprecated)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/memorials', memorialRoutes);
app.use('/api/memorials/:id/locations', locationRoutes);
app.use('/api/memorials/:id/photos', photoRoutes);
app.use('/api/m', publicRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Memory Connect API v1`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Host: ${HOST}`);
  console.log(`   Port: ${PORT}`);
  printServerUrls('API (Backend)', PORT);
});
