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
import familyRoutes from './routes/family';
import platformRoutes from './routes/platform';
import commandCenterRoutes from './routes/commandCenter';
import feedbackRoutes from './routes/feedback';
import marketingRoutes from './routes/marketing';
import publicMarketingRoutes from './routes/public-marketing';
import vehicleRoutes from './routes/vehicles';
import assetRoutes from './routes/assets';
import funeralResourceRoutes from './routes/funeral-resources';
import featureRoutes from './routes/features';
import entitlementRoutes from './routes/entitlement';
import { prisma } from './lib/prisma';
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
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX ?? (env.NODE_ENV === 'production' ? 10 : 100),
  message: { success: false, message: 'Too many attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
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

// Dynamic sitemap for SEO
app.get('/sitemap.xml', async (_req, res) => {
  try {
    const published = await prisma.memorial.findMany({
      where: { status: 'PUBLISHED', deletedAt: null, isDemo: false },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: 'desc' },
    });

    const staticPages = [
      { loc: 'https://memoryconnect.co.za/', priority: '1.0', changefreq: 'weekly' },
      { loc: 'https://memoryconnect.co.za/demo', priority: '0.8', changefreq: 'monthly' },
    ];

    const baseUrl = 'https://memoryconnect.co.za';
    const urls = [
      ...staticPages.map((p) => `  <url>\n    <loc>${p.loc}</loc>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>`),
      ...published.map((m: { slug: string; updatedAt: Date | null; publishedAt: Date | null }) => `  <url>\n    <loc>${baseUrl}/${m.slug}</loc>\n    <lastmod>${(m.updatedAt || m.publishedAt || new Date()).toISOString().split('T')[0]}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>`),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch {
    // Fallback to static sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://memoryconnect.co.za/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://memoryconnect.co.za/demo</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  }
});

// API v1 routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/memorials', memorialRoutes);
app.use('/api/v1/memorials/:id/locations', locationRoutes);
app.use('/api/v1/memorials/:id/photos', photoRoutes);
app.use('/api/v1/public', publicRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/family', familyRoutes);
app.use('/api/v1/platform', platformRoutes);
app.use('/api/v1/platform', commandCenterRoutes);
app.use('/api/v1/entitlement', entitlementRoutes);
app.use('/api/v1', feedbackRoutes);

// Marketing Hub routes
app.use('/api/v1/marketing', marketingRoutes);

// Public Marketing routes
app.use('/api/v1/public', publicMarketingRoutes);

// Operations routes
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/assets', assetRoutes);
app.use('/api/v1/funeral-resources', funeralResourceRoutes);

// Feature management routes (platform owner)
app.use('/api/v1/platform/features', featureRoutes);

// Legacy routes for backward compatibility (will be deprecated)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/memorials', memorialRoutes);
app.use('/api/memorials/:id/locations', locationRoutes);
app.use('/api/memorials/:id/photos', photoRoutes);
app.use('/api/m', publicRoutes);
app.use('/api/family', familyRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Memory Connect API v1`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  console.log(`   Host: ${HOST}`);
  console.log(`   Port: ${PORT}`);
  printServerUrls('API (Backend)', PORT);
});
