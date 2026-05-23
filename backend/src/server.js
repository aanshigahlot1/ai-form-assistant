// backend/src/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import { config } from './config.js';
import { rateLimit } from './middleware/auth.middleware.js';
import profileRoutes from './routes/profile.routes.js';
import memoryRoutes from './routes/memory.routes.js';
import matchRoutes from './routes/match.routes.js';
import syncRoutes from './routes/sync.routes.js';
import resumeRoutes from './routes/resume.routes.js';

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, cb) => {
    // Allow chrome extensions, localhost dev, and configured origins
    const allowed = !origin || origin.startsWith('chrome-extension://') ||
      origin.startsWith('http://localhost') || config.CORS_ORIGINS.includes(origin);
    cb(null, allowed);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(config.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(rateLimit(120)); // 120 req/min

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => {
  res.json({
    status: 'ok', version: '1.0.0',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    env: config.NODE_ENV, uptime: Math.round(process.uptime())
  });
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/profile', profileRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/resume', resumeRoutes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await mongoose.connect(config.MONGODB_URI);
    console.log('✅ MongoDB connected:', config.MONGODB_URI);
    app.listen(config.PORT, () => {
      console.log(`🚀 Backend running on http://localhost:${config.PORT}`);
      console.log(`   Health: http://localhost:${config.PORT}/health`);
    });
  } catch (err) {
    console.error('❌ Startup failed:', err.message);
    process.exit(1);
  }
}
start();
