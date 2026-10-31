// Used only by the explicit disposable-PostGIS integration test.
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const express = require(path.join(root, 'backend/node_modules/express'));
const { Pool } = require(path.join(root, 'backend/node_modules/pg'));
const app = express();
const pool = new Pool({connectionString: process.env.TEST_POSTGRES_URL});
app.use(express.json());
app.locals.pool = pool;
for (const route of ['requests', 'missions', 'goods', 'chat']) app.use(`/api/${route}`, require(path.join(root, `backend/routes/${route}`)));
const dashboard = require(path.join(root, 'backend/services/dashboardService'));
app.get('/test/stats', async (_req,res) => res.json(await dashboard.getDashboardStats(pool)));
const server = app.listen(0, '127.0.0.1', () => console.log(server.address().port));
process.on('SIGTERM', () => server.close(() => pool.end().then(() => process.exit())));
