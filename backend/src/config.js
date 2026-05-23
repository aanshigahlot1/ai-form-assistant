// backend/src/config.js
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  PORT: process.env.PORT || 3001,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-form-assistant',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  CORS_ORIGINS: (process.env.CORS_ORIGINS || 'chrome-extension://,http://localhost:5173').split(','),
  CHROMA_URL: process.env.CHROMA_URL || 'http://localhost:8000',
  NODE_ENV: process.env.NODE_ENV || 'development'
};
