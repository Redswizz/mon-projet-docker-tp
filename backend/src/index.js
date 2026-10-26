import express from 'express';
import cors from 'cors';
import pg from 'pg';

const port = process.env.PORT || 3001;

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not defined');
  console.error('Please create a .env file with DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (error) {
    console.error('Healthcheck failed:', error.message);
    res.status(503).json({ status: 'error', database: 'down' });
  }
});

app.get('/api/instruction', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM instructions ORDER BY id ASC LIMIT 1');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No instruction found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ error: 'Database error' });
  }
});

const server = app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});

// Arrêt propre : `docker stop` envoie SIGTERM, Ctrl+C envoie SIGINT
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => pool.end().then(() => process.exit(0)));
  });
}
