import mongoose from 'mongoose';
import { config } from './index.js';

export async function connectMongo() {
  mongoose.connection.on('error', (err) => console.error('[mongo] error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('[mongo] disconnected'));

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[mongo] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export const isMongoUp = () => mongoose.connection.readyState === 1;

export const disconnectMongo = () => mongoose.disconnect();
