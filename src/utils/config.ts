import type { BotConfig } from '@/types';

export function loadConfig(): BotConfig {
  return {
    autoHeresyDetectionChance: parseFloat(process.env.AUTO_HERESY_DETECTION_CHANCE || '0.2'),
    maxDailyEmbeddings: parseInt(process.env.MAX_DAILY_EMBEDDINGS || '1000'),
    sqlitePath: process.env.SQLITE_PATH || './database/vector-store.sqlite',
    documentsPath: process.env.DOCUMENTS_PATH || './database/wh40k-documents',
    logLevel: (process.env.LOG_LEVEL as BotConfig['logLevel']) || 'info'
  };
}

export function validateEnvironment(): void {
  const required = ['DISCORD_TOKEN', 'OPENAI_API_KEY'];
  
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}