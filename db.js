import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_MAX_CONNECTIONS) || 10,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: Number(process.env.DB_CONN_TIMEOUT) || 5000,
  ssl: {
    rejectUnauthorized: false // Neon doesn’t require CA verification for serverless
  },
});

// Optional: test connection
(async () => {
  try {
    const client = await pool.connect();
    const res = await client.query("SELECT NOW()");
    console.log("✅ Neon DB connected at:", res.rows[0]);
    client.release();
  } catch (err) {
    console.error("❌ DB connection error:", err);
  }
})();

export default pool;
