/**
 * SocialBudi - Environment Configuration Module
 * 
 * Loads and validates all environment variables.
 * Fails fast with clear error messages if required variables are missing.
 * 
 * Usage: const config = require('./config/env');
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env file from project root
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

// --- Define Required Variables ---
const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'JWT_SECRET',
  'JWT_EXPIRES_IN'
];

// --- Validate Required Variables ---
const missingVars = REQUIRED_VARS.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ FATAL: Missing required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nCheck your .env file at the project root.');
  process.exit(1);
}

// --- Export Configuration Object ---
const config = {
  // Server
  NODE_ENV: process.env.NODE_ENV,
  PORT: parseInt(process.env.PORT, 10),
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,

  // CORS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

module.exports = config;
