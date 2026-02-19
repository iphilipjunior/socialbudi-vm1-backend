/**
 * Unit tests for userService
 *
 * Tests user profile management, password changes, and LinkedIn cookie storage.
 */

// Set up environment variables before any imports
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.JWT_EXPIRES_IN = '1h';

// Mock modules BEFORE importing service
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn()
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Now import modules
const supabase = require('../../src/config/supabase');
const bcrypt = require('bcryptjs');
const userService = require('../../src/services/userService');

describe('userService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // getUserById Tests
  // ============================================================================
  describe('getUserById', () => {
    const mockUserId = 'test-user-uuid-123';

    const mockUserData = {
      id: mockUserId,
      full_name: 'John Doe',
      email: 'john@example.com',
      payment_status: 'paid',
      activated: true,
      activated_at: '2026-02-15T10:00:00Z',
      linkedin_cookie: 'AQEDARabcdef123456...',
      cookie_updated_at: '2026-02-16T09:00:00Z',
      created_at: '2026-02-14T08:00:00Z'
    };

    it('should return user profile with valid userId', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          })
        })
      });

      const result = await userService.getUserById(mockUserId);

      expect(result).toHaveProperty('id', mockUserId);
      expect(result).toHaveProperty('full_name', 'John Doe');
      expect(result).toHaveProperty('email', 'john@example.com');
      expect(result).toHaveProperty('payment_status', 'paid');
      expect(result).toHaveProperty('activated', true);
    });

    it('should compute linkedin_cookie_set correctly (true when cookie exists)', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          })
        })
      });

      const result = await userService.getUserById(mockUserId);

      expect(result.linkedin_cookie_set).toBe(true);
    });

    it('should compute linkedin_cookie_set correctly (false when no cookie)', async () => {
      const userWithoutCookie = { ...mockUserData, linkedin_cookie: null };
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: userWithoutCookie, error: null })
          })
        })
      });

      const result = await userService.getUserById(mockUserId);

      expect(result.linkedin_cookie_set).toBe(false);
    });

    it('should exclude linkedin_cookie from response', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockUserData, error: null })
          })
        })
      });

      const result = await userService.getUserById(mockUserId);

      expect(result).not.toHaveProperty('linkedin_cookie');
    });

    it('should exclude password_hash from response', async () => {
      const userWithPassword = { ...mockUserData, password_hash: 'hashed_password' };
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: userWithPassword, error: null })
          })
        })
      });

      const result = await userService.getUserById(mockUserId);

      expect(result).not.toHaveProperty('password_hash');
    });

    it('should throw error when user not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await expect(userService.getUserById(mockUserId)).rejects.toThrow('User not found');
    });

    it('should throw error on database error', async () => {
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

      await expect(userService.getUserById(mockUserId)).rejects.toThrow('Failed to fetch user profile');
    });
  });

  // ============================================================================
  // updateUserProfile Tests
  // ============================================================================
  describe('updateUserProfile', () => {
    const mockUserId = 'test-user-uuid-123';

    const mockUpdatedUser = {
      id: mockUserId,
      full_name: 'Jane Doe',
      email: 'jane@example.com',
      payment_status: 'paid',
      activated: true,
      activated_at: '2026-02-15T10:00:00Z',
      linkedin_cookie: null,
      cookie_updated_at: null,
      created_at: '2026-02-14T08:00:00Z'
    };

    it('should update full_name successfully', async () => {
      // For full_name only update, no email check needed
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call: update
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          // Second call: fetch updated user
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUpdatedUser, full_name: 'Jane Doe' },
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await userService.updateUserProfile(mockUserId, { full_name: 'Jane Doe' });

      expect(result).toHaveProperty('full_name', 'Jane Doe');
    });

    it('should update email successfully', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Email uniqueness check - no existing user
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
          // Update
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          // Fetch updated user
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUpdatedUser, email: 'newemail@example.com' },
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await userService.updateUserProfile(mockUserId, { email: 'newemail@example.com' });

      expect(result).toHaveProperty('email', 'newemail@example.com');
    });

    it('should update both full_name and email', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Email uniqueness check
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
          // Update
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          };
        } else {
          // Fetch updated user
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { ...mockUpdatedUser, full_name: 'New Name', email: 'new@example.com' },
                  error: null
                })
              })
            })
          };
        }
      });

      const result = await userService.updateUserProfile(mockUserId, {
        full_name: 'New Name',
        email: 'new@example.com'
      });

      expect(result).toHaveProperty('full_name', 'New Name');
      expect(result).toHaveProperty('email', 'new@example.com');
    });

    it('should throw error if no fields provided', async () => {
      await expect(userService.updateUserProfile(mockUserId, {})).rejects.toThrow(
        'At least one field (full_name or email) must be provided'
      );
    });

    it('should throw error if email already exists (different user)', async () => {
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

      await expect(
        userService.updateUserProfile(mockUserId, { email: 'existing@example.com' })
      ).rejects.toThrow('Email already in use by another account');
    });

    it('should allow same user to keep their email (no conflict)', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Email uniqueness check - PGRST116 means no other user has this email
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
                single: jest.fn().mockResolvedValue({ data: mockUpdatedUser, error: null })
              })
            })
          };
        }
      });

      const result = await userService.updateUserProfile(mockUserId, { email: 'jane@example.com' });

      expect(result).toBeDefined();
    });

    it('should throw error on database error during uniqueness check', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            neq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'OTHER_ERROR', message: 'Database error' }
              })
            })
          })
        })
      });

      await expect(
        userService.updateUserProfile(mockUserId, { email: 'test@example.com' })
      ).rejects.toThrow('Failed to verify email uniqueness');
    });

    it('should throw error on database error during update', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Update fails
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } })
            })
          };
        }
        return {};
      });

      await expect(
        userService.updateUserProfile(mockUserId, { full_name: 'Test' })
      ).rejects.toThrow('Failed to update user profile');
    });
  });

  // ============================================================================
  // changeUserPassword Tests
  // ============================================================================
  describe('changeUserPassword', () => {
    const mockUserId = 'test-user-uuid-123';
    const mockCurrentPassword = 'oldPassword123';
    const mockNewPassword = 'newPassword456';
    const mockPasswordHash = '$2b$10$hashedPasswordValue';

    it('should change password successfully with valid inputs', async () => {
      // Mock fetch user
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { password_hash: mockPasswordHash },
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

      // Mock bcrypt
      bcrypt.compare
        .mockResolvedValueOnce(true)  // Current password is valid
        .mockResolvedValueOnce(false); // New password is different
      bcrypt.hash.mockResolvedValue('$2b$10$newHashedPassword');

      const result = await userService.changeUserPassword(mockUserId, mockCurrentPassword, mockNewPassword);

      expect(result).toEqual({
        success: true,
        message: 'Password changed successfully'
      });
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
      expect(bcrypt.hash).toHaveBeenCalledWith(mockNewPassword, 10);
    });

    it('should throw error if current password incorrect', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { password_hash: mockPasswordHash },
              error: null
            })
          })
        })
      });

      bcrypt.compare.mockResolvedValue(false); // Current password doesn't match

      await expect(
        userService.changeUserPassword(mockUserId, 'wrongPassword', mockNewPassword)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error if new password same as current', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { password_hash: mockPasswordHash },
              error: null
            })
          })
        })
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)  // Current password is valid
        .mockResolvedValueOnce(true); // New password is same as current

      await expect(
        userService.changeUserPassword(mockUserId, mockCurrentPassword, mockCurrentPassword)
      ).rejects.toThrow('New password must be different from current password');
    });

    it('should throw error if user not found', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await expect(
        userService.changeUserPassword(mockUserId, mockCurrentPassword, mockNewPassword)
      ).rejects.toThrow('User not found');
    });

    it('should throw error on database error during fetch', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(
        userService.changeUserPassword(mockUserId, mockCurrentPassword, mockNewPassword)
      ).rejects.toThrow('Failed to verify current password');
    });

    it('should throw error on database error during update', async () => {
      let callCount = 0;
      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { password_hash: mockPasswordHash },
                  error: null
                })
              })
            })
          };
        } else {
          return {
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: { message: 'Update failed' } })
            })
          };
        }
      });

      bcrypt.compare
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      bcrypt.hash.mockResolvedValue('$2b$10$newHash');

      await expect(
        userService.changeUserPassword(mockUserId, mockCurrentPassword, mockNewPassword)
      ).rejects.toThrow('Failed to update password');
    });
  });

  // ============================================================================
  // storeLinkedInCookie Tests
  // ============================================================================
  describe('storeLinkedInCookie', () => {
    const mockUserId = 'test-user-uuid-123';
    const mockCookie = 'AQEDARabcdef123456789...'.repeat(5); // 50+ chars
    const mockUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

    it('should store cookie and user agent successfully', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await userService.storeLinkedInCookie(mockUserId, mockCookie, mockUserAgent);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('cookie_updated_at');
      expect(supabase.from).toHaveBeenCalledWith('users');
    });

    it('should update cookie_updated_at timestamp', async () => {
      const beforeTime = new Date().toISOString();

      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      const result = await userService.storeLinkedInCookie(mockUserId, mockCookie, mockUserAgent);

      const afterTime = new Date().toISOString();

      expect(result.cookie_updated_at).toBeDefined();
      expect(result.cookie_updated_at >= beforeTime).toBe(true);
      expect(result.cookie_updated_at <= afterTime).toBe(true);
    });

    it('should throw error on database error', async () => {
      supabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'Database error' } })
        })
      });

      await expect(
        userService.storeLinkedInCookie(mockUserId, mockCookie, mockUserAgent)
      ).rejects.toThrow('Failed to store LinkedIn cookie');
    });
  });
});
