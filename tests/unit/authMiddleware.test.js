const jwt = require('jsonwebtoken');

// Set up test environment variables before importing modules
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.JWT_EXPIRES_IN = '1h';

const authMiddleware = require('../../src/middleware/authMiddleware');
const { generateToken } = require('../../src/services/jwtService');

describe('authMiddleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  const testUser = {
    user_id: 'test-user-123',
    email: 'test@example.com',
    role: 'user'
  };

  beforeEach(() => {
    // Reset mocks before each test
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      path: '/test'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  describe('with valid token', () => {
    it('should call next() for valid token', async () => {
      const token = generateToken(testUser);
      mockReq.headers.authorization = `Bearer ${token}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should attach user to req.user', async () => {
      const token = generateToken(testUser);
      mockReq.headers.authorization = `Bearer ${token}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user.user_id).toBe(testUser.user_id);
      expect(mockReq.user.email).toBe(testUser.email);
      expect(mockReq.user.role).toBe(testUser.role);
    });

    it('should include iat and exp in req.user', async () => {
      const token = generateToken(testUser);
      mockReq.headers.authorization = `Bearer ${token}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockReq.user.iat).toBeDefined();
      expect(mockReq.user.exp).toBeDefined();
    });
  });

  describe('with missing token', () => {
    it('should return 401 when Authorization header is missing', async () => {
      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is empty string', async () => {
      mockReq.headers.authorization = '';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });
  });

  describe('with malformed Authorization header', () => {
    it('should return 401 when header does not start with Bearer', async () => {
      mockReq.headers.authorization = 'Basic some-token';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });

    it('should return 401 when Bearer is missing space', async () => {
      mockReq.headers.authorization = 'Bearertoken';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });

    it('should return 401 when only Bearer is provided without token', async () => {
      mockReq.headers.authorization = 'Bearer ';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'No token provided'
      });
    });
  });

  describe('with invalid token', () => {
    it('should return 401 for completely invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token-string';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for token signed with wrong secret', async () => {
      const wrongToken = jwt.sign(testUser, 'wrong-secret', { expiresIn: '1h' });
      mockReq.headers.authorization = `Bearer ${wrongToken}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
    });

    it('should return 401 for tampered token', async () => {
      const token = generateToken(testUser);
      const tamperedToken = token.slice(0, -5) + 'xxxxx'; // Tamper with signature
      mockReq.headers.authorization = `Bearer ${tamperedToken}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid token'
      });
    });
  });

  describe('with expired token', () => {
    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(testUser, process.env.JWT_SECRET, { expiresIn: '-1s' });
      mockReq.headers.authorization = `Bearer ${expiredToken}`;

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('error response format', () => {
    it('should always return success: false on error', async () => {
      mockReq.headers.authorization = 'Bearer invalid';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('should always return error message on error', async () => {
      mockReq.headers.authorization = 'Bearer invalid';

      await authMiddleware(mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(String) })
      );
    });
  });
});
