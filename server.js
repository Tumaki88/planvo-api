// backend/server.js
import express from "express";
import cors from "cors";

// Import routes
import authRoutes from "./routes/auth.js";
import goalRoutes from "./routes/goals.js";
import journalRoutes from "./routes/journal.js";
import settingsRoutes from "./routes/settings.js";
import publicGoalsRoutes from "./routes/publicGoals.js";

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" })); // prevent huge payloads

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/journal", journalRoutes);
app.use("/api/settings", settingsRoutes);

// Public-facing goals (username + slug)
// Example: http://localhost:5000/adi/jee-mains
app.use("/", publicGoalsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}`)
);
