const jwt = require('jsonwebtoken');

// Set up test environment variables before importing the service
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';

const { generateToken, verifyToken, decodeToken } = require('../../src/services/jwtService');

describe('jwtService', () => {
  const testPayload = {
    user_id: 'test-user-123',
    email: 'test@example.com',
    role: 'user'
  };

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateToken(testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include correct payload in generated token', () => {
      const token = generateToken(testPayload);
      const decoded = jwt.decode(token);

      expect(decoded.user_id).toBe(testPayload.user_id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should include iat (issued at) claim', () => {
      const token = generateToken(testPayload);
      const decoded = jwt.decode(token);

      expect(decoded.iat).toBeDefined();
      expect(typeof decoded.iat).toBe('number');
    });

    it('should include exp (expiration) claim', () => {
      const token = generateToken(testPayload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it('should generate different tokens for different payloads', () => {
      const token1 = generateToken({ user_id: 'user1', email: 'user1@test.com', role: 'user' });
      const token2 = generateToken({ user_id: 'user2', email: 'user2@test.com', role: 'user' });

      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('should decode a valid token and return payload', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.user_id).toBe(testPayload.user_id);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.role).toBe(testPayload.role);
    });

    it('should include iat and exp in decoded payload', () => {
      const token = generateToken(testPayload);
      const decoded = verifyToken(token);

      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should throw "Invalid token" error for malformed token', () => {
      expect(() => verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw "Invalid token" error for token with wrong signature', () => {
      const token = jwt.sign(testPayload, 'wrong-secret', { expiresIn: '1h' });

      expect(() => verifyToken(token)).toThrow('Invalid token');
    });

    it('should throw "Token expired" error for expired token', () => {
      // Create an already expired token
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '-1s' });

      expect(() => verifyToken(expiredToken)).toThrow('Token expired');
    });

    it('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });

    it('should throw error for null token', () => {
      expect(() => verifyToken(null)).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = generateToken(testPayload);
      const decoded = decodeToken(token);

      expect(decoded.user_id).toBe(testPayload.user_id);
      expect(decoded.email).toBe(testPayload.email);
    });

    it('should decode expired token without throwing', () => {
      const expiredToken = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '-1s' });
      const decoded = decodeToken(expiredToken);

      expect(decoded).not.toBeNull();
      expect(decoded.user_id).toBe(testPayload.user_id);
    });

    it('should return null for invalid token format', () => {
      const decoded = decodeToken('completely-invalid');

      expect(decoded).toBeNull();
    });
  });
});
