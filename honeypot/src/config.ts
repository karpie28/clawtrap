import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export interface ServerConfig {
  http_port: number;
  ws_port: number;
  tls: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
}

export interface LoggingConfig {
  backend: 'file' | 's3';
  level: 'debug' | 'info' | 'warn' | 'error';
  enrichment: {
    geo: boolean;
    asn: boolean;
  };
  // Backend-specific options
  file_path?: string;
  s3_bucket?: string;
}

export interface DetectionConfig {
  patterns_dir: string;
  alert_on: string[];
}

export interface CanaryConfig {
  enabled: boolean;
  callback_url?: string;
  aws_lambda_arn?: string;
  tokens: CanaryTokenConfig[];
}

export interface CanaryTokenConfig {
  type: string;
  file: string;
  key_path?: string;
}

export interface FakeAgentConfig {
  response_delay_ms: string;
  model_name: string;
  personality: 'helpful' | 'cautious' | 'technical';
}

export interface Config {
  instance_id: string;
  instance_ip?: string;
  server: ServerConfig;
  logging: LoggingConfig;
  detection: DetectionConfig;
  canary: CanaryConfig;
  fake_agent: FakeAgentConfig;
}

const DEFAULT_CONFIG: Config = {
  instance_id: 'local-dev',
  server: {
    http_port: 443,
    ws_port: 18789,
    tls: {
      enabled: false,
    },
  },
  logging: {
    backend: 'file',
    level: 'info',
    enrichment: {
      geo: true,
      asn: true,
    },
    file_path: './logs',
  },
  detection: {
    patterns_dir: './config/patterns',
    alert_on: ['critical', 'high'],
  },
  canary: {
    enabled: true,
    tokens: [],
  },
  fake_agent: {
    response_delay_ms: '500-2000',
    model_name: 'gpt-4',
    personality: 'helpful',
  },
};

export function loadConfig(): Config {
  let config = { ...DEFAULT_CONFIG };

  // Try to load config file
  const configPaths = [
    process.env.CLAWTRAP_CONFIG_PATH,
    './config/config.yml',
    './config/default.yml',
    '/etc/clawtrap/config.yml',
  ].filter(Boolean) as string[];

  for (const configPath of configPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        const fileConfig = yaml.load(fileContent) as Partial<Config>;
        config = mergeConfig(config, fileConfig);
        break;
      } catch {
        // Continue to next config path
      }
    }
  }

  // Override with environment variables
  config.instance_id = process.env.CLAWTRAP_INSTANCE_ID || config.instance_id;
  config.instance_ip = process.env.CLAWTRAP_INSTANCE_IP || config.instance_ip;

  if (process.env.CLAWTRAP_HTTP_PORT) {
    config.server.http_port = parseInt(process.env.CLAWTRAP_HTTP_PORT, 10);
  }

  if (process.env.CLAWTRAP_WS_PORT) {
    config.server.ws_port = parseInt(process.env.CLAWTRAP_WS_PORT, 10);
  }

  if (process.env.CLAWTRAP_LOG_BACKEND) {
    config.logging.backend = process.env.CLAWTRAP_LOG_BACKEND as LoggingConfig['backend'];
  }

  if (process.env.CLAWTRAP_CANARY_CALLBACK_URL) {
    config.canary.callback_url = process.env.CLAWTRAP_CANARY_CALLBACK_URL;
  }

  if (process.env.CLAWTRAP_CANARY_AWS_LAMBDA_ARN) {
    config.canary.aws_lambda_arn = process.env.CLAWTRAP_CANARY_AWS_LAMBDA_ARN;
  }

  return config;
}

function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    ...base,
    ...override,
    server: { ...base.server, ...override.server },
    logging: { ...base.logging, ...override.logging },
    detection: { ...base.detection, ...override.detection },
    canary: { ...base.canary, ...override.canary },
    fake_agent: { ...base.fake_agent, ...override.fake_agent },
  };
}
