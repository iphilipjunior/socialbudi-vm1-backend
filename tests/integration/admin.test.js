/**
 * Integration Tests for Phase 5 Admin Authentication API
 *
 * Tests complete request/response flows for POST /api/admin/login including:
 * - Routes → Rate Limiter → Validator → Controller → Service → Response
 *
 * Uses mocked Supabase and bcryptjs for isolation.
 * Uses real admin JWT tokens, validation, and rate limiting.
 * Each test uses a unique IP (via X-Forwarded-For) to avoid rate limiting between tests.
 */

// Set up environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3002';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.ADMIN_JWT_SECRET = 'test-admin-jwt-secret-for-integration-tests';
process.env.ADMIN_JWT_EXPIRES_IN = '24h';
process.env.JWT_EXPIRES_IN = '1h';
process.env.N8N_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.CORS_ORIGIN = 'http://localhost:3000';

// Mock external dependencies BEFORE importing app
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn(),
  compareSync: jest.fn(),
  genSalt: jest.fn(),
  genSaltSync: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const request = require('supertest');
const app = require('../../src/server');
const supabase = require('../../src/config/supabase');
const bcrypt = require('bcryptjs');
const { verifyAdminToken } = require('../../src/services/adminJwtService');

// ============================================================================
// Test Data
// ============================================================================

const TEST_ADMIN_ID = 'admin-uuid-123';
const TEST_ADMIN_EMAIL = 'admin@socialbudi.com';
const TEST_ADMIN_PASSWORD = 'SecureAdminPass123!';
const TEST_PASSWORD_HASH = '$2b$10$mockedHashValueForAdmin';

const mockAdmin = {
  admin_id: TEST_ADMIN_ID,
  email: TEST_ADMIN_EMAIL,
  password_hash: TEST_PASSWORD_HASH,
  name: 'Admin User',
  role: 'admin',
  is_active: true,
  last_login: null,
  created_at: '2026-02-01T00:00:00Z'
};

const mockInactiveAdmin = {
  ...mockAdmin,
  admin_id: 'inactive-admin-uuid',
  email: 'inactive@socialbudi.com',
  is_active: false
};

// Counter for unique IPs to avoid rate limiting between tests
let testIpCounter = 1;
const getUniqueIp = () => `192.168.1.${testIpCounter++}`;

// ============================================================================
// Test Suites
// ============================================================================

describe('Admin Authentication API - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SUITE: POST /api/admin/login
  // ============================================================================
  describe('POST /api/admin/login', () => {
    // ---- Validation Tests ----
    it('should return 400 if email missing', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeDefined();
    });

    it('should return 400 if password missing', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeDefined();
    });

    it('should return 400 if email invalid format', async () => {
      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: 'invalid-email', password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toBeDefined();
    });

    // ---- Authentication Tests ----
    it('should return 401 if admin not found', async () => {
      // Mock Supabase to return no admin
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: 'nonexistent@socialbudi.com', password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should return 403 if admin account is inactive', async () => {
      // Mock Supabase to return inactive admin
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockInactiveAdmin, error: null })
          })
        })
      });

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: 'inactive@socialbudi.com', password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Account is inactive');
    });

    it('should return 401 if password incorrect', async () => {
      // Mock Supabase to return admin
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          ilike: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
          })
        })
      });

      // Mock bcrypt to return false (password mismatch)
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should return 200 with token and admin object on success', async () => {
      // Mock Supabase to return admin
      const selectMock = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
        })
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'admin_users') {
          return {
            select: selectMock,
            update: updateMock
          };
        }
        if (table === 'system_logs') {
          return {
            insert: insertMock
          };
        }
        return { select: selectMock, update: updateMock, insert: insertMock };
      });

      // Mock bcrypt to return true (password match)
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.admin).toBeDefined();
      expect(res.body.admin.admin_id).toBe(TEST_ADMIN_ID);
      expect(res.body.admin.name).toBe('Admin User');
      expect(res.body.admin.email).toBe(TEST_ADMIN_EMAIL);
      expect(res.body.admin.role).toBe('admin');
    });

    it('should not include password_hash in response', async () => {
      // Mock Supabase
      const selectMock = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
        })
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'admin_users') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'system_logs') {
          return { insert: insertMock };
        }
        return { select: selectMock, update: updateMock, insert: insertMock };
      });

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.admin.password_hash).toBeUndefined();
      expect(res.body.admin.password).toBeUndefined();
    });

    it('token in response should be verifiable by verifyAdminToken', async () => {
      // Mock Supabase
      const selectMock = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
        })
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'admin_users') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'system_logs') {
          return { insert: insertMock };
        }
        return { select: selectMock, update: updateMock, insert: insertMock };
      });

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();

      // Verify the token using the adminJwtService
      const decoded = verifyAdminToken(res.body.token);
      expect(decoded.admin_id).toBe(TEST_ADMIN_ID);
      expect(decoded.email).toBe(TEST_ADMIN_EMAIL);
      expect(decoded.role).toBe('admin');
      expect(decoded.user_id).toBeUndefined(); // Admin tokens should NOT have user_id
    });

    it('should update last_login timestamp on successful login', async () => {
      // Mock Supabase
      const selectMock = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
        })
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'admin_users') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'system_logs') {
          return { insert: insertMock };
        }
        return { select: selectMock, update: updateMock, insert: insertMock };
      });

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(200);

      // Verify update was called for admin_users
      expect(updateMock).toHaveBeenCalled();
    });

    it('should log admin login to system_logs', async () => {
      // Mock Supabase
      const selectMock = jest.fn().mockReturnValue({
        ilike: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: mockAdmin, error: null })
        })
      });

      const updateMock = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null })
      });

      const insertMock = jest.fn().mockResolvedValue({ error: null });

      supabase.from.mockImplementation((table) => {
        if (table === 'admin_users') {
          return { select: selectMock, update: updateMock };
        }
        if (table === 'system_logs') {
          return { insert: insertMock };
        }
        return { select: selectMock, update: updateMock, insert: insertMock };
      });

      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post('/api/admin/login')
        .set('X-Forwarded-For', getUniqueIp())
        .send({ email: TEST_ADMIN_EMAIL, password: TEST_ADMIN_PASSWORD });

      expect(res.status).toBe(200);

      // Verify insert was called for system_logs
      expect(insertMock).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // SUITE: Protected Admin Routes (verify adminAuth middleware)
  // ============================================================================
  describe('Protected Admin Routes', () => {
    it('should return 401 for admin routes without token', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('X-Forwarded-For', getUniqueIp());

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Authentication required');
    });

    it('should return 403 for admin routes with user token', async () => {
      // Create a user token (contains user_id, not admin_id)
      const jwt = require('jsonwebtoken');
      const userToken = jwt.sign(
        { user_id: 'user-123', email: 'user@test.com', role: 'user' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Forwarded-For', getUniqueIp());

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 for admin routes with invalid admin token', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .set('X-Forwarded-For', getUniqueIp());

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid or expired admin token');
    });
  });
});
