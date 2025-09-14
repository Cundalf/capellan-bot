import { expect, test, describe, beforeAll, afterAll, spyOn, mock } from 'bun:test';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { Logger } from '@/utils/logger';
import type { BotConfig } from '@/types';

describe('Logger', () => {
  const testLogDir = './test-logs';
  const testLogFile = `${testLogDir}/bot.log`;

  const mockConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: './database/test-vector-store.sqlite',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeAll(async () => {
    if (existsSync(testLogDir)) {
      await rm(testLogDir, { recursive: true });
    }
  });

  afterAll(async () => {
    if (existsSync(testLogDir)) {
      await rm(testLogDir, { recursive: true });
    }
  });

  test('should create logger with correct config', () => {
    const logger = new Logger(mockConfig);
    expect(logger).toBeDefined();
  });

  test('should respect log level filtering - debug level', () => {
    const debugConfig = { ...mockConfig, logLevel: 'debug' as const };
    const logger = new Logger(debugConfig);

    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.debug('test debug message');
    logger.info('test info message');
    logger.warn('test warn message');
    logger.error('test error message');

    expect(consoleSpy).toHaveBeenCalledTimes(4);
    consoleSpy.mockRestore();
  });

  test('should respect log level filtering - warn level', () => {
    const warnConfig = { ...mockConfig, logLevel: 'warn' as const };
    const logger = new Logger(warnConfig);

    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.debug('test debug message');
    logger.info('test info message');
    logger.warn('test warn message');
    logger.error('test error message');

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });

  test('should log with correct format', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.info('test message');

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INFO] test message')
    );
    consoleSpy.mockRestore();
  });

  test('should log with context', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    const context = { userId: '123', action: 'test' };
    logger.info('test message', context);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[INFO\] test message.*"userId":"123".*"action":"test"/)
    );
    consoleSpy.mockRestore();
  });

  test('should use correct colors for different levels', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    // Only test messages that will be logged at info level
    logger.info('info message');
    logger.warn('warn message');
    logger.error('error message');

    const calls = consoleSpy.mock.calls;

    expect(calls[0][0]).toContain('\x1b[32m'); // green for info
    expect(calls[1][0]).toContain('\x1b[33m'); // yellow for warn
    expect(calls[2][0]).toContain('\x1b[31m'); // red for error

    consoleSpy.mockRestore();
  });

  test('capellan method should add emoji and use info level', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.capellan('El Emperador protege');

    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('\x1b[32m'); // green color for info
    expect(call).toContain('🕊️ El Emperador protege');
    consoleSpy.mockRestore();
  });

  test('heresy method should add warning and use warn level', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.heresy('Caos detectado');

    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('\x1b[33m'); // yellow color for warn
    expect(call).toContain('⚡ HEREJÍA DETECTADA: Caos detectado');
    consoleSpy.mockRestore();
  });

  test('inquisitor method should add emoji and use info level', () => {
    const logger = new Logger(mockConfig);
    const consoleSpy = spyOn(console, 'log').mockImplementation(() => {});

    logger.inquisitor('Investigación iniciada');

    const call = consoleSpy.mock.calls[0][0];
    expect(call).toContain('\x1b[32m'); // green color for info
    expect(call).toContain('👁️ INQUISIDOR: Investigación iniciada');
    consoleSpy.mockRestore();
  });
});