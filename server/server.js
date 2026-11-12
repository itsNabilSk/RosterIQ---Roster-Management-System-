import dotenv from 'dotenv';
import app from './app.js';
import { connectDB } from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

export async function startServer() {
  await connectDB();
  return app.listen(PORT, () => {
    console.log(`[RosterIQ Server] Running on http://localhost:${PORT}`);
  });
}

// Auto-run unless under test environment
if (!process.env.VITEST) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}

export default app;
