'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');

// ─── Route imports ────────────────────────────────────────────────────────────
const repoRouter      = require('./routes/repo.routes');
const branchRouter    = require('./routes/branch.routes');
const buildRoutes     = require('./routes/build.routes');
const checkoutRoutes  = require('./routes/checkout.routes');
const authRouter      = require('./routes/auth.routes');
const activityRouter  = require('./routes/activity.routes');
const prRouter        = require('./routes/pullRequest.routes');
const environmentRouter = require('./routes/environment.routes');
const treeRouter        = require('./routes/tree.routes');

// ─── Middleware imports ───────────────────────────────────────────────────────
const { notFoundHandler } = require('./middleware/error.middleware');
const errorMiddleware     = require('./middleware/error.middleware');

// ─── App initialisation ───────────────────────────────────────────────────────
const app = express();

// CORS — allow requests from the Vite dev server
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Parse incoming JSON bodies (must come before routes)
app.use(express.json({ limit: '50mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── API Routes ───────────────────────────────────────────────────────────────
// Authentication
app.use('/api/auth', authRouter);

// Core object-store routes: blobs, trees, commits, object lookup
app.use('/api/repos', repoRouter);

// Branch management
app.use('/api/repos', branchRouter);

// Build pipeline
app.use('/api/repos', buildRoutes);

// Checkout & Locking
app.use('/api/repos', checkoutRoutes);

// Push/Pull Activity logs
app.use('/api/repos', activityRouter);

// Pull Requests
app.use('/api/repos', prRouter);

// Environments Config
app.use('/api/repos', environmentRouter);

// File Tree & Blob viewer
app.use('/api/repos', treeRouter);

// ─── 404 & Error Handling (must be last) ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorMiddleware);

// ─── Startup Recovery ────────────────────────────────────────────────────────
const { recoverAllStuckBuilds } = require('./services/buildStore.service');
try {
  const recoveredCount = recoverAllStuckBuilds();
  if (recoveredCount > 0) {
    console.log(`[VRel] Recovered ${recoveredCount} stuck builds.`);
  }
} catch (err) {
  console.error('[VRel] Stuck builds recovery error:', err);
}

// ─── Server start (only when run directly, not when required by tests) ────────
const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[VRel] Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app; // export for testing
