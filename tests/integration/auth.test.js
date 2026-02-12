/**
 * Integration Tests for Authentication Endpoints
 *
 * Tests complete user flows:
 * 1. Signup → Login (pending payment) → Activate → Login (with token)
 * 2. Token verification and refresh
 * 3. Error cases and validation
 *
 * NOTE: These tests require a real Supabase connection.
 * Set up environment variables before running.
 */

// Set up test environment variables before importing app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '1h';

const request = require('supertest');
const app = require('../../src/server');

// Test data - unique email per test run to avoid conflicts
const testUser = {
  name: 'Integration Test User',
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!'
};

let testUserId;
let testToken;
const testPaymentId = `PS_TEST${Date.now()}`;

describe('Authentication Integration Tests', () => {
  describe('POST /api/auth/signup', () => {
    it('should create a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.next_action).toBe('open_payment_modal');
      expect(res.body.user_id).toBeDefined();

      testUserId = res.body.user_id;
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Email');
    });

    it('should reject weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: `weak-${Date.now()}@example.com`,
          password: 'weak'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject short name', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          name: 'A',
          email: `short-${Date.now()}@example.com`,
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should return waiting-payment redirect for pending user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirect).toBe('/waiting-payment');
      expect(res.body.token).toBeUndefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-valid',
          password: 'TestPassword123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/activate', () => {
    it('should reject invalid Payment ID format', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: testUser.email,
          payment_id: 'INVALID'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: 'nonexistent@example.com',
          payment_id: 'PS_TEST123'
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should activate user with valid Payment ID', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: testUser.email,
          payment_id: testPaymentId
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.api_keys).toBeDefined();
      expect(Object.keys(res.body.api_keys)).toHaveLength(5);
      expect(res.body.api_keys.linkedin).toBeDefined();
      expect(res.body.api_keys.ytdlp).toBeDefined();
      expect(res.body.api_keys.instagram).toBeDefined();
      expect(res.body.api_keys.enrichment).toBeDefined();
      expect(res.body.api_keys.all).toBeDefined();

      testToken = res.body.token;
    });

    it('should reject already activated account', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: testUser.email,
          payment_id: `PS_ANOTHER${Date.now()}`
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already activated');
    });

    it('should reject duplicate Payment ID', async () => {
      // First, create a new user
      const newUser = {
        name: 'Another User',
        email: `another-${Date.now()}@example.com`,
        password: 'TestPassword123!'
      };

      await request(app)
        .post('/api/auth/signup')
        .send(newUser);

      // Try to activate with the same payment ID
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: newUser.email,
          payment_id: testPaymentId
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already used');
    });
  });

  describe('POST /api/auth/login (after activation)', () => {
    it('should return dashboard redirect and token for activated user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirect).toBe('/dashboard');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.user.role).toBe('user');

      // Update testToken with fresh token
      testToken = res.body.token;
    });
  });

  describe('GET /api/auth/verify-token', () => {
    it('should verify valid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.valid).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(testUser.email.toLowerCase());
      expect(res.body.expires_in_seconds).toBeGreaterThan(0);
    });

    it('should reject missing token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No token provided');
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Basic some-credentials');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    it('should refresh valid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ token: testToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBeDefined();
      expect(res.body.token).not.toBe(testToken);
      expect(res.body.user).toBeDefined();
    });

    it('should reject missing token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Token required');
    });

    it('should reject invalid/malformed token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ token: 'completely-invalid-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Complete User Flow', () => {
    it('should complete full signup → login → activate → login flow', async () => {
      const flowUser = {
        name: 'Flow Test User',
        email: `flow-${Date.now()}@example.com`,
        password: 'FlowPassword123!'
      };
      const flowPaymentId = `PS_FLOW${Date.now()}`;

      // Step 1: Signup
      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(flowUser);

      expect(signupRes.status).toBe(201);
      expect(signupRes.body.success).toBe(true);

      // Step 2: Login before activation (should get waiting-payment)
      const loginBeforeRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: flowUser.email,
          password: flowUser.password
        });

      expect(loginBeforeRes.status).toBe(200);
      expect(loginBeforeRes.body.redirect).toBe('/waiting-payment');

      // Step 3: Activate
      const activateRes = await request(app)
        .post('/api/auth/activate')
        .send({
          email: flowUser.email,
          payment_id: flowPaymentId
        });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.token).toBeDefined();
      expect(activateRes.body.api_keys).toBeDefined();

      // Step 4: Login after activation (should get dashboard + token)
      const loginAfterRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: flowUser.email,
          password: flowUser.password
        });

      expect(loginAfterRes.status).toBe(200);
      expect(loginAfterRes.body.redirect).toBe('/dashboard');
      expect(loginAfterRes.body.token).toBeDefined();

      // Step 5: Verify the token
      const verifyRes = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', `Bearer ${loginAfterRes.body.token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });
  });
});
