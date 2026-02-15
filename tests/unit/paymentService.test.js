/**
 * Unit tests for paymentService
 */

// Set up test environment before importing
process.env.N8N_WEBHOOK_SECRET = 'test-secret-key-for-unit-tests';

const crypto = require('crypto');

// Mock Supabase before importing paymentService
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

const paymentService = require('../../src/services/paymentService');
const supabase = require('../../src/config/supabase');

describe('paymentService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure N8N_WEBHOOK_SECRET is set for tests
    process.env.N8N_WEBHOOK_SECRET = 'test-secret-key-for-unit-tests';
  });

  describe('verifyWebhookSignature', () => {

    it('should return true for valid signature', () => {
      const payload = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      // Generate valid signature
      const secret = process.env.N8N_WEBHOOK_SECRET;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      const result = paymentService.verifyWebhookSignature(payload, validSignature);
      expect(result).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      // Generate a valid-looking but incorrect signature (64 hex chars)
      const invalidSignature = 'a'.repeat(64);

      const result = paymentService.verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });

    it('should return false for tampered payload', () => {
      const originalPayload = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const secret = process.env.N8N_WEBHOOK_SECRET;
      const validSignature = crypto
        .createHmac('sha256', secret)
        .update(JSON.stringify(originalPayload))
        .digest('hex');

      // Tamper with the payload
      const tamperedPayload = {
        ...originalPayload,
        amount: 100.00 // Changed from 10.00
      };

      const result = paymentService.verifyWebhookSignature(tamperedPayload, validSignature);
      expect(result).toBe(false);
    });

    it('should return false when payload is missing', () => {
      const signature = 'a'.repeat(64);
      const result = paymentService.verifyWebhookSignature(null, signature);
      expect(result).toBe(false);
    });

    it('should return false when signature is missing', () => {
      const payload = { payment_id: 'PS_abc123' };
      const result = paymentService.verifyWebhookSignature(payload, null);
      expect(result).toBe(false);
    });

    it('should return false when both payload and signature are missing', () => {
      const result = paymentService.verifyWebhookSignature(null, null);
      expect(result).toBe(false);
    });

    it('should return false when payload is undefined', () => {
      const result = paymentService.verifyWebhookSignature(undefined, 'a'.repeat(64));
      expect(result).toBe(false);
    });

    it('should return false when signature is undefined', () => {
      const payload = { payment_id: 'PS_abc123' };
      const result = paymentService.verifyWebhookSignature(payload, undefined);
      expect(result).toBe(false);
    });

    it('should return false when N8N_WEBHOOK_SECRET not configured', () => {
      const originalSecret = process.env.N8N_WEBHOOK_SECRET;
      delete process.env.N8N_WEBHOOK_SECRET;

      const payload = { payment_id: 'PS_abc123' };
      const signature = 'a'.repeat(64);

      const result = paymentService.verifyWebhookSignature(payload, signature);
      expect(result).toBe(false);

      // Restore
      process.env.N8N_WEBHOOK_SECRET = originalSecret;
    });

    it('should return false for signature with invalid hex characters', () => {
      const payload = { payment_id: 'PS_abc123' };
      const invalidSignature = 'not-valid-hex-signature';

      const result = paymentService.verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });

    it('should return false for signature with wrong length', () => {
      const payload = { payment_id: 'PS_abc123' };
      const shortSignature = 'abc123'; // Too short

      const result = paymentService.verifyWebhookSignature(payload, shortSignature);
      expect(result).toBe(false);
    });
  });

  describe('validatePaymentData', () => {

    it('should return null for valid payment data', () => {
      const validData = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(validData);
      expect(result).toBeNull();
    });

    it('should accept Payment ID with PS_ format', () => {
      const data = {
        payment_id: 'PS_697b73d1eb2ff',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });

    it('should accept Payment ID with numeric format', () => {
      const data = {
        payment_id: '5786268280',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });

    it('should accept Payment ID with mixed format', () => {
      const data = {
        payment_id: 'REF-2024-ABC-123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });

    it('should accept Payment ID with special characters', () => {
      const data = {
        payment_id: 'PAY-ID_2024/01/29-ABC',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });

    it('should reject empty Payment ID', () => {
      const data = {
        payment_id: '',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'payment_id')).toBe(true);
    });

    it('should reject missing Payment ID', () => {
      const data = {
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'payment_id')).toBe(true);
    });

    it('should reject Payment ID longer than 100 characters', () => {
      const data = {
        payment_id: 'a'.repeat(101),
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'payment_id')).toBe(true);
    });

    it('should reject invalid email format', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'not-an-email',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject missing email', () => {
      const data = {
        payment_id: 'PS_abc123',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject email without @ symbol', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'testexample.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'email')).toBe(true);
    });

    it('should reject amount not equal to 10.00', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 20.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject missing amount', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject amount as string instead of number', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: '10.00',
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject amount of 0', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 0,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'amount')).toBe(true);
    });

    it('should reject currency not USD', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'EUR',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'currency')).toBe(true);
    });

    it('should reject missing currency', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'currency')).toBe(true);
    });

    it('should reject lowercase currency usd', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'usd',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'currency')).toBe(true);
    });

    it('should reject status not completed', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'pending',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'status')).toBe(true);
    });

    it('should reject missing status', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'status')).toBe(true);
    });

    it('should reject status failed', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'failed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'status')).toBe(true);
    });

    it('should reject invalid timestamp format', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: 'not-a-date'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'timestamp')).toBe(true);
    });

    it('should reject missing timestamp', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.some(e => e.field === 'timestamp')).toBe(true);
    });

    it('should return multiple errors for multiple invalid fields', () => {
      const data = {
        payment_id: '',
        email: 'not-email',
        amount: 5.00,
        currency: 'EUR',
        status: 'pending',
        timestamp: 'invalid'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(6); // All 6 fields invalid
    });

    it('should accept valid ISO 8601 timestamp with timezone', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00+05:30'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });

    it('should accept valid ISO 8601 timestamp without timezone', () => {
      const data = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00'
      };

      const result = paymentService.validatePaymentData(data);
      expect(result).toBeNull();
    });
  });

  describe('processPayment', () => {

    it('should successfully process valid payment', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        full_name: 'Test User',
        payment_status: 'pending',
        payment_id: null
      };

      // Setup mock chain for finding user
      const mockUserSelectSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });
      const mockUserSelectEq = jest.fn().mockReturnValue({ single: mockUserSelectSingle });
      const mockUserSelect = jest.fn().mockReturnValue({ eq: mockUserSelectEq });

      // Setup mock chain for checking duplicate
      const mockDupSelectSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      const mockDupSelectEq = jest.fn().mockReturnValue({ single: mockDupSelectSingle });
      const mockDupSelect = jest.fn().mockReturnValue({ eq: mockDupSelectEq });

      // Setup mock chain for update
      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

      // Setup mock for system_logs insert
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            // First call: find user by email
            return { select: mockUserSelect, update: mockUpdate };
          } else {
            // Second call: check duplicate payment_id
            return { select: mockDupSelect, update: mockUpdate };
          }
        }
        if (table === 'system_logs') {
          return { insert: mockInsert };
        }
        return {};
      });

      const result = await paymentService.processPayment(paymentData);

      expect(result).toEqual({
        success: true,
        user_id: 'user-uuid-123',
        payment_id: 'PS_abc123'
      });
    });

    it('should throw error when user not found', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: 'nonexistent@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      // Mock user not found
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      await expect(paymentService.processPayment(paymentData))
        .rejects
        .toThrow('User not found');
    });

    it('should throw error when duplicate payment_id exists', async () => {
      const paymentData = {
        payment_id: 'PS_duplicate123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        payment_status: 'pending',
        payment_id: null
      };

      const mockExistingPayment = {
        id: 'other-user-uuid',
        email: 'other@example.com'
      };

      // Setup mock for user lookup (success)
      const mockUserSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      // Setup mock for duplicate check (found duplicate)
      const mockDupSingle = jest.fn().mockResolvedValue({ data: mockExistingPayment, error: null });

      // Setup mock for duplicate_payments insert
      const mockDupInsert = jest.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockUserSingle
                })
              })
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockDupSingle
                })
              })
            };
          }
        }
        if (table === 'duplicate_payments') {
          return { insert: mockDupInsert };
        }
        return {};
      });

      await expect(paymentService.processPayment(paymentData))
        .rejects
        .toThrow('Payment ID already exists');

      // Verify duplicate_payments entry was created
      expect(mockDupInsert).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: 'TEST@EXAMPLE.COM',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        payment_status: 'pending',
        payment_id: null
      };

      const mockUserEq = jest.fn();
      const mockUserSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });
      mockUserEq.mockReturnValue({ single: mockUserSingle });

      const mockDupEq = jest.fn();
      const mockDupSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      mockDupEq.mockReturnValue({ single: mockDupSingle });

      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({ eq: mockUserEq }),
              update: mockUpdate
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({ eq: mockDupEq }),
              update: mockUpdate
            };
          }
        }
        if (table === 'system_logs') {
          return { insert: mockInsert };
        }
        return {};
      });

      await paymentService.processPayment(paymentData);

      // Verify email was normalized to lowercase when searching
      expect(mockUserEq).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should trim whitespace from email', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: '  test@example.com  ',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        payment_status: 'pending',
        payment_id: null
      };

      const mockUserEq = jest.fn();
      const mockUserSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });
      mockUserEq.mockReturnValue({ single: mockUserSingle });

      const mockDupEq = jest.fn();
      const mockDupSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      mockDupEq.mockReturnValue({ single: mockDupSingle });

      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({ eq: mockUserEq }),
              update: mockUpdate
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({ eq: mockDupEq }),
              update: mockUpdate
            };
          }
        }
        if (table === 'system_logs') {
          return { insert: mockInsert };
        }
        return {};
      });

      await paymentService.processPayment(paymentData);

      // Verify email was trimmed
      expect(mockUserEq).toHaveBeenCalledWith('email', 'test@example.com');
    });

    it('should throw error when update fails', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        payment_status: 'pending',
        payment_id: null
      };

      // Mock user found
      const mockUserSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });

      // Mock no duplicate
      const mockDupSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      // Mock update failure
      const mockUpdateEq = jest.fn().mockResolvedValue({
        error: { message: 'Database error' }
      });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockUserSingle
                })
              }),
              update: mockUpdate
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockDupSingle
                })
              }),
              update: mockUpdate
            };
          }
        }
        return {};
      });

      // The internal error is caught and re-thrown as a generic error for security
      await expect(paymentService.processPayment(paymentData))
        .rejects
        .toThrow('Failed to process payment');
    });

    it('should log transaction to system_logs on success', async () => {
      const paymentData = {
        payment_id: 'PS_abc123',
        email: 'test@example.com',
        amount: 10.00,
        currency: 'USD',
        status: 'completed',
        timestamp: '2026-02-14T10:00:00Z'
      };

      const mockUser = {
        id: 'user-uuid-123',
        email: 'test@example.com',
        payment_status: 'pending',
        payment_id: null
      };

      const mockUserSingle = jest.fn().mockResolvedValue({ data: mockUser, error: null });
      const mockDupSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      const mockUpdateEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      let selectCallCount = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'users') {
          selectCallCount++;
          if (selectCallCount === 1) {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockUserSingle
                })
              }),
              update: mockUpdate
            };
          } else {
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: mockDupSingle
                })
              }),
              update: mockUpdate
            };
          }
        }
        if (table === 'system_logs') {
          return { insert: mockInsert };
        }
        return {};
      });

      await paymentService.processPayment(paymentData);

      // Verify system_logs insert was called
      expect(mockInsert).toHaveBeenCalled();
      const insertCall = mockInsert.mock.calls[0][0];
      expect(insertCall.log_level).toBe('info');
      expect(insertCall.service).toBe('payment');
      expect(insertCall.action).toBe('payment_confirmed');
      expect(insertCall.user_id).toBe('user-uuid-123');
    });
  });
});
