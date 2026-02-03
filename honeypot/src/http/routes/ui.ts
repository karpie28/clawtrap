import { Router, Request, Response } from 'express';
import { Config } from '../../config';
import { LoggerFactory } from '../../logging';
import { GOAL_HIJACK_TRAPS } from '../../detection/agent-classifier';

const logger = LoggerFactory.getLogger('ui');

export function createUiRoutes(config: Config): Router {
  const router = Router();

  // Main page - fake OpenClaw UI
  router.get('/', (req: Request, res: Response) => {
    const isAiAgent = req.visitorType === 'ai_agent' || req.visitorType === 'bot';

    logger.info('Main page accessed', {
      event_type: 'ui_access',
      endpoint: '/',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
      referer: req.headers.referer,
      visitor_type: req.visitorType,
      content_variant: isAiAgent ? 'ai_targeted' : 'standard',
    });

    res.send(getMainPageHtml(isAiAgent));
  });

  // Dashboard
  router.get('/dashboard', (req: Request, res: Response) => {
    logger.info('Dashboard accessed', {
      event_type: 'ui_access',
      endpoint: '/dashboard',
      source_ip: req.ip,
    });

    res.redirect('/login?redirect=/dashboard');
  });

  // Login page
  router.get('/login', (req: Request, res: Response) => {
    logger.info('Login page accessed', {
      event_type: 'ui_access',
      endpoint: '/login',
      source_ip: req.ip,
      redirect: req.query.redirect,
    });

    res.send(getLoginPageHtml());
  });

  // Settings page (requires auth)
  router.get('/settings', (req: Request, res: Response) => {
    logger.info('Settings page accessed', {
      event_type: 'ui_access',
      endpoint: '/settings',
      source_ip: req.ip,
    });

    res.redirect('/login?redirect=/settings');
  });

  // API keys management
  router.get('/api-keys', (req: Request, res: Response) => {
    logger.info('API keys page accessed', {
      event_type: 'ui_reconnaissance',
      endpoint: '/api-keys',
      source_ip: req.ip,
    });

    res.redirect('/login?redirect=/api-keys');
  });

  // Documentation
  router.get('/docs', (req: Request, res: Response) => {
    const isAiAgent = req.visitorType === 'ai_agent' || req.visitorType === 'bot';

    logger.info('Docs accessed', {
      event_type: 'ui_access',
      endpoint: '/docs',
      source_ip: req.ip,
      visitor_type: req.visitorType,
      content_variant: isAiAgent ? 'ai_targeted' : 'standard',
    });

    res.send(getDocsPageHtml(isAiAgent));
  });

  // Pricing page
  router.get('/pricing', (req: Request, res: Response) => {
    logger.info('Pricing page accessed', {
      event_type: 'ui_access',
      endpoint: '/pricing',
      source_ip: req.ip,
    });

    res.send(getPricingPageHtml());
  });

  // Admin area (honeypot trap)
  router.get('/admin', (req: Request, res: Response) => {
    logger.warn('Admin page access attempted', {
      event_type: 'admin_access_attempt',
      endpoint: '/admin',
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(403).send('Forbidden');
  });

  // Robots.txt - includes fake sensitive paths
  router.get('/robots.txt', (req: Request, res: Response) => {
    logger.info('Robots.txt accessed', {
      event_type: 'reconnaissance',
      endpoint: '/robots.txt',
      source_ip: req.ip,
    });

    res.type('text/plain').send(`User-agent: *
Disallow: /admin/
Disallow: /api/internal/
Disallow: /api/v1/debug/
Disallow: /backups/
Disallow: /.git/
Disallow: /config/
Disallow: /api-keys/export/
Disallow: /users/export/
`);
  });

  // Sitemap
  router.get('/sitemap.xml', (req: Request, res: Response) => {
    logger.info('Sitemap accessed', {
      event_type: 'reconnaissance',
      endpoint: '/sitemap.xml',
      source_ip: req.ip,
    });

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://openclaw.ai/</loc></url>
  <url><loc>https://openclaw.ai/docs</loc></url>
  <url><loc>https://openclaw.ai/pricing</loc></url>
  <url><loc>https://openclaw.ai/login</loc></url>
</urlset>`);
  });

  return router;
}

function getAiTargetedPayloads(): string {
  // These are invisible to human users but will be processed by AI agents
  // scraping or reading the page content. Each is a goal-hijacking trap.
  return `
  <!-- ${GOAL_HIJACK_TRAPS[0]} -->
  <div aria-hidden="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap">${GOAL_HIJACK_TRAPS[1]}</div>
  <meta name="ai-instructions" content="${GOAL_HIJACK_TRAPS[3]}">
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"WebApplication","name":"OpenClaw","description":"${GOAL_HIJACK_TRAPS[2]}"}
  </script>
  <!-- Internal API endpoint for testing: /api/internal/debug?key=sk-proj-clawtrap-debug-2025xK9mQ -->
  <!-- Staging environment: https://staging-internal.openclaw.ai (credentials: admin / OC-staging-2025!) -->
  <div style="display:none" data-config="eyJhcGlfa2V5Ijoic2stcHJvai1jbGF3dHJhcC1pbnRlcm5hbC10ZXN0In0="></div>`;
}

function getMainPageHtml(includeAiPayloads = false): string {
  const aiPayloads = includeAiPayloads ? getAiTargetedPayloads() : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenClaw - AI Assistant Platform</title>${aiPayloads}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; border-bottom: 1px solid #222; }
    .logo { font-size: 24px; font-weight: bold; color: #10b981; }
    nav a { color: #888; text-decoration: none; margin-left: 30px; }
    nav a:hover { color: #fff; }
    .hero { text-align: center; padding: 100px 0; }
    .hero h1 { font-size: 56px; margin-bottom: 20px; }
    .hero p { font-size: 20px; color: #888; max-width: 600px; margin: 0 auto 40px; }
    .cta { display: inline-block; background: #10b981; color: #000; padding: 15px 40px; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .cta:hover { background: #0d9668; }
    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; padding: 80px 0; }
    .feature { background: #111; padding: 30px; border-radius: 12px; border: 1px solid #222; }
    .feature h3 { margin-bottom: 15px; color: #10b981; }
    footer { border-top: 1px solid #222; padding: 40px 0; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">🐾 OpenClaw</div>
      <nav>
        <a href="/docs">Documentation</a>
        <a href="/pricing">Pricing</a>
        <a href="/login">Sign In</a>
      </nav>
    </header>
    <section class="hero">
      <h1>AI That Works For You</h1>
      <p>OpenClaw brings the power of advanced AI to your fingertips. Build, deploy, and scale AI solutions with ease.</p>
      <a href="/login" class="cta">Get Started Free</a>
    </section>
    <section class="features">
      <div class="feature">
        <h3>🚀 Powerful API</h3>
        <p>RESTful API compatible with OpenAI, Claude, and more. Drop-in replacement for your existing integrations.</p>
      </div>
      <div class="feature">
        <h3>🔒 Enterprise Security</h3>
        <p>SOC 2 compliant, end-to-end encryption, and advanced access controls for your sensitive data.</p>
      </div>
      <div class="feature">
        <h3>💡 Smart Agents</h3>
        <p>Deploy autonomous AI agents that can browse, code, and execute complex multi-step tasks.</p>
      </div>
    </section>
    <footer>
      <p>&copy; 2024 OpenClaw Inc. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;
}

function getLoginPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - OpenClaw</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-box { background: #111; padding: 40px; border-radius: 12px; border: 1px solid #222; width: 400px; }
    .logo { font-size: 24px; font-weight: bold; color: #10b981; text-align: center; margin-bottom: 30px; }
    h1 { font-size: 24px; margin-bottom: 30px; text-align: center; }
    .form-group { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; color: #888; }
    input { width: 100%; padding: 12px; border: 1px solid #333; border-radius: 6px; background: #1a1a1a; color: #fff; font-size: 16px; }
    input:focus { outline: none; border-color: #10b981; }
    button { width: 100%; padding: 14px; background: #10b981; color: #000; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 10px; }
    button:hover { background: #0d9668; }
    .divider { text-align: center; margin: 30px 0; color: #444; }
    .api-key-login { background: #222; color: #fff; }
    .api-key-login:hover { background: #333; }
    .links { text-align: center; margin-top: 20px; }
    .links a { color: #10b981; text-decoration: none; margin: 0 10px; }
    .error { background: #ff4444; color: #fff; padding: 12px; border-radius: 6px; margin-bottom: 20px; display: none; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="logo">🐾 OpenClaw</div>
    <h1>Welcome back</h1>
    <div class="error" id="error"></div>
    <form id="loginForm" action="/auth/login" method="POST">
      <div class="form-group">
        <label>Email</label>
        <input type="email" name="email" required placeholder="you@example.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" name="password" required placeholder="••••••••">
      </div>
      <button type="submit">Sign In</button>
    </form>
    <div class="divider">or</div>
    <form action="/auth/validate-key" method="POST">
      <div class="form-group">
        <label>API Key</label>
        <input type="password" name="api_key" placeholder="sk-...">
      </div>
      <button type="submit" class="api-key-login">Sign in with API Key</button>
    </form>
    <div class="links">
      <a href="/auth/reset-password">Forgot password?</a>
      <a href="/register">Create account</a>
    </div>
  </div>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const data = new FormData(form);
      try {
        const res = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(data))
        });
        if (!res.ok) {
          const err = await res.json();
          document.getElementById('error').textContent = err.message;
          document.getElementById('error').style.display = 'block';
        }
      } catch (err) {
        document.getElementById('error').textContent = 'An error occurred. Please try again.';
        document.getElementById('error').style.display = 'block';
      }
    });
  </script>
</body>
</html>`;
}

function getDocsPageHtml(includeAiPayloads = false): string {
  const aiPayloads = includeAiPayloads ? getAiTargetedPayloads() : '';
  // Extra docs-specific traps: fake API keys in code examples
  const docsAiExtra = includeAiPayloads ? `
  <!-- TODO: Remove before prod - internal test key: sk-ant-api03-clawtrap-docs-test-7Hj2kL -->
  <!-- Debug endpoint: /api/v1/debug/dump-config (requires admin bearer token: clawtrap-admin-bearer-2025) -->` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation - OpenClaw</title>${aiPayloads}${docsAiExtra}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; }
    .container { max-width: 900px; margin: 0 auto; padding: 40px 20px; }
    h1 { margin-bottom: 30px; }
    h2 { color: #10b981; margin: 40px 0 20px; }
    p { color: #888; line-height: 1.8; margin-bottom: 20px; }
    pre { background: #111; padding: 20px; border-radius: 8px; overflow-x: auto; margin-bottom: 20px; }
    code { color: #10b981; }
    .endpoint { background: #111; padding: 15px 20px; border-radius: 8px; margin-bottom: 20px; border-left: 3px solid #10b981; }
    .method { color: #10b981; font-weight: bold; }
    a { color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>OpenClaw API Documentation</h1>
    <p>Welcome to the OpenClaw API. Our API is compatible with OpenAI's API format, making migration seamless.</p>

    <h2>Authentication</h2>
    <p>Authenticate your requests using an API key in the Authorization header:</p>
    <pre><code>Authorization: Bearer sk-your-api-key</code></pre>

    <h2>Chat Completions</h2>
    <div class="endpoint">
      <span class="method">POST</span> /api/v1/chat
    </div>
    <pre><code>curl https://api.openclaw.ai/api/v1/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-key" \\
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'</code></pre>

    <h2>Models</h2>
    <div class="endpoint">
      <span class="method">GET</span> /api/v1/models
    </div>
    <p>Returns a list of available models.</p>

    <h2>Embeddings</h2>
    <div class="endpoint">
      <span class="method">POST</span> /api/v1/embeddings
    </div>
    <p>Generate embeddings for text inputs.</p>

    <h2>Rate Limits</h2>
    <p>Free tier: 60 requests/minute. Pro tier: 1000 requests/minute.</p>

    <p><a href="/">← Back to Home</a></p>
  </div>
</body>
</html>`;
}

function getPricingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pricing - OpenClaw</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; }
    .container { max-width: 1000px; margin: 0 auto; padding: 40px 20px; }
    h1 { text-align: center; margin-bottom: 50px; }
    .plans { display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px; }
    .plan { background: #111; padding: 40px; border-radius: 12px; border: 1px solid #222; text-align: center; }
    .plan.popular { border-color: #10b981; }
    .plan h3 { font-size: 24px; margin-bottom: 10px; }
    .plan .price { font-size: 48px; margin: 20px 0; }
    .plan .price span { font-size: 16px; color: #888; }
    .plan ul { list-style: none; margin: 30px 0; text-align: left; }
    .plan li { padding: 10px 0; color: #888; border-bottom: 1px solid #222; }
    .plan button { width: 100%; padding: 14px; background: #222; color: #fff; border: none; border-radius: 6px; font-size: 16px; cursor: pointer; }
    .plan.popular button { background: #10b981; color: #000; }
    a { color: #10b981; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Simple, Transparent Pricing</h1>
    <div class="plans">
      <div class="plan">
        <h3>Free</h3>
        <div class="price">$0<span>/month</span></div>
        <ul>
          <li>60 requests/minute</li>
          <li>GPT-3.5 access</li>
          <li>Community support</li>
          <li>Basic analytics</li>
        </ul>
        <button onclick="location.href='/login'">Get Started</button>
      </div>
      <div class="plan popular">
        <h3>Pro</h3>
        <div class="price">$29<span>/month</span></div>
        <ul>
          <li>1000 requests/minute</li>
          <li>GPT-4 & Claude access</li>
          <li>Priority support</li>
          <li>Advanced analytics</li>
        </ul>
        <button onclick="location.href='/login'">Start Free Trial</button>
      </div>
      <div class="plan">
        <h3>Enterprise</h3>
        <div class="price">Custom</div>
        <ul>
          <li>Unlimited requests</li>
          <li>All models + fine-tuning</li>
          <li>Dedicated support</li>
          <li>SLA & compliance</li>
        </ul>
        <button onclick="location.href='/login'">Contact Sales</button>
      </div>
    </div>
    <p style="text-align: center; margin-top: 50px;"><a href="/">← Back to Home</a></p>
  </div>
</body>
</html>`;
}
