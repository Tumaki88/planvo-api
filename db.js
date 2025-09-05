import mysql from "mysql2/promise";

// Create a pool using environment variables
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "yourpassword",
  database: process.env.DB_NAME || "planvo",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
