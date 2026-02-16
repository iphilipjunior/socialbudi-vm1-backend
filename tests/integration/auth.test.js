/**
 * Integration Tests for Authentication Endpoints
 *
 * Tests complete user flows:
 * 1. Signup → Payment Webhook → Activate → Login (with token)
 * 2. Token verification and refresh
 * 3. Error cases and validation
 *
 * NOTE: These tests require a real Supabase connection.
 * Set up environment variables before running.
 */

// Set up test environment variables before importing app
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '1h';
process.env.N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'test-webhook-secret';

const crypto = require('crypto');
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

/**
 * Helper function to simulate payment webhook from n8n
 * Creates proper HMAC signature and sends webhook payload
 *
 * @param {string} email - User's email address
 * @param {string} paymentId - Payment ID from payment provider
 * @param {Object} options - Optional overrides for payload
 * @returns {Promise} Supertest response promise
 */
const simulatePaymentWebhook = (email, paymentId, options = {}) => {
  const payload = {
    payment_id: paymentId,
    email: email,
    amount: options.amount || 10.00,
    currency: options.currency || 'USD',
    status: options.status || 'completed',
    timestamp: options.timestamp || new Date().toISOString()
  };

  // Generate HMAC signature
  const secret = process.env.N8N_WEBHOOK_SECRET;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return request(app)
    .post('/api/payment/confirm')
    .set('X-Webhook-Signature', signature)
    .send(payload);
};

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

  describe('POST /api/payment/confirm (Payment Webhook)', () => {
    it('should process valid payment webhook', async () => {
      const res = await simulatePaymentWebhook(testUser.email, testPaymentId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('confirmed');
    });

    it('should reject webhook with invalid signature', async () => {
      const payload = {
        payment_id: `PS_INVALID${Date.now()}`,
        email: testUser.email,
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      const res = await request(app)
        .post('/api/payment/confirm')
        .set('X-Webhook-Signature', 'invalid-signature')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject webhook for non-existent user', async () => {
      const res = await simulatePaymentWebhook(
        'nonexistent@example.com',
        `PS_NOUSER${Date.now()}`
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should reject duplicate payment ID', async () => {
      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a new user
      const newUser = {
        name: 'Duplicate Payment User',
        email: `duplicate-${Date.now()}@example.com`,
        password: 'TestPassword123!'
      };

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(newUser);

      expect(signupRes.status).toBe(201);

      // Try to use the same payment ID that was already used by testUser
      const res = await simulatePaymentWebhook(newUser.email, testPaymentId);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already exists');
    });

    it('should reject invalid amount', async () => {
      const res = await simulatePaymentWebhook(
        testUser.email,
        `PS_WRONGAMT${Date.now()}`,
        { amount: 5.00 }
      );

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing webhook signature', async () => {
      const payload = {
        payment_id: `PS_NOSIG${Date.now()}`,
        email: testUser.email,
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: new Date().toISOString()
      };

      const res = await request(app)
        .post('/api/payment/confirm')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login (after payment, before activation)', () => {
    it('should return activate redirect for paid but unactivated user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.redirect).toBe('/activate');
      expect(res.body.token).toBeUndefined();
    });
  });

  describe('POST /api/auth/activate', () => {
    it('should reject activation with mismatched Payment ID', async () => {
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: testUser.email,
          payment_id: 'WRONG_PAYMENT_ID'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      // Accept either error message format
      expect(['Payment ID does not match', 'Invalid Payment ID']).toContain(res.body.error);
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

    it('should activate user with matching Payment ID', async () => {
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
          payment_id: testPaymentId
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('already activated');
    });

    it('should reject activation without payment webhook', async () => {
      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Create a new user who has NOT received payment webhook
      const noPaidUser = {
        name: 'No Payment User',
        email: `nopayment-${Date.now()}@example.com`,
        password: 'TestPassword123!'
      };

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send(noPaidUser);

      expect(signupRes.status).toBe(201);

      // Try to activate without payment webhook
      const res = await request(app)
        .post('/api/auth/activate')
        .send({
          email: noPaidUser.email,
          payment_id: `PS_FAKE${Date.now()}`
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No payment found for this user');
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
      // Wait 1 second to ensure new token has different iat (issued at time)
      await new Promise(resolve => setTimeout(resolve, 1000));

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
    it('should complete full signup → payment webhook → activate → login flow', async () => {
      // Wait 3 seconds to avoid rate limiting from previous tests
      await new Promise(resolve => setTimeout(resolve, 3000));

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

      // Step 2: Login before payment (should get waiting-payment)
      const loginPendingRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: flowUser.email,
          password: flowUser.password
        });

      expect(loginPendingRes.status).toBe(200);
      expect(loginPendingRes.body.redirect).toBe('/waiting-payment');

      // Step 3: Simulate payment webhook from n8n
      const webhookRes = await simulatePaymentWebhook(flowUser.email, flowPaymentId);

      expect(webhookRes.status).toBe(200);
      expect(webhookRes.body.success).toBe(true);

      // Step 4: Login after payment (should get activate redirect)
      const loginPaidRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: flowUser.email,
          password: flowUser.password
        });

      expect(loginPaidRes.status).toBe(200);
      expect(loginPaidRes.body.redirect).toBe('/activate');

      // Step 5: Activate with matching Payment ID
      const activateRes = await request(app)
        .post('/api/auth/activate')
        .send({
          email: flowUser.email,
          payment_id: flowPaymentId
        });

      expect(activateRes.status).toBe(200);
      expect(activateRes.body.token).toBeDefined();
      expect(activateRes.body.api_keys).toBeDefined();

      // Step 6: Login after activation (should get dashboard + token)
      const loginAfterRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: flowUser.email,
          password: flowUser.password
        });

      expect(loginAfterRes.status).toBe(200);
      expect(loginAfterRes.body.redirect).toBe('/dashboard');
      expect(loginAfterRes.body.token).toBeDefined();

      // Step 7: Verify the token
      const verifyRes = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', `Bearer ${loginAfterRes.body.token}`);

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
    });
  });
});
