/**
 * Unit tests for apiKeyService
 *
 * Tests API key generation and retrieval functionality.
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

jest.mock('crypto', () => ({
  randomBytes: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

// Now import modules
const supabase = require('../../src/config/supabase');
const crypto = require('crypto');
const apiKeyService = require('../../src/services/apiKeyService');

describe('apiKeyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // generateAPIKeys Tests
  // ============================================================================
  describe('generateAPIKeys', () => {
    const mockUserId = 'test-user-uuid-123';

    // Generate unique mock keys for each service
    const generateMockKey = (index) => `${'abcdef'.charAt(index)}`.repeat(64);

    const mockGeneratedKeys = [
      { id: 'key-1', user_id: mockUserId, api_key: generateMockKey(0), service: 'linkedin', key_name: 'LinkedIn API Key', is_active: true },
      { id: 'key-2', user_id: mockUserId, api_key: generateMockKey(1), service: 'ytdlp', key_name: 'YouTube API Key', is_active: true },
      { id: 'key-3', user_id: mockUserId, api_key: generateMockKey(2), service: 'instagram', key_name: 'Instagram API Key', is_active: true },
      { id: 'key-4', user_id: mockUserId, api_key: generateMockKey(3), service: 'enrichment', key_name: 'Email Enrichment API Key', is_active: true },
      { id: 'key-5', user_id: mockUserId, api_key: generateMockKey(4), service: 'all', key_name: 'Master API Key', is_active: true }
    ];

    const setupSuccessfulGeneration = () => {
      let callCount = 0;
      crypto.randomBytes.mockImplementation(() => ({
        toString: jest.fn().mockReturnValue('a'.repeat(64))
      }));

      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Count check - no existing keys
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 0, error: null })
            })
          };
        } else {
          // Insert keys
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({ data: mockGeneratedKeys, error: null })
            })
          };
        }
      });
    };

    it('should generate exactly 5 API keys', async () => {
      setupSuccessfulGeneration();

      const result = await apiKeyService.generateAPIKeys(mockUserId);

      expect(result.success).toBe(true);
      expect(result.api_keys).toHaveLength(5);
    });

    it('should generate keys for all services (linkedin, ytdlp, instagram, enrichment, all)', async () => {
      setupSuccessfulGeneration();

      const result = await apiKeyService.generateAPIKeys(mockUserId);

      const services = result.api_keys.map(key => key.service);
      expect(services).toContain('linkedin');
      expect(services).toContain('ytdlp');
      expect(services).toContain('instagram');
      expect(services).toContain('enrichment');
      expect(services).toContain('all');
    });

    it('should generate 64-character hex strings', async () => {
      setupSuccessfulGeneration();

      const result = await apiKeyService.generateAPIKeys(mockUserId);

      result.api_keys.forEach(key => {
        expect(key.api_key).toHaveLength(64);
        expect(key.api_key).toMatch(/^[a-f0-9]+$/);
      });
    });

    it('should call crypto.randomBytes for each key', async () => {
      setupSuccessfulGeneration();

      await apiKeyService.generateAPIKeys(mockUserId);

      // Should be called 5 times, once for each service
      expect(crypto.randomBytes).toHaveBeenCalledTimes(5);
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should throw error if keys already exist for user', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ count: 5, error: null })
        })
      });

      await expect(apiKeyService.generateAPIKeys(mockUserId)).rejects.toThrow(
        'API keys already exist for this user'
      );
    });

    it('should throw error on database error during count check', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            count: null,
            error: { message: 'Database error' }
          })
        })
      });

      await expect(apiKeyService.generateAPIKeys(mockUserId)).rejects.toThrow(
        'Failed to check existing API keys'
      );
    });

    it('should throw error on database error during insert', async () => {
      let callCount = 0;
      crypto.randomBytes.mockImplementation(() => ({
        toString: jest.fn().mockReturnValue('a'.repeat(64))
      }));

      supabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ count: 0, error: null })
            })
          };
        } else {
          return {
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Insert failed' }
              })
            })
          };
        }
      });

      await expect(apiKeyService.generateAPIKeys(mockUserId)).rejects.toThrow(
        'Failed to generate API keys'
      );
    });

    it('should set is_active to true for all keys', async () => {
      setupSuccessfulGeneration();

      const result = await apiKeyService.generateAPIKeys(mockUserId);

      result.api_keys.forEach(key => {
        expect(key.is_active).toBe(true);
      });
    });

    it('should set correct key_name for each service', async () => {
      setupSuccessfulGeneration();

      const result = await apiKeyService.generateAPIKeys(mockUserId);

      const keyNames = {
        'linkedin': 'LinkedIn API Key',
        'ytdlp': 'YouTube API Key',
        'instagram': 'Instagram API Key',
        'enrichment': 'Email Enrichment API Key',
        'all': 'Master API Key'
      };

      result.api_keys.forEach(key => {
        expect(key.key_name).toBe(keyNames[key.service]);
      });
    });
  });

  // ============================================================================
  // getAPIKeys Tests
  // ============================================================================
  describe('getAPIKeys', () => {
    const mockUserId = 'test-user-uuid-123';

    const mockAPIKeys = [
      {
        id: 'key-1',
        service: 'all',
        key_name: 'Master API Key',
        api_key: 'a'.repeat(64),
        is_active: true,
        last_used_at: null,
        created_at: '2026-02-15T10:00:00Z'
      },
      {
        id: 'key-2',
        service: 'enrichment',
        key_name: 'Email Enrichment API Key',
        api_key: 'b'.repeat(64),
        is_active: true,
        last_used_at: null,
        created_at: '2026-02-15T10:00:00Z'
      },
      {
        id: 'key-3',
        service: 'instagram',
        key_name: 'Instagram API Key',
        api_key: 'c'.repeat(64),
        is_active: true,
        last_used_at: null,
        created_at: '2026-02-15T10:00:00Z'
      },
      {
        id: 'key-4',
        service: 'linkedin',
        key_name: 'LinkedIn API Key',
        api_key: 'd'.repeat(64),
        is_active: true,
        last_used_at: '2026-02-16T09:15:00Z',
        created_at: '2026-02-15T10:00:00Z'
      },
      {
        id: 'key-5',
        service: 'ytdlp',
        key_name: 'YouTube API Key',
        api_key: 'e'.repeat(64),
        is_active: true,
        last_used_at: null,
        created_at: '2026-02-15T10:00:00Z'
      }
    ];

    it('should return all API keys for user', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockAPIKeys, error: null })
          })
        })
      });

      const result = await apiKeyService.getAPIKeys(mockUserId);

      expect(result.success).toBe(true);
      expect(result.api_keys).toHaveLength(5);
    });

    it('should return keys ordered by service', async () => {
      // Pre-sorted by service alphabetically
      const sortedKeys = [...mockAPIKeys].sort((a, b) => a.service.localeCompare(b.service));

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: sortedKeys, error: null })
          })
        })
      });

      const result = await apiKeyService.getAPIKeys(mockUserId);

      // Verify order call was made
      expect(supabase.from().select().eq().order).toHaveBeenCalledWith('service');
    });

    it('should return empty array for non-activated user with no keys', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (callCount === 1) {
          // API keys query - empty result
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

      const result = await apiKeyService.getAPIKeys(mockUserId);

      expect(result.success).toBe(true);
      expect(result.api_keys).toEqual([]);
    });

    it('should throw error for activated user with no keys (error state)', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (callCount === 1) {
          // API keys query - empty result
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          };
        } else {
          // User activation check - activated
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

      await expect(apiKeyService.getAPIKeys(mockUserId)).rejects.toThrow(
        'No API keys found. Keys should have been generated during activation.'
      );
    });

    it('should include all key fields (id, service, key_name, api_key, is_active, etc.)', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: mockAPIKeys, error: null })
          })
        })
      });

      const result = await apiKeyService.getAPIKeys(mockUserId);

      result.api_keys.forEach(key => {
        expect(key).toHaveProperty('id');
        expect(key).toHaveProperty('service');
        expect(key).toHaveProperty('key_name');
        expect(key).toHaveProperty('api_key');
        expect(key).toHaveProperty('is_active');
        expect(key).toHaveProperty('last_used_at');
        expect(key).toHaveProperty('created_at');
      });
    });

    it('should throw error on database error during key fetch', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });

      await expect(apiKeyService.getAPIKeys(mockUserId)).rejects.toThrow(
        'Failed to retrieve API keys'
      );
    });

    it('should throw error on database error during user status check', async () => {
      let callCount = 0;
      supabase.from.mockImplementation((table) => {
        callCount++;
        if (callCount === 1) {
          // API keys query - empty result
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                order: jest.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          };
        } else {
          // User activation check - database error
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' }
                })
              })
            })
          };
        }
      });

      await expect(apiKeyService.getAPIKeys(mockUserId)).rejects.toThrow(
        'Failed to verify user status'
      );
    });
  });

  // ============================================================================
  // SERVICES constant Tests
  // ============================================================================
  describe('SERVICES constant', () => {
    it('should export SERVICES constant with 5 services', () => {
      expect(apiKeyService.SERVICES).toBeDefined();
      expect(apiKeyService.SERVICES).toHaveLength(5);
    });

    it('should include correct service definitions', () => {
      const services = apiKeyService.SERVICES;

      expect(services).toContainEqual({ service: 'linkedin', key_name: 'LinkedIn API Key' });
      expect(services).toContainEqual({ service: 'ytdlp', key_name: 'YouTube API Key' });
      expect(services).toContainEqual({ service: 'instagram', key_name: 'Instagram API Key' });
      expect(services).toContainEqual({ service: 'enrichment', key_name: 'Email Enrichment API Key' });
      expect(services).toContainEqual({ service: 'all', key_name: 'Master API Key' });
    });
  });
});
