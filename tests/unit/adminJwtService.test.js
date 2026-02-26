/**
 * Unit Tests for Admin JWT Service
 *
 * Tests admin JWT token generation and verification
 * using ADMIN_JWT_SECRET (separate from user JWT_SECRET).
 */

const jwt = require('jsonwebtoken');

// Set up test environment variables before importing the service
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-for-testing-only';
process.env.ADMIN_JWT_EXPIRES_IN = '24h';

const { generateAdminToken, verifyAdminToken } = require('../../src/services/adminJwtService');

describe('adminJwtService', () => {
  const testAdminPayload = {
    admin_id: 'admin-uuid-123',
    email: 'admin@example.com',
    role: 'admin'
  };

  describe('generateAdminToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAdminToken(testAdminPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include admin_id, email, role in payload', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = jwt.decode(token);

      expect(decoded.admin_id).toBe(testAdminPayload.admin_id);
      expect(decoded.email).toBe(testAdminPayload.email);
      expect(decoded.role).toBe(testAdminPayload.role);
    });

    it('should not include user_id in payload', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = jwt.decode(token);

      expect(decoded.user_id).toBeUndefined();
    });

    it('should include iat (issued at) claim', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = jwt.decode(token);

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
    });

    it('should include exp (expiration) claim', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should generate different tokens for different admins', () => {
      const token1 = generateAdminToken({ admin_id: 'admin1', email: 'admin1@test.com', role: 'admin' });
      const token2 = generateAdminToken({ admin_id: 'admin2', email: 'admin2@test.com', role: 'superadmin' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyAdminToken', () => {
    it('should verify a valid token', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = verifyAdminToken(token);

      expect(decoded.admin_id).toBe(testAdminPayload.admin_id);
      expect(decoded.email).toBe(testAdminPayload.email);
      expect(decoded.role).toBe(testAdminPayload.role);
    });

    it('should include iat and exp in decoded payload', () => {
      const token = generateAdminToken(testAdminPayload);
      const decoded = verifyAdminToken(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw on invalid token', () => {
      expect(() => verifyAdminToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw on expired token', () => {
      // Create an already expired token
      const expiredToken = jwt.sign(testAdminPayload, process.env.ADMIN_JWT_SECRET, { expiresIn: '-1s' });

      expect(() => verifyAdminToken(expiredToken)).toThrow('Token expired');
    });

    it('should throw on tampered token', () => {
      // Create a token with wrong secret
      const tamperedToken = jwt.sign(testAdminPayload, 'wrong-secret', { expiresIn: '1h' });

      expect(() => verifyAdminToken(tamperedToken)).toThrow('Invalid token');
    });

    it('should throw error for empty token', () => {
      expect(() => verifyAdminToken('')).toThrow();
    });

    it('should throw error for null token', () => {
      expect(() => verifyAdminToken(null)).toThrow();
    });
  });

  describe('token isolation', () => {
    it('should not verify tokens signed with user JWT_SECRET', () => {
      // Simulate a user token signed with a different secret
      const userSecret = 'different-user-jwt-secret';
      const userToken = jwt.sign({ user_id: 'user-123', email: 'user@test.com' }, userSecret, { expiresIn: '1h' });

      expect(() => verifyAdminToken(userToken)).toThrow('Invalid token');
    });

    it('should use ADMIN_JWT_SECRET, not JWT_SECRET', () => {
      // Ensure the admin service uses ADMIN_JWT_SECRET
      const token = generateAdminToken(testAdminPayload);

      // Verify with ADMIN_JWT_SECRET should work
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
      expect(decoded.admin_id).toBe(testAdminPayload.admin_id);

      // Verify with a different secret should fail
      expect(() => jwt.verify(token, 'some-other-secret')).toThrow();
    });
  });
});
