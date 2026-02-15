/**
 * Unit tests for paymentValidationService
 */

// Mock Supabase before importing service
jest.mock('../../src/config/supabase', () => ({
  from: jest.fn()
}));

// Mock logger to prevent console output during tests
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const { validatePaymentId } = require('../../src/services/paymentValidationService');
const supabase = require('../../src/config/supabase');
const logger = require('../../src/utils/logger');

describe('paymentValidationService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to mock a successful Supabase user lookup
   */
  const mockUserLookup = (user) => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: user,
            error: null
          })
        })
      })
    });
  };

  /**
   * Helper to mock a failed Supabase user lookup (not found)
   */
  const mockUserNotFound = () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }
          })
        })
      })
    });
  };

  describe('validatePaymentId', () => {

    it('should return valid result for correct Payment ID (format: PS_xxx)', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_697b73d1eb2ff',
        activated: false
      };

      mockUserLookup(mockUser);

      const result = await validatePaymentId('test@example.com', 'PS_697b73d1eb2ff');

      expect(result).toEqual({
        valid: true,
        user: {
          id: 'user-uuid-123',
          email: 'test@example.com',
          full_name: 'Test User',
          payment_status: 'paid',
          activated: false
        }
      });
    });

    it('should return valid result for correct Payment ID (format: numeric)', async () => {
      const mockUser = {
        id: 'user-uuid-456',
        email: 'user@example.com',
        full_name: 'Another User',
        payment_status: 'paid',
        payment_id: '5786268280',
        activated: false
      };

      mockUserLookup(mockUser);

      const result = await validatePaymentId('user@example.com', '5786268280');

      expect(result).toEqual({
        valid: true,
        user: {
          id: 'user-uuid-456',
          email: 'user@example.com',
          full_name: 'Another User',
          payment_status: 'paid',
          activated: false
        }
      });
    });

    it('should reject empty Payment ID', async () => {
      await expect(validatePaymentId('test@example.com', ''))
        .rejects
        .toThrow('Payment ID is required');
    });

    it('should reject null Payment ID', async () => {
      await expect(validatePaymentId('test@example.com', null))
        .rejects
        .toThrow('Payment ID is required');
    });

    it('should reject undefined Payment ID', async () => {
      await expect(validatePaymentId('test@example.com', undefined))
        .rejects
        .toThrow('Payment ID is required');
    });

    it('should reject whitespace-only Payment ID', async () => {
      await expect(validatePaymentId('test@example.com', '   '))
        .rejects
        .toThrow('Payment ID is required');
    });

    it('should reject non-string Payment ID', async () => {
      await expect(validatePaymentId('test@example.com', 12345))
        .rejects
        .toThrow('Payment ID is required');
    });

    it('should reject when user not found', async () => {
      mockUserNotFound();

      await expect(validatePaymentId('nonexistent@example.com', 'PS_abc123'))
        .rejects
        .toThrow('User not found');
    });

    it('should reject when user has no payment_id', async () => {
      const mockUser = {
        id: 'user-uuid-789',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'pending',
        payment_id: null,
        activated: false
      };

      mockUserLookup(mockUser);

      await expect(validatePaymentId('test@example.com', 'PS_abc123'))
        .rejects
        .toThrow('No payment found for this user');
    });

    it('should reject when user has empty string payment_id', async () => {
      const mockUser = {
        id: 'user-uuid-789',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'pending',
        payment_id: '',
        activated: false
      };

      mockUserLookup(mockUser);

      await expect(validatePaymentId('test@example.com', 'PS_abc123'))
        .rejects
        .toThrow('No payment found for this user');
    });

    it('should reject when Payment ID does not match (case-sensitive)', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_abc123',
        activated: false
      };

      mockUserLookup(mockUser);

      // Different case
      await expect(validatePaymentId('test@example.com', 'PS_ABC123'))
        .rejects
        .toThrow('Payment ID does not match');
    });

    it('should reject when Payment ID is completely different', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_abc123',
        activated: false
      };

      mockUserLookup(mockUser);

      await expect(validatePaymentId('test@example.com', 'PS_xyz789'))
        .rejects
        .toThrow('Payment ID does not match');
    });

    it('should reject when payment_status is pending', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'pending',
        payment_id: 'PS_abc123',
        activated: false
      };

      mockUserLookup(mockUser);

      await expect(validatePaymentId('test@example.com', 'PS_abc123'))
        .rejects
        .toThrow('Payment has not been completed');
    });

    it('should reject when payment_status is null', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: null,
        payment_id: 'PS_abc123',
        activated: false
      };

      mockUserLookup(mockUser);

      await expect(validatePaymentId('test@example.com', 'PS_abc123'))
        .rejects
        .toThrow('Payment has not been completed');
    });

    it('should handle database errors gracefully', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockRejectedValue(new Error('Connection refused'))
          })
        })
      });

      await expect(validatePaymentId('test@example.com', 'PS_abc123'))
        .rejects
        .toThrow('Connection refused');

      expect(logger.error).toHaveBeenCalledWith(
        'Payment validation failed unexpectedly',
        expect.objectContaining({
          error: 'Connection refused'
        })
      );
    });

    it('should normalize email to lowercase before lookup', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_abc123',
        activated: false
      };

      const mockEq = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq
        })
      });

      await validatePaymentId('TEST@EXAMPLE.COM', 'PS_abc123');

      expect(mockEq).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should trim email whitespace before lookup', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_abc123',
        activated: false
      };

      const mockEq = jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      });

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEq
        })
      });

      await validatePaymentId('  test@example.com  ', 'PS_abc123');

      expect(mockEq).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should not include payment_id in returned user object', async () => {
      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'paid',
        payment_id: 'PS_abc123',
        activated: false
      };

      mockUserLookup(mockUser);

      const result = await validatePaymentId('test@example.com', 'PS_abc123');

      expect(result.user).not.toHaveProperty('payment_id');
      expect(result.user).toHaveProperty('id');
      expect(result.user).toHaveProperty('email');
      expect(result.user).toHaveProperty('full_name');
      expect(result.user).toHaveProperty('payment_status');
      expect(result.user).toHaveProperty('activated');
    });
  });
});
