/**
 * Authentication Controller
 *
 * Handles user signup, login, account activation, and token management.
 *
 * @module controllers/authController
 */

const supabase = require('../config/supabase');
const { hashPassword, comparePassword } = require('../utils/passwordUtils');
const { generateToken, verifyToken: verifyJWT, decodeToken } = require('../services/jwtService');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Generate API key
 * @returns {string} API key in format: sk_live_{service}_{random}
 */
const generateApiKey = () => {
  return `sk_live_${crypto.randomBytes(24).toString('hex')}`;
};

/**
 * Signup - Create new user account
 *
 * Creates user with pending payment status.
 * Password is hashed before storage.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - User's full name
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.password - User's password (plain text)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with success status
 */
const signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already exists
    const { data: existingUser, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (lookupError && lookupError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is expected for new users
      logger.error('Error checking for existing user:', { error: lookupError });
      throw new Error('Database error during signup');
    }

    if (existingUser) {
      logger.warn('Signup attempt with existing email', { email: normalizedEmail });
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        message: 'An account with this email already exists'
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Insert new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        full_name: name.trim(),
        email: normalizedEmail,
        password_hash: hashedPassword,
        payment_status: 'pending',
        activated: false,
        is_active: true,
        is_email_verified: false,
        created_at: new Date().toISOString(),
        signup_date: new Date().toISOString()
      })
      .select('id, full_name, email, created_at')
      .single();

    if (insertError) {
      logger.error('Error inserting new user:', { error: insertError });
      throw new Error('Failed to create user account');
    }

    // Log signup event to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'auth',
      action: 'user_signup',
      message: `New user signed up: ${normalizedEmail}`
    });

    logger.info('User signup successful', {
      user_id: newUser.id,
      email: normalizedEmail
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please complete payment to activate.',
      next_action: 'open_payment_modal',
      user_id: newUser.id
    });
  } catch (err) {
    logger.error(`Error in signup: ${err.message}`, {
      stack: err.stack
    });
    next(err);
  }
};

/**
 * Login - Authenticate user and return appropriate redirect
 *
 * Checks user credentials and returns different responses based on account state:
 * - pending payment → redirect to /waiting-payment
 * - paid but not activated → redirect to /activate
 * - fully activated → return JWT token and redirect to /dashboard
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.password - User's password (plain text)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with redirect path and optionally token
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (lookupError || !user) {
      // Don't reveal whether email exists or not
      logger.warn('Login attempt with unknown email', { email: normalizedEmail });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'The email or password you entered is incorrect'
      });
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Don't reveal that it's specifically the password that's wrong
      logger.warn('Login attempt with invalid password', {
        user_id: user.id,
        email: normalizedEmail
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        message: 'The email or password you entered is incorrect'
      });
    }

    // Check account state and return appropriate response

    // State 1: Waiting for payment
    if (user.payment_status === 'pending') {
      logger.info('Login successful - payment pending', {
        user_id: user.id,
        email: normalizedEmail
      });
      return res.status(200).json({
        success: true,
        message: 'Please complete payment to activate your account',
        redirect: '/waiting-payment',
        user_id: user.id
      });
    }

    // State 2: Paid but not activated
    if (user.payment_status === 'paid' && user.activated === false) {
      logger.info('Login successful - awaiting activation', {
        user_id: user.id,
        email: normalizedEmail
      });
      return res.status(200).json({
        success: true,
        message: 'Payment received. Please activate your account.',
        redirect: '/activate',
        user_id: user.id
      });
    }

    // State 3: Fully activated - generate JWT and return dashboard redirect
    if (user.activated === true) {
      const token = generateToken({
        user_id: user.id,
        email: user.email,
        role: 'user'
      });

      // Update last_login timestamp
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      logger.info('Login successful - fully activated', {
        user_id: user.id,
        email: normalizedEmail
      });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        redirect: '/dashboard',
        token: token,
        user: {
          user_id: user.id,
          name: user.full_name,
          email: user.email,
          role: 'user'
        }
      });
    }

    // Fallback for unexpected state
    logger.error('Unexpected account state during login', {
      user_id: user.id,
      payment_status: user.payment_status,
      activated: user.activated
    });

    return res.status(500).json({
      success: false,
      error: 'Account state error',
      message: 'Please contact support'
    });
  } catch (err) {
    logger.error(`Error in login: ${err.message}`, {
      stack: err.stack
    });
    next(err);
  }
};

/**
 * Activate - Verify payment ID and activate user account
 *
 * Validates payment ID, activates the account, and generates 5 API keys
 * for different services (linkedin, ytdlp, instagram, enrichment, all).
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - User's email address
 * @param {string} req.body.payment_id - Payment ID from payment provider
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with JWT token and API keys
 */
const activate = async (req, res, next) => {
  try {
    const { email, payment_id } = req.body;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .single();

    if (lookupError || !user) {
      logger.warn('Activation attempt for unknown user', { email: normalizedEmail });
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'No account found with this email'
      });
    }

    // Check if already activated
    if (user.activated === true) {
      logger.warn('Activation attempt for already activated account', {
        user_id: user.id,
        email: normalizedEmail
      });
      return res.status(400).json({
        success: false,
        error: 'Account already activated',
        message: 'This account is already activated'
      });
    }

    // Verify Payment ID belongs to this user
if (!user.payment_id) {
  logger.warn('Activation attempt for user with no payment', {
    email: normalizedEmail
  });
  return res.status(400).json({
    success: false,
    error: 'No payment found',
    message: 'Please complete payment before activating your account'
  });
}

if (user.payment_id !== payment_id) {
  logger.warn('Activation attempt with mismatched payment ID', {
    email: normalizedEmail,
    provided: payment_id,
    expected: user.payment_id
  });
  return res.status(403).json({
    success: false,
    error: 'Invalid Payment ID',
    message: 'This Payment ID does not match your account'
  });
}

if (user.payment_status !== 'paid') {
  logger.warn('Activation attempt for unpaid user', {
    email: normalizedEmail
  });
  return res.status(400).json({
    success: false,
    error: 'Payment not confirmed',
    message: 'Your payment has not been processed yet. Please wait or contact support.'
  });
}

    // Generate 5 API keys for different services
    const apiKeys = {
      linkedin: generateApiKey(),
      ytdlp: generateApiKey(),
      instagram: generateApiKey(),
      enrichment: generateApiKey(),
      all: generateApiKey()
    };

    // Create API key records for insertion
const apiKeyRecords = Object.entries(apiKeys).map(([serviceName, key]) => ({
  user_id: user.id,
  service: serviceName,  // ← Changed from service_name to service
  api_key: key,
  key_name: serviceName,  // ← Add this field
  created_at: new Date().toISOString(),
  is_active: true
}));

    // Insert API keys
    const { error: apiKeyInsertError } = await supabase
      .from('api_keys')
      .insert(apiKeyRecords);

    if (apiKeyInsertError) {
      logger.error('Error inserting API keys:', { error: apiKeyInsertError });
      throw new Error('Failed to generate API keys');
    }

    // Update user record to activated
    // Note: payment_status and payment_id are already set by the payment webhook
    const { error: updateError } = await supabase
      .from('users')
      .update({
        activated: true,
        activated_at: new Date().toISOString(),
        payment_verified_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      logger.error('Error updating user to activated:', { error: updateError });
      throw new Error('Failed to activate account');
    }

    // Generate JWT token
    const token = generateToken({
      user_id: user.id,
      email: user.email,
      role: 'user'
    });

    // Log activation event to system_logs
    await supabase.from('system_logs').insert({
      log_level: 'info',
      service: 'auth',
      action: 'account_activation',
      message: `Account activated: ${normalizedEmail}`
    });

    logger.info('Account activation successful', {
      user_id: user.id,
      email: normalizedEmail
    });

    return res.status(200).json({
      success: true,
      message: 'Account activated successfully',
      token: token,
      api_keys: apiKeys
    });
  } catch (err) {
    logger.error(`Error in activate: ${err.message}`, {
      stack: err.stack
    });
    next(err);
  }
};

/**
 * Verify Token - Check if JWT token is valid
 *
 * Uses authMiddleware to verify token before reaching this controller.
 * If middleware passes, token is valid and user info is attached to req.user.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.user - User info from authMiddleware (user_id, email, role, iat, exp)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with token validity and user info
 */
const verifyToken = async (req, res, next) => {
  try {
    // If we reach here, authMiddleware has already verified the token
    const { user_id, email, role, exp } = req.user;

    // Calculate time until expiration
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = exp - now;

    logger.debug('Token verified', { user_id, email, expiresIn });

    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      valid: true,
      user: {
        user_id,
        email,
        role
      },
      expires_in_seconds: expiresIn
    });
  } catch (err) {
    logger.error(`Error in verifyToken: ${err.message}`, {
      stack: err.stack
    });
    next(err);
  }
};

/**
 * Refresh Token - Issue new JWT for recently expired tokens
 *
 * Allows users to refresh their token without re-logging in.
 * Only works for tokens expired within the last 7 days.
 *
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.token - The expired or expiring JWT token
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {Object} JSON response with new token
 */
const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token required',
        message: 'Please provide a token to refresh'
      });
    }

    // Decode token without verification (allows expired tokens)
    const decoded = decodeToken(token);

    if (!decoded) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }

    // Check if token expired more than 7 days ago
    const now = Math.floor(Date.now() / 1000);
    const expiredFor = now - decoded.exp;
    const sevenDays = 7 * 24 * 60 * 60;

    if (expiredFor > sevenDays) {
      return res.status(401).json({
        success: false,
        error: 'Token too old',
        message: 'This token expired more than 7 days ago. Please log in again.'
      });
    }

    // Verify user still exists and is activated
    const { data: user, error: lookupError } = await supabase
      .from('users')
      .select('id, email, activated')
      .eq('id', decoded.user_id)
      .single();

    if (lookupError || !user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        message: 'The user associated with this token no longer exists'
      });
    }

    if (user.activated !== true) {
      return res.status(403).json({
        success: false,
        error: 'Account not activated',
        message: 'Please activate your account.'
      });
    }

    // Generate new token with same payload
    const newToken = generateToken({
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role || 'user'
    });

    logger.info('Token refreshed successfully', {
      user_id: decoded.user_id,
      email: decoded.email
    });

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        user_id: user.id,
        email: user.email
      }
    });
  } catch (err) {
    logger.error(`Error in refreshToken: ${err.message}`, {
      stack: err.stack
    });
    next(err);
  }
};

module.exports = {
  signup,
  login,
  activate,
  verifyToken,
  refreshToken
};