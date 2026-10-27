require("dotenv").config();

const http = require("http");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { Server: SocketIOServer } = require("socket.io");

const { initSocket } = require("./socket");
const { requireAuth } = require("./middleware/auth");
const authRoutes = require("./routes/auth");
const alertsRoutes = require("./routes/alerts");
const requestsRoutes = require("./routes/requests");
const usersRoutes = require("./routes/users");
const { generateDashboardReport, getDashboardStats } = require("./services/dashboardService");

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = "0.0.0.0";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is not configured");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");

app.use(
  cors({
    origin: "*",
    credentials: false,
  }),
);

app.use(express.json({ limit: "1mb" }));

const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

app.locals.pool = pool;

pool.on("error", (err) => {
  console.error("⚠️ PostgreSQL idle connection error:", err.message);
});

// Initialize existing database columns
async function initializeDatabase() {
  try {
    await pool.query("SELECT 1");
    console.log("✅ PostgreSQL connection OK");

    // Preserve existing schema initialization.
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS user_type
      VARCHAR(50) DEFAULT 'Citizen';
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS is_active
      BOOLEAN DEFAULT TRUE;
    `);

    console.log("✅ Database initialization completed");
  } catch (err) {
    console.error("⚠️ PostgreSQL connection/init failed:", err.message);
  }
}

const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

initSocket(io);

app.locals.io = io;

app.use("/api/auth", authRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/requests", requestsRoutes);
app.use("/api/admin/users", usersRoutes);
app.use("/api/users", usersRoutes);

app.get("/api/admin/dashboard/stats", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator access required" });
  }

  try {
    return res.json(await getDashboardStats(pool));
  } catch (err) {
    console.error("GET /api/admin/dashboard/stats error:", err.message);
    return res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.get("/api/admin/dashboard/report", requireAuth, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator access required" });
  }

  try {
    return res.json(await generateDashboardReport(pool));
  } catch (err) {
    console.error("GET /api/admin/dashboard/report error:", err.message);
    return res.status(500).json({ error: "Failed to generate dashboard report" });
  }
});

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "online",
    service: "ResQAI Backend",
    version: "1.0.0",
    message: "ResQAI backend is running successfully",
    health: "/health",
  });
});

// Explicit HEAD support for health probes
app.head("/", (_req, res) => {
  res.sendStatus(200);
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    return res.status(200).json({
      status: "healthy",
      service: "resqai-backend",
      database: "connected",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Health check database error:", err.message);

    return res.status(503).json({
      status: "degraded",
      service: "resqai-backend",
      database: "disconnected",
    });
  }
});

app.use((_req, res) => {
  res.status(404).json({
    error: "Route not found",
  });
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 ResQAI backend running on ${HOST}:${PORT}`);
  console.log("✅ Socket.IO ready for connections");

  initializeDatabase();
});

server.on("error", (err) => {
  console.error("❌ HTTP server error:", err.message);
  process.exit(1);
});

async function shutdown(signal) {
  console.log(`🛑 Received ${signal}. Shutting down...`);

  server.close(async () => {
    try {
      await pool.end();
      console.log("✅ PostgreSQL pool closed");
    } catch (err) {
      console.error("Database shutdown error:", err.message);
    }

    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
