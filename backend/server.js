/**
 * ResQAI — Node.js Backend Server
 * Express + Socket.IO + PostgreSQL
 *
 * Run: node server.js  (or npm run dev for --watch mode)
 */

require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { Server: SocketIOServer } = require('socket.io');

const { initSocket } = require('./socket');
const authRoutes = require('./routes/auth');
const alertsRoutes = require('./routes/alerts');
const requestsRoutes = require('./routes/requests');

// ── Config ──────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://resqai_user:resqai_pass@localhost:5433/resqai';

// ── Express ─────────────────────────────────────────────────

const app = express();
const server = http.createServer(app);

// ── Middleware ───────────────────────────────────────────────

app.use(cors({
  origin: '*',          // Allow mobile app from any origin
  credentials: false,
}));
app.use(express.json());

// ── PostgreSQL Pool ─────────────────────────────────────────

const pool = new Pool({ connectionString: DATABASE_URL });

// Make pool available to routes via app.locals
app.locals.pool = pool;

// Verify DB connection on startup
pool.query('SELECT 1')
  .then(() => console.log('✅ PostgreSQL connection OK'))
  .catch((err) => console.error('⚠️  PostgreSQL connection failed:', err.message));

// ── Socket.IO ───────────────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

initSocket(io);

// Make io available to routes (for broadcasting)
app.locals.io = io;

// ── Routes ──────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/requests', requestsRoutes);

// ── Health check ────────────────────────────────────────────

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'resqai-backend', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'resqai-backend', database: 'disconnected' });
  }
});

// ── Start ───────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`🚀 ResQAI backend running on http://localhost:${PORT}`);
  console.log(`   Socket.IO ready for connections`);
});
