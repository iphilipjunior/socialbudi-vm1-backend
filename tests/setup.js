/**
 * Jest Test Setup
 *
 * Sets up environment variables before any tests run.
 * This file is executed before each test file.
 */

// Set required environment variables for testing
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret-for-testing';
process.env.ADMIN_JWT_EXPIRES_IN = '24h';
process.env.N8N_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.CORS_ORIGIN = 'http://localhost:3000';
