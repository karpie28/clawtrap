import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

import { Config } from '../config';
import { createApiRoutes } from './routes/api';
import { createAuthRoutes } from './routes/auth';
import { createUiRoutes } from './routes/ui';
import { createLoggerMiddleware } from './middleware/logger';
import { LoggerFactory } from '../logging';
import { CanaryReporter } from '../canary/reporter';

const logger = LoggerFactory.getLogger('http');

export interface HttpServer {
  close: () => Promise<void>;
}

export function createHttpServer(config: Config, canaryReporter: CanaryReporter): HttpServer {
  const app: Application = express();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled to look like a real app
    hsts: config.server.tls.enabled,
  }));

  app.use(cors({
    origin: '*', // Intentionally permissive for honeypot
    credentials: true,
  }));

  app.use(compression());

  // Rate limiting (intentionally generous for honeypot)
  app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Logging middleware - captures all requests
  app.use(createLoggerMiddleware(config));

  // Static files (fake OpenClaw UI)
  app.use(express.static(path.join(__dirname, 'static')));

  // API routes
  app.use('/api/v1', createApiRoutes(config, canaryReporter));
  app.use('/auth', createAuthRoutes(config, canaryReporter));
  app.use('/', createUiRoutes(config));

  // Health check (useful but also a fingerprint)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'healthy', service: 'openclaw-api' });
  });

  // 404 handler - log as potential reconnaissance
  app.use((req: Request, res: Response) => {
    logger.info('404 Not Found - potential reconnaissance', {
      event_type: 'http_404',
      path: req.path,
      method: req.method,
      source_ip: req.ip,
      user_agent: req.headers['user-agent'],
    });

    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist',
    });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', {
      event_type: 'http_error',
      error: err.message,
      path: req.path,
      method: req.method,
      source_ip: req.ip,
    });

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  // Create server
  let server: http.Server | https.Server;

  if (config.server.tls.enabled && config.server.tls.cert && config.server.tls.key) {
    const tlsOptions = {
      cert: fs.readFileSync(config.server.tls.cert),
      key: fs.readFileSync(config.server.tls.key),
    };
    server = https.createServer(tlsOptions, app);
  } else {
    server = http.createServer(app);
  }

  const port = config.server.http_port;
  server.listen(port, () => {
    logger.info(`HTTP server listening on port ${port}`, {
      tls: config.server.tls.enabled,
    });
  });

  return {
    close: () => new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    }),
  };
}
