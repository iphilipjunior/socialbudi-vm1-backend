/**
 * Unit tests for orphanedPaymentService
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

const orphanedPaymentService = require('../../src/services/orphanedPaymentService');
const supabase = require('../../src/config/supabase');
const logger = require('../../src/utils/logger');

describe('orphanedPaymentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectOrphanedPayments', () => {
    it('should return empty array when no paid users exist', async () => {
      // Mock Supabase to return empty result
      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toEqual([]);
      expect(supabase.from).toHaveBeenCalledWith('users');
      expect(logger.info).toHaveBeenCalledWith('No paid users found - no orphaned payments possible');
    });

    it('should return empty array when no duplicate payment IDs exist', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          payment_id: 'PS_unique1',
          payment_status: 'paid',
          created_at: '2026-02-01T10:00:00Z'
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          payment_id: 'PS_unique2',
          payment_status: 'paid',
          created_at: '2026-02-02T10:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('Orphaned payment detection completed', {
        total_paid_users: 2,
        unique_payment_ids: 2,
        orphaned_count: 0
      });
    });

    it('should detect single orphaned payment (duplicate payment ID)', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'first@example.com',
          payment_id: 'PS_duplicate123',
          payment_status: 'paid',
          created_at: '2026-02-01T10:00:00Z'
        },
        {
          id: 'user-2',
          email: 'second@example.com',
          payment_id: 'PS_duplicate123',
          payment_status: 'paid',
          created_at: '2026-02-02T11:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        payment_id: 'PS_duplicate123',
        original_user_email: 'first@example.com',
        original_user_id: 'user-1',
        duplicate_user_email: 'second@example.com',
        duplicate_user_id: 'user-2'
      });
      expect(result[0].detected_at).toBeDefined();
    });

    it('should detect multiple orphaned payments from same payment ID', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'first@example.com',
          payment_id: 'PS_triple123',
          payment_status: 'paid',
          created_at: '2026-02-01T10:00:00Z'
        },
        {
          id: 'user-2',
          email: 'second@example.com',
          payment_id: 'PS_triple123',
          payment_status: 'paid',
          created_at: '2026-02-02T11:00:00Z'
        },
        {
          id: 'user-3',
          email: 'third@example.com',
          payment_id: 'PS_triple123',
          payment_status: 'paid',
          created_at: '2026-02-03T12:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toHaveLength(2);

      // First duplicate
      expect(result[0]).toMatchObject({
        payment_id: 'PS_triple123',
        original_user_email: 'first@example.com',
        original_user_id: 'user-1',
        duplicate_user_email: 'second@example.com',
        duplicate_user_id: 'user-2'
      });

      // Second duplicate
      expect(result[1]).toMatchObject({
        payment_id: 'PS_triple123',
        original_user_email: 'first@example.com',
        original_user_id: 'user-1',
        duplicate_user_email: 'third@example.com',
        duplicate_user_id: 'user-3'
      });
    });

    it('should detect orphaned payments from multiple different payment IDs', async () => {
      const mockUsers = [
        // First duplicate set
        {
          id: 'user-1',
          email: 'user1@example.com',
          payment_id: 'PS_dup1',
          payment_status: 'paid',
          created_at: '2026-02-01T10:00:00Z'
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          payment_id: 'PS_dup1',
          payment_status: 'paid',
          created_at: '2026-02-02T10:00:00Z'
        },
        // Unique payment
        {
          id: 'user-3',
          email: 'user3@example.com',
          payment_id: 'PS_unique',
          payment_status: 'paid',
          created_at: '2026-02-03T10:00:00Z'
        },
        // Second duplicate set
        {
          id: 'user-4',
          email: 'user4@example.com',
          payment_id: 'PS_dup2',
          payment_status: 'paid',
          created_at: '2026-02-04T10:00:00Z'
        },
        {
          id: 'user-5',
          email: 'user5@example.com',
          payment_id: 'PS_dup2',
          payment_status: 'paid',
          created_at: '2026-02-05T10:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toHaveLength(2);
      expect(result[0].payment_id).toBe('PS_dup1');
      expect(result[1].payment_id).toBe('PS_dup2');
    });

    it('should sort users by created_at to identify original correctly', async () => {
      const mockUsers = [
        // Second chronologically (should be duplicate)
        {
          id: 'user-2',
          email: 'second@example.com',
          payment_id: 'PS_test',
          payment_status: 'paid',
          created_at: '2026-02-02T10:00:00Z'
        },
        // First chronologically (should be original)
        {
          id: 'user-1',
          email: 'first@example.com',
          payment_id: 'PS_test',
          payment_status: 'paid',
          created_at: '2026-02-01T10:00:00Z'
        }
      ];

      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockUsers,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toHaveLength(1);
      expect(result[0].original_user_email).toBe('first@example.com');
      expect(result[0].duplicate_user_email).toBe('second@example.com');
    });

    it('should throw error when database query fails', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection timeout' }
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      await expect(orphanedPaymentService.detectOrphanedPayments())
        .rejects
        .toThrow('Database query failed: Connection timeout');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to query paid users for orphaned payment detection',
        expect.objectContaining({
          error: 'Connection timeout'
        })
      );
    });

    it('should handle null data from database gracefully', async () => {
      const mockSelect = jest.fn().mockReturnValue({
        not: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      supabase.from.mockReturnValue({
        select: mockSelect
      });

      const result = await orphanedPaymentService.detectOrphanedPayments();

      expect(result).toEqual([]);
    });
  });

  describe('createOrphanedPaymentAlert', () => {
    const mockOrphanedPayment = {
      payment_id: 'PS_test123',
      original_user_email: 'original@example.com',
      original_user_id: 'uuid-original',
      duplicate_user_email: 'duplicate@example.com',
      duplicate_user_id: 'uuid-duplicate'
    };

    it('should create duplicate_payments entry and admin alert successfully', async () => {
      const mockAlert = {
        id: 'alert-uuid-123',
        alert_type: 'orphaned_payment',
        severity: 'high',
        message: 'Duplicate Payment ID detected: PS_test123'
      };

      // Mock duplicate_payments insert
      const mockDupInsert = jest.fn().mockResolvedValue({ error: null });

      // Mock admin_alerts insert
      const mockAlertSingle = jest.fn().mockResolvedValue({
        data: mockAlert,
        error: null
      });
      const mockAlertSelect = jest.fn().mockReturnValue({
        single: mockAlertSingle
      });
      const mockAlertInsert = jest.fn().mockReturnValue({
        select: mockAlertSelect
      });

      // Mock system_logs insert
      const mockLogsInsert = jest.fn().mockResolvedValue({ error: null });

      let fromCallCount = 0;
      supabase.from.mockImplementation((table) => {
        fromCallCount++;
        if (fromCallCount === 1) {
          // First call: duplicate_payments
          return { insert: mockDupInsert };
        } else if (fromCallCount === 2) {
          // Second call: admin_alerts
          return { insert: mockAlertInsert };
        } else {
          // Third call: system_logs
          return { insert: mockLogsInsert };
        }
      });

      const result = await orphanedPaymentService.createOrphanedPaymentAlert(mockOrphanedPayment);

      expect(result).toEqual(mockAlert);

      // Verify duplicate_payments insert
      expect(mockDupInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_id: 'PS_test123',
          original_email: 'original@example.com',
          duplicate_email: 'duplicate@example.com',
          amount: 10.00,
          currency: 'USD',
          resolved: false
        })
      );

      // Verify admin_alerts insert
      expect(mockAlertInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          alert_type: 'orphaned_payment',
          severity: 'high',
          message: 'Duplicate Payment ID detected: PS_test123',
          alert_data: expect.objectContaining({
            payment_id: 'PS_test123'
          }),
          resolved: false
        })
      );

      // Verify system_logs insert
      expect(mockLogsInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          log_level: 'warn',
          service: 'orphaned_payment_detector',
          action: 'orphaned_payment_detected',
          message: expect.stringContaining('PS_test123')
        })
      );
    });

    it('should continue and create alert even if duplicate_payments insert fails', async () => {
      const mockAlert = {
        id: 'alert-uuid-456',
        alert_type: 'orphaned_payment',
        severity: 'high'
      };

      // Mock duplicate_payments insert with error
      const mockDupInsert = jest.fn().mockResolvedValue({
        error: { message: 'Duplicate entry' }
      });

      // Mock admin_alerts insert (success)
      const mockAlertSingle = jest.fn().mockResolvedValue({
        data: mockAlert,
        error: null
      });
      const mockAlertSelect = jest.fn().mockReturnValue({
        single: mockAlertSingle
      });
      const mockAlertInsert = jest.fn().mockReturnValue({
        select: mockAlertSelect
      });

      // Mock system_logs insert
      const mockLogsInsert = jest.fn().mockResolvedValue({ error: null });

      let fromCallCount = 0;
      supabase.from.mockImplementation((table) => {
        fromCallCount++;
        if (fromCallCount === 1) {
          return { insert: mockDupInsert };
        } else if (fromCallCount === 2) {
          return { insert: mockAlertInsert };
        } else {
          return { insert: mockLogsInsert };
        }
      });

      const result = await orphanedPaymentService.createOrphanedPaymentAlert(mockOrphanedPayment);

      expect(result).toEqual(mockAlert);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to insert duplicate payment record',
        expect.objectContaining({
          error: 'Duplicate entry'
        })
      );
    });

    it('should throw error when admin_alerts insert fails', async () => {
      // Mock duplicate_payments insert (success)
      const mockDupInsert = jest.fn().mockResolvedValue({ error: null });

      // Mock admin_alerts insert (failure)
      const mockAlertSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' }
      });
      const mockAlertSelect = jest.fn().mockReturnValue({
        single: mockAlertSingle
      });
      const mockAlertInsert = jest.fn().mockReturnValue({
        select: mockAlertSelect
      });

      let fromCallCount = 0;
      supabase.from.mockImplementation((table) => {
        fromCallCount++;
        if (fromCallCount === 1) {
          return { insert: mockDupInsert };
        } else {
          return { insert: mockAlertInsert };
        }
      });

      await expect(
        orphanedPaymentService.createOrphanedPaymentAlert(mockOrphanedPayment)
      ).rejects.toThrow('Failed to create admin alert: Database connection lost');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create admin alert for orphaned payment',
        expect.objectContaining({
          error: 'Database connection lost',
          payment_id: 'PS_test123'
        })
      );
    });

    it('should log warning when alert is created successfully', async () => {
      const mockAlert = {
        id: 'alert-uuid-789',
        alert_type: 'orphaned_payment'
      };

      const mockDupInsert = jest.fn().mockResolvedValue({ error: null });

      const mockAlertSingle = jest.fn().mockResolvedValue({
        data: mockAlert,
        error: null
      });
      const mockAlertSelect = jest.fn().mockReturnValue({
        single: mockAlertSingle
      });
      const mockAlertInsert = jest.fn().mockReturnValue({
        select: mockAlertSelect
      });

      const mockLogsInsert = jest.fn().mockResolvedValue({ error: null });

      let fromCallCount = 0;
      supabase.from.mockImplementation((table) => {
        fromCallCount++;
        if (fromCallCount === 1) {
          return { insert: mockDupInsert };
        } else if (fromCallCount === 2) {
          return { insert: mockAlertInsert };
        } else {
          return { insert: mockLogsInsert };
        }
      });

      await orphanedPaymentService.createOrphanedPaymentAlert(mockOrphanedPayment);

      expect(logger.warn).toHaveBeenCalledWith(
        'Orphaned payment alert created',
        expect.objectContaining({
          payment_id: 'PS_test123',
          alert_id: 'alert-uuid-789',
          original_email: 'original@example.com',
          duplicate_email: 'duplicate@example.com'
        })
      );
    });
  });
});
