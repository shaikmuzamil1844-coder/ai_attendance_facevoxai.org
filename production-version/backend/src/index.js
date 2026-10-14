// src/index.js — FaceVoxAI Production Backend
// Express + Socket.IO server entrypoint
require('dotenv').config();

const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server: SocketIOServer } = require('socket.io');

const { pool }             = require('./config/db');
const { requireAuth }      = require('./middleware/auth');
const { errorHandler }     = require('./middleware/errorHandler');

const authRoutes       = require('./routes/auth');
const orgRoutes        = require('./routes/org');
const peopleRoutes     = require('./routes/people');
const attendanceRoutes = require('./routes/attendance');
const analyticsRoutes  = require('./routes/analytics');

// ─────────────────────────────────────────────────────────────────────────────
const app    = express();
app.set('trust proxy', 1);
const server = http.createServer(app);

// ─── Flexible CORS Origin Resolver ──────────────────────────────────────────
const configuredOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173,http://localhost')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow same-origin, curl, server-to-server
  if (configuredOrigins.includes('*') || configuredOrigins.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true;
  } catch {}
  return false;
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Attach io to app so routes can emit events
app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Faculty joins a session room to receive real-time attendance updates
  socket.on('join:session', (sessionId) => {
    socket.join(`session:${sessionId}`);
    console.log(`[Socket.IO] ${socket.id} joined room: session:${sessionId}`);
  });

  socket.on('leave:session', (sessionId) => {
    socket.leave(`session:${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));   // Large limit for base64 image/audio payloads
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  max:      parseInt(process.env.RATE_LIMIT_MAX        || '200',   10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Too many requests. Please slow down.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max:      20,                // max 20 login attempts per window
  message:  { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});

app.use('/api', generalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    dbStatus = 'error';
  }
  res.json({
    status:    'ok',
    service:   'FaceVoxAI Attendance API',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    database:  dbStatus,
    environment: process.env.NODE_ENV,
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api',           orgRoutes);
app.use('/api',           peopleRoutes);
app.use('/api',           attendanceRoutes);
app.use('/api',           analyticsRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ─── Global Error Handler (must be LAST) ─────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   🎓 FaceVoxAI Production API  — v1.0.0                  ║
║   HTTP  : http://localhost:${PORT}                          ║
║   Health: http://localhost:${PORT}/api/health               ║
║   Mode  : ${(process.env.NODE_ENV || 'development').padEnd(12)}                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

module.exports = { app, io };
