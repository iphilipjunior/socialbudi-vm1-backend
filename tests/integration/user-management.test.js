/**
 * Integration Tests for Phase 4 User Management API
 *
 * Tests complete request/response flows including:
 * - Routes → Rate Limiter → Auth → Validator → Controller → Service → Response
 *
 * Uses mocked Supabase and bcryptjs for isolation.
 * Uses real JWT tokens, validation, and rate limiting.
 */

// Set up environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret-for-integration-tests';
process.env.JWT_EXPIRES_IN = '1h';
process.env.N8N_WEBHOOK_SECRET = 'test-webhook-secret';

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
const jwt = require('jsonwebtoken');
const app = require('../../src/server');
const supabase = require('../../src/config/supabase');
const bcrypt = require('bcryptjs');

// ============================================================================
// Test Helpers
// ============================================================================

const TEST_USER_ID = 'test-user-uuid-123';
const TEST_EMAIL = 'test@example.com';

/**
 * Generate a valid JWT token for testing
 * Uses the real JWT_SECRET so auth middleware accepts it
 */
const generateTestToken = (overrides = {}) => {
  const payload = {
    id: TEST_USER_ID,
    user_id: TEST_USER_ID,
    email: TEST_EMAIL,
    role: 'user',
    ...overrides
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
};

/**
 * Generate an expired JWT token for testing
 */
const generateExpiredToken = () => {
  const payload = {
    id: TEST_USER_ID,
    user_id: TEST_USER_ID,
    email: TEST_EMAIL,
    role: 'user'
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1s' });
};

/**
 * Mock user data matching database schema
 */
const mockUser = {
  id: TEST_USER_ID,
  full_name: 'Test User',
  email: TEST_EMAIL,
  payment_status: 'paid',
  activated: true,
  activated_at: '2026-02-15T10:00:00Z',
  linkedin_cookie: null,
  cookie_updated_at: null,
  created_at: '2026-02-14T08:00:00Z',
  password_hash: '$2b$10$mockedHashValue'
};

const mockUserWithCookie = {
  ...mockUser,
  linkedin_cookie: 'AQEDARabcdef123456789012345678901234567890123456789012',
  cookie_updated_at: '2026-02-16T09:00:00Z'
};

const mockAPIKeys = [
  { id: 'key-1', service: 'all', key_name: 'Master API Key', api_key: 'a'.repeat(64), is_active: true, last_used_at: null, created_at: '2026-02-15T10:00:00Z' },
  { id: 'key-2', service: 'enrichment', key_name: 'Email Enrichment API Key', api_key: 'b'.repeat(64), is_active: true, last_used_at: null, created_at: '2026-02-15T10:00:00Z' },
  { id: 'key-3', service: 'instagram', key_name: 'Instagram API Key', api_key: 'c'.repeat(64), is_active: true, last_used_at: null, created_at: '2026-02-15T10:00:00Z' },
  { id: 'key-4', service: 'linkedin', key_name: 'LinkedIn API Key', api_key: 'd'.repeat(64), is_active: true, last_used_at: '2026-02-16T09:15:00Z', created_at: '2026-02-15T10:00:00Z' },
  { id: 'key-5', service: 'ytdlp', key_name: 'YouTube API Key', api_key: 'e'.repeat(64), is_active: true, last_used_at: null, created_at: '2026-02-15T10:00:00Z' }
];

// ============================================================================
// Test Suites
// ============================================================================

describe('User Management API - Integration Tests', () => {
  let authToken;

  beforeAll(() => {
    authToken = generateTestToken();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // SUITE 1: GET /api/user/profile
  // ============================================================================
  describe('GET /api/user/profile', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/user/profile');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('No token provided');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with expired token', async () => {
      const expiredToken = generateExpiredToken();

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Token expired');
    });

    it('should return 200 with valid token and user data', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(TEST_USER_ID);
      expect(res.body.user.full_name).toBe('Test User');
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    it('should exclude sensitive data (password_hash, linkedin_cookie)', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserWithCookie, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).not.toHaveProperty('password_hash');
      expect(res.body.user).not.toHaveProperty('linkedin_cookie');
    });

    it('should include linkedin_cookie_set boolean', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserWithCookie, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.linkedin_cookie_set).toBe(true);
    });
  });

  // ============================================================================
  // SUITE 2: PUT /api/user/profile
  // ============================================================================
  describe('PUT /api/user/profile', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .send({ full_name: 'New Name' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with no fields provided', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid full_name (too short)', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ full_name: 'A' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid full_name (special chars)', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ full_name: 'Name123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with invalid email format', async () => {
      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 if email already exists (different user)', async () => {
      // Mock: email uniqueness check finds existing user
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'other-user-id' },
                error: null
              })
            })
          })
        })
      });

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'existing@example.com' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Email already in use');
    });

    it('should return 200 when updating full_name only', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUser, full_name: 'Jane Doe' },
                  error: null
                })
              })
            })
          };
        }
      });

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ full_name: 'Jane Doe' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Profile updated successfully');
      expect(res.body.user).toBeDefined();
    });

    it('should return 200 when updating email only', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Email uniqueness check - no conflict
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                })
              })
            })
          };
        } else if (callCount === 2) {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUser, email: 'newemail@example.com' },
                  error: null
                })
              })
            })
          };
        }
      });

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ email: 'newemail@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
    });

    it('should return 200 when updating both fields', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
                })
              })
            })
          };
        } else if (callCount === 2) {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUser, full_name: 'Updated Name', email: 'updated@example.com' },
                  error: null
                })
              })
            })
          };
        }
      });

      const res = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ full_name: 'Updated Name', email: 'updated@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Profile updated successfully');
      expect(res.body.user).toBeDefined();
    });
  });

  // ============================================================================
  // SUITE 3: PUT /api/user/change-password
  // ============================================================================
  describe('PUT /api/user/change-password', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .put('/api/user/change-password')
        .send({
          current_password: 'OldPass123',
          new_password: 'NewPass456',
          confirm_password: 'NewPass456'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with missing required fields', async () => {
      const res = await request(app)
        .put('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ current_password: 'OldPass123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if new_password too short', async () => {
      const res = await request(app)
        .put('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'OldPass123',
          new_password: 'short',
          confirm_password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if passwords do not match', async () => {
      const res = await request(app)
        .put('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'OldPass123',
          new_password: 'NewPassword456',
          confirm_password: 'DifferentPassword789'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with valid password change', async () => {
      // Mock: fetch user password_hash, then update
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { password_hash: '$2b$10$hashedPassword' },
                  error: null
                })
              })
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        }
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)   // Current password matches
        .mockResolvedValueOnce(false); // New password is different
      bcrypt.hash.mockResolvedValue('$2b$10$newHashedPassword');

      const res = await request(app)
        .put('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'OldPassword123',
          new_password: 'NewPassword456',
          confirm_password: 'NewPassword456'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password changed successfully');
    });

    it('should enforce strict rate limiting (5 req/hour)', async () => {
      // This is the 6th request to change-password - should be rate limited
      const res = await request(app)
        .put('/api/user/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'OldPassword123',
          new_password: 'NewPassword456',
          confirm_password: 'NewPassword456'
        });

      expect(res.status).toBe(429);
    });
  });

  // ============================================================================
  // SUITE 4: POST /api/user/cookie
  // ============================================================================
  describe('POST /api/user/cookie', () => {
    const validCookie = 'AQEDARabcdef123456789012345678901234567890123456789012';
    const validUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    it('should return 401 without token', async () => {
      const res = await request(app)
        .post('/api/user/cookie')
        .send({
          linkedin_cookie: validCookie,
          user_agent: validUserAgent
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with missing linkedin_cookie', async () => {
      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ user_agent: validUserAgent });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 with missing user_agent', async () => {
      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ linkedin_cookie: validCookie });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if cookie too short (<50 chars)', async () => {
      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          linkedin_cookie: 'too-short-cookie',
          user_agent: validUserAgent
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if user_agent invalid (no Mozilla)', async () => {
      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          linkedin_cookie: validCookie,
          user_agent: 'CustomBot/1.0'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with valid cookie and user agent', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          linkedin_cookie: validCookie,
          user_agent: validUserAgent
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('LinkedIn cookie stored successfully');
    });

    it('should return cookie_updated_at timestamp', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const res = await request(app)
        .post('/api/user/cookie')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          linkedin_cookie: validCookie,
          user_agent: validUserAgent
        });

      expect(res.status).toBe(200);
      expect(res.body.cookie_updated_at).toBeDefined();
      // Verify it's a valid ISO date string
      expect(new Date(res.body.cookie_updated_at).toISOString()).toBe(res.body.cookie_updated_at);
    });
  });

  // ============================================================================
  // SUITE 5: GET /api/user/api-keys
  // ============================================================================
  describe('GET /api/user/api-keys', () => {
    it('should return 401 without token', async () => {
      const res = await request(app)
        .get('/api/user/api-keys');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 200 with array of 5 API keys for activated user', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockAPIKeys, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.api_keys).toBeDefined();
      expect(res.body.api_keys).toHaveLength(5);
    });

    it('should return empty array for non-activated user', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // No API keys found
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          };
        } else {
          // User activation check - not activated
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { activated: false },
                  error: null
                })
              })
            })
          };
        }
      });

      const res = await request(app)
        .get('/api/user/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.api_keys).toEqual([]);
    });

    it('should include all key fields in response', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockAPIKeys, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      res.body.api_keys.forEach(key => {
        expect(key).toHaveProperty('id');
        expect(key).toHaveProperty('service');
        expect(key).toHaveProperty('key_name');
        expect(key).toHaveProperty('api_key');
        expect(key).toHaveProperty('is_active');
        expect(key).toHaveProperty('last_used_at');
        expect(key).toHaveProperty('created_at');
      });
    });

    it('should return 404 for activated user with no keys (error state)', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { activated: true },
                  error: null
                })
              })
            })
          };
        }
      });

      const res = await request(app)
        .get('/api/user/api-keys')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No API keys found');
    });
  });

  // ============================================================================
  // SUITE 6: Regression & Cross-cutting Tests
  // ============================================================================
  describe('Regression & Cross-cutting', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await request(app)
        .get('/api/user/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should have health endpoint still working', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.status).toBe(200);
    });

    it('should return proper CORS headers', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Origin', process.env.CORS_ORIGIN || 'https://contentscrapingserver.site');

      // CORS should allow the configured origin
      expect(res.status).not.toBe(403);
    });

    it('should handle 500 errors from service layer gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Internal server error');
    });

    it('should reject request with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Basic credentials-here');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should confirm Phase 2 auth routes are still registered', async () => {
      // POST /api/auth/signup should exist (even though it may fail with mocked supabase)
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ name: 'Test', email: 'test@test.com', password: 'TestPass123' });

      // Should NOT be 404 - route is registered
      expect(res.status).not.toBe(404);
    });

    it('should confirm Phase 3 payment routes are still registered', async () => {
      // POST /api/payment/confirm should exist
      const res = await request(app)
        .post('/api/payment/confirm')
        .send({});

      // Should NOT be 404 - route is registered
      expect(res.status).not.toBe(404);
    });
  });
});
