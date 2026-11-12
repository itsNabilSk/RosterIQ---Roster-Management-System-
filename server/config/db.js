import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

let connectionPromise = null;

export async function connectDB(uri) {
  const mongoUri =
    uri || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rosteriq';

  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in progress, reuse the existing promise
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    })
    .then((conn) => {
      console.log(
        `[MongoDB] Connected: ${conn.connection.host}/${conn.connection.name}`
      );
      connectionPromise = null;
      return conn;
    })
    .catch((err) => {
      connectionPromise = null;
      console.error('[MongoDB] Connection error:', err.message);
      throw err;
    });

  return connectionPromise;
}
