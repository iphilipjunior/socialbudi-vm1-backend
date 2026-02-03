/**
 * SocialBudi - Supabase Client Module
 * 
 * Initializes and exports the Supabase client using the Service Role Key.
 * Service Role Key bypasses RLS - only use in backend server code.
 * 
 * Usage: const supabase = require('../config/supabase');
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('./env');

// --- Initialize Supabase Client ---
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY, {
  auth: {
    // Disable auth persistence - we manage auth ourselves via JWT
    persistSession: false,
    autoRefreshToken: false
  },
  // Realtime disabled - not needed for backend API operations
  realtime: {
    enabled: false
  }
});

// --- Log Connection Status ---
console.log('[Supabase] Client initialized');
console.log('[Supabase] URL:', config.SUPABASE_URL);
console.log('[Supabase] Role: service_role (bypasses RLS)');

module.exports = supabase;
