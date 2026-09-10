

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
const usersRoutes = require('./routes/users');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://resqai_user:resqai_pass@localhost:5433/resqai';

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: '*',          
  credentials: false,
}));
app.use(express.json());

const pool = new Pool({ connectionString: DATABASE_URL });

app.locals.pool = pool;

pool.query('SELECT 1')
  .then(() => {
    console.log('✅ PostgreSQL connection OK');
    return pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(50) DEFAULT 'Citizen';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
  })
  .catch((err) => console.error('⚠️  PostgreSQL connection/init failed:', err.message));

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

initSocket(io);

app.locals.io = io;

app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin/users', usersRoutes);
app.use('/api/users', usersRoutes);

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'healthy', service: 'resqai-backend', database: 'connected' });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'resqai-backend', database: 'disconnected' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 ResQAI backend running on http://localhost:${PORT}`);
  console.log(`   Socket.IO ready for connections`);
});
