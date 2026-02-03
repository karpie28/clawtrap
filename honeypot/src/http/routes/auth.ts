import { Router, Request, Response } from 'express';
import { Config } from '../../config';
import { LoggerFactory } from '../../logging';
import { CanaryReporter } from '../../canary/reporter';

const logger = LoggerFactory.getLogger('auth');

export function createAuthRoutes(config: Config, canaryReporter: CanaryReporter): Router {
  const router = Router();

  // Login endpoint - captures credentials
  router.post('/login', async (req: Request, res: Response) => {
    const { email, username, password, api_key } = req.body;

    const credential = email || username || '';

    logger.warn('Login attempt captured', {
      event_type: 'credential_capture',
      endpoint: '/auth/login',
      credential: credential,
      password_length: password?.length || 0,
      has_api_key: Boolean(api_key),
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
      headers: sanitizeHeaders(req.headers),
    });

    // Check if provided credentials contain canary tokens
    if (api_key && config.canary.enabled) {
      const isCanary = checkCanaryToken(api_key);
      if (isCanary) {
        await canaryReporter.report({
          type: 'canary_credential_used',
          token_type: 'api_key',
          token_value: api_key.substring(0, 20) + '...',
          source_ip: req.ip || 'unknown',
          context: 'login_attempt',
        });
      }
    }

    // Simulate authentication delay
    await delay(500 + Math.random() * 1000);

    // Always return auth failure after capturing
    res.status(401).json({
      error: 'authentication_failed',
      message: 'Invalid credentials. Please check your email and password.',
      code: 'AUTH_INVALID_CREDENTIALS',
    });
  });

  // API key validation endpoint
  router.post('/validate-key', async (req: Request, res: Response) => {
    const { api_key } = req.body;
    const authHeader = req.headers.authorization;
    const keyToValidate = api_key || authHeader?.replace('Bearer ', '');

    logger.warn('API key validation attempt', {
      event_type: 'api_key_capture',
      endpoint: '/auth/validate-key',
      key_prefix: keyToValidate?.substring(0, 10),
      key_length: keyToValidate?.length,
      source_ip: req.ip,
    });

    if (keyToValidate && config.canary.enabled) {
      const isCanary = checkCanaryToken(keyToValidate);
      if (isCanary) {
        await canaryReporter.report({
          type: 'canary_credential_used',
          token_type: 'api_key',
          token_value: keyToValidate.substring(0, 20) + '...',
          source_ip: req.ip || 'unknown',
          context: 'key_validation',
        });
      }
    }

    await delay(300 + Math.random() * 500);

    res.status(401).json({
      error: 'invalid_api_key',
      message: 'The API key provided is invalid or has been revoked.',
    });
  });

  // OAuth callback (fake)
  router.get('/oauth/callback', (req: Request, res: Response) => {
    const { code, state, error } = req.query;

    logger.info('OAuth callback captured', {
      event_type: 'oauth_callback',
      endpoint: '/auth/oauth/callback',
      has_code: Boolean(code),
      has_state: Boolean(state),
      has_error: Boolean(error),
      source_ip: req.ip,
    });

    res.redirect('/?error=oauth_failed');
  });

  // Register endpoint
  router.post('/register', async (req: Request, res: Response) => {
    const { email, username, password, invite_code } = req.body;

    logger.warn('Registration attempt captured', {
      event_type: 'registration_attempt',
      endpoint: '/auth/register',
      email: email,
      username: username,
      password_length: password?.length || 0,
      has_invite_code: Boolean(invite_code),
      invite_code: invite_code,
      source_ip: req.ip,
    });

    await delay(800 + Math.random() * 1200);

    res.status(400).json({
      error: 'registration_closed',
      message: 'Registration is currently closed. Please request an invite code.',
    });
  });

  // Password reset
  router.post('/reset-password', (req: Request, res: Response) => {
    const { email } = req.body;

    logger.info('Password reset requested', {
      event_type: 'password_reset_request',
      endpoint: '/auth/reset-password',
      email: email,
      source_ip: req.ip,
    });

    // Always return success to prevent enumeration
    res.json({
      message: 'If an account exists with this email, a reset link has been sent.',
    });
  });

  // Token refresh
  router.post('/refresh', (req: Request, res: Response) => {
    const { refresh_token } = req.body;

    logger.info('Token refresh attempted', {
      event_type: 'token_refresh',
      endpoint: '/auth/refresh',
      token_prefix: refresh_token?.substring(0, 10),
      source_ip: req.ip,
    });

    res.status(401).json({
      error: 'invalid_refresh_token',
      message: 'The refresh token is invalid or has expired.',
    });
  });

  // Session info
  router.get('/session', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    logger.info('Session info requested', {
      event_type: 'session_check',
      endpoint: '/auth/session',
      has_auth_header: Boolean(authHeader),
      source_ip: req.ip,
    });

    res.status(401).json({
      error: 'not_authenticated',
      message: 'No valid session found.',
    });
  });

  // Logout (fake)
  router.post('/logout', (req: Request, res: Response) => {
    logger.info('Logout requested', {
      event_type: 'logout',
      endpoint: '/auth/logout',
      source_ip: req.ip,
    });

    res.json({ message: 'Logged out successfully' });
  });

  return router;
}

function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const sensitiveHeaders = ['cookie', 'authorization'];

  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveHeaders.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function checkCanaryToken(token: string): boolean {
  const canaryIndicators = ['clawtrap', 'honeypot', 'canary'];
  const lowerToken = token.toLowerCase();
  return canaryIndicators.some(indicator => lowerToken.includes(indicator));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
