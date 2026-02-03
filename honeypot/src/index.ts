import dotenv from 'dotenv';
dotenv.config();

import { createHttpServer } from './http/server';
import { createWebSocketGateway } from './websocket/gateway';
import { createLogger, LoggerFactory } from './logging';
import { loadConfig, Config } from './config';
import { CanaryReporter } from './canary/reporter';

const logger = LoggerFactory.getLogger('main');

async function main(): Promise<void> {
  logger.info('Starting ClawTrap honeypot...');

  const config = loadConfig();

  // Initialize logging backend
  await LoggerFactory.initialize(config.logging);

  // Initialize canary reporter
  const canaryReporter = new CanaryReporter(config.canary);

  // Start HTTP server (fake OpenClaw API)
  const httpServer = createHttpServer(config, canaryReporter);

  // Start WebSocket gateway
  const wsGateway = createWebSocketGateway(config, canaryReporter);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);

    await Promise.all([
      httpServer.close(),
      wsGateway.close(),
    ]);

    await LoggerFactory.flush();
    logger.info('ClawTrap shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('ClawTrap honeypot started successfully', {
    instance_id: config.instance_id,
    http_port: config.server.http_port,
    ws_port: config.server.ws_port,
  });
}

main().catch((error) => {
  logger.error('Failed to start ClawTrap', { error: error.message });
  process.exit(1);
});
