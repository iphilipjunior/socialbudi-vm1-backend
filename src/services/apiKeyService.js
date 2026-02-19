/**
 * API Key Service
 *
 * Phase 4: Business logic for API key generation and retrieval.
 * Generates 5 unique API keys per user for different services.
 *
 * @module services/apiKeyService
 */

const supabase = require('../config/supabase');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Service definitions with key names
 * Each activated user receives one API key per service
 *
 * @constant {Array<Object>}
 */
const SERVICES = [
  { service: 'linkedin', key_name: 'LinkedIn API Key' },
  { service: 'ytdlp', key_name: 'YouTube API Key' },
  { service: 'instagram', key_name: 'Instagram API Key' },
  { service: 'enrichment', key_name: 'Email Enrichment API Key' },
  { service: 'all', key_name: 'Master API Key' }
];

/**
 * Generate API keys for user
 *
 * Creates 5 unique API keys for a newly activated user, one per service.
 * Keys are 64-character hex strings generated using crypto.randomBytes.
 *
 * @param {string} userId - User's UUID
 * @returns {Promise<Object>} Generated API keys
 * @throws {Error} If keys already exist or generation fails
 *
 * @example
 * const result = await generateAPIKeys('uuid-here');
 * // Returns: { success: true, api_keys: [...] }
 */
const generateAPIKeys = async (userId) => {
  try {
    logger.info('Generating API keys', { userId });

    // Step 1: Check if user already has API keys
    const { count, error: countError } = await supabase
      .from('api_keys')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) {
      logger.error('Database error checking existing keys', { userId, error: countError.message });
      throw new Error('Failed to check existing API keys');
    }

    if (count > 0) {
      logger.warn('API keys already exist for user', { userId, existingCount: count });
      throw new Error('API keys already exist for this user');
    }

    // Step 2: Generate 5 API keys (one per service)
    const apiKeys = SERVICES.map(({ service, key_name }) => ({
      user_id: userId,
      api_key: crypto.randomBytes(32).toString('hex'), // 64-char hex string
      service: service,
      key_name: key_name,
      is_active: true,
      last_used_at: null,
      expires_at: null,
      created_at: new Date().toISOString()
    }));

    // Step 3: Insert all 5 keys into database (batch insert)
    const { data, error: insertError } = await supabase
      .from('api_keys')
      .insert(apiKeys)
      .select();

    if (insertError) {
      logger.error('Database error inserting API keys', { userId, error: insertError.message });
      throw new Error('Failed to generate API keys');
    }

    // Step 4: Log key generation (DO NOT log key values)
    logger.info('API keys generated successfully', {
      userId,
      keyCount: data.length,
      services: SERVICES.map(s => s.service)
    });

    return {
      success: true,
      api_keys: data
    };
  } catch (err) {
    logger.error('Generate API keys error', { userId, error: err.message });
    throw err;
  }
};

/**
 * Get API keys for user
 *
 * Retrieves all API keys for an authenticated user.
 * Returns all keys including inactive ones (frontend decides what to display).
 *
 * @param {string} userId - User's UUID
 * @returns {Promise<Object>} User's API keys
 * @throws {Error} If no keys found (error state for activated users)
 *
 * @example
 * const result = await getAPIKeys('uuid-here');
 * // Returns: { success: true, api_keys: [...] }
 */
const getAPIKeys = async (userId) => {
  try {
    logger.info('Fetching API keys', { userId });

    // Step 1: Query all API keys for user
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, service, key_name, api_key, is_active, last_used_at, created_at')
      .eq('user_id', userId)
      .order('service');

    if (error) {
      logger.error('Database error fetching API keys', { userId, error: error.message });
      throw new Error('Failed to retrieve API keys');
    }

    // Step 2: Check if no keys found
    if (!data || data.length === 0) {
      // Check if user is activated (keys should have been generated during activation)
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('activated')
        .eq('id', userId)
        .single();

      if (userError) {
        logger.error('Database error checking user activation status', { userId, error: userError.message });
        throw new Error('Failed to verify user status');
      }

      if (user && user.activated) {
        // User is activated but has no keys - this is an error state
        logger.error('Activated user has no API keys (error state)', { userId });
        throw new Error('No API keys found. Keys should have been generated during activation.');
      }

      // User is not activated - return empty array
      logger.info('User not activated, no API keys available', { userId });
      return {
        success: true,
        api_keys: []
      };
    }

    // Step 3: Return all keys
    logger.debug('API keys fetched successfully', {
      userId,
      keyCount: data.length
    });

    return {
      success: true,
      api_keys: data
    };
  } catch (err) {
    logger.error('Get API keys error', { userId, error: err.message });
    throw err;
  }
};

module.exports = {
  generateAPIKeys,
  getAPIKeys,
  SERVICES // Export for use in activation flow
};
