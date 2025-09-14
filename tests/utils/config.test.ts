import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { loadConfig, validateEnvironment } from '@/utils/config';

describe('Config Utils', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    test('should load config with default values', () => {
      // Clear env vars to test defaults
      delete process.env.LOG_LEVEL;

      const config = loadConfig();

      expect(config.autoHeresyDetectionChance).toBe(0.2);
      expect(config.maxDailyEmbeddings).toBe(1000);
      expect(config.sqlitePath).toBe('./database/vector-store.sqlite');
      expect(config.documentsPath).toBe('./database/wh40k-documents');
      expect(config.logLevel).toBe('info');
      expect(config.steamOffersCheckInterval).toBe(3);
      expect(config.minDiscountPercent).toBe(10);
    });

    test('should use environment variables when provided', () => {
      process.env.AUTO_HERESY_DETECTION_CHANCE = '0.5';
      process.env.MAX_DAILY_EMBEDDINGS = '2000';
      process.env.SQLITE_PATH = './custom/path.sqlite';
      process.env.DOCUMENTS_PATH = './custom/documents';
      process.env.LOG_LEVEL = 'debug';
      process.env.STEAM_OFFERS_CHANNEL_ID = '12345';
      process.env.STEAM_OFFERS_CHECK_INTERVAL = '6';
      process.env.MIN_DISCOUNT_PERCENT = '25';
      process.env.SERMON_CHANNEL_ID = '67890';

      const config = loadConfig();

      expect(config.autoHeresyDetectionChance).toBe(0.5);
      expect(config.maxDailyEmbeddings).toBe(2000);
      expect(config.sqlitePath).toBe('./custom/path.sqlite');
      expect(config.documentsPath).toBe('./custom/documents');
      expect(config.logLevel).toBe('debug');
      expect(config.steamOffersChannelId).toBe('12345');
      expect(config.steamOffersCheckInterval).toBe(6);
      expect(config.minDiscountPercent).toBe(25);
      expect(config.sermonChannelId).toBe('67890');
    });

    test('should handle invalid numeric environment variables', () => {
      process.env.AUTO_HERESY_DETECTION_CHANCE = 'invalid';
      process.env.MAX_DAILY_EMBEDDINGS = 'not-a-number';
      process.env.STEAM_OFFERS_CHECK_INTERVAL = 'abc';
      process.env.MIN_DISCOUNT_PERCENT = 'xyz';

      const config = loadConfig();

      expect(config.autoHeresyDetectionChance).toBeNaN();
      expect(config.maxDailyEmbeddings).toBeNaN();
      expect(config.steamOffersCheckInterval).toBeNaN();
      expect(config.minDiscountPercent).toBeNaN();
    });

    test('should handle undefined channel IDs', () => {
      delete process.env.STEAM_OFFERS_CHANNEL_ID;
      delete process.env.SERMON_CHANNEL_ID;

      const config = loadConfig();

      expect(config.steamOffersChannelId).toBeUndefined();
      expect(config.sermonChannelId).toBeUndefined();
    });
  });

  describe('validateEnvironment', () => {
    test('should pass when required environment variables are set', () => {
      process.env.DISCORD_TOKEN = 'test-token';
      process.env.OPENAI_API_KEY = 'test-api-key';

      expect(() => validateEnvironment()).not.toThrow();
    });

    test('should throw when DISCORD_TOKEN is missing', () => {
      delete process.env.DISCORD_TOKEN;
      process.env.OPENAI_API_KEY = 'test-api-key';

      expect(() => validateEnvironment()).toThrow('Missing required environment variable: DISCORD_TOKEN');
    });

    test('should throw when OPENAI_API_KEY is missing', () => {
      process.env.DISCORD_TOKEN = 'test-token';
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironment()).toThrow('Missing required environment variable: OPENAI_API_KEY');
    });

    test('should throw when both required variables are missing', () => {
      delete process.env.DISCORD_TOKEN;
      delete process.env.OPENAI_API_KEY;

      expect(() => validateEnvironment()).toThrow('Missing required environment variable: DISCORD_TOKEN');
    });

    test('should handle empty string environment variables as missing', () => {
      process.env.DISCORD_TOKEN = '';
      process.env.OPENAI_API_KEY = 'test-api-key';

      expect(() => validateEnvironment()).toThrow('Missing required environment variable: DISCORD_TOKEN');
    });
  });
});