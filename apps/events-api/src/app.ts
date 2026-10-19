import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import photoRoutes from './routes/photos';
import publicRoutes from './routes/public';
import platformRoutes from './routes/platform';
import { env } from './lib/env';
import { eventsUploadsDir } from './lib/uploads';

export const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.EVENTS_CORS_ORIGIN.split(',').map((s) => s.trim()), credentials: true }));
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(eventsUploadsDir()));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'events-api', version: 'v1' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/events', photoRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/platform', platformRoutes);

app.use((_req, res) => res.status(404).json({ success: false, error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});
