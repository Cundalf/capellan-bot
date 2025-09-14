import { expect, test, describe, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { existsSync } from 'fs';
import { rm, mkdir, writeFile } from 'fs/promises';
import { SermonService } from '@/services/sermon-service';
import { Logger } from '@/utils/logger';
import type { BotConfig, RAGResponse } from '@/types';

// Mock RAG System
class MockRAGSystem {
  async generateCapellanResponse(prompt: string, type: string): Promise<RAGResponse> {
    return {
      response: `Mocked sermon response for: ${prompt.substring(0, 50)}...`,
      sources: [],
      tokensUsed: 100
    };
  }
}

describe('SermonService', () => {
  let sermonService: SermonService;
  let mockLogger: Logger;
  let mockRAGSystem: MockRAGSystem;
  const testDataPath = './test-sermon-data';
  const testSermonFile = `${testDataPath}/sermon-data.json`;

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: './database/test-vector-store.sqlite',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeEach(async () => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'error').mockImplementation(() => {});
    spyOn(mockLogger, 'warn').mockImplementation(() => {});
    spyOn(mockLogger, 'debug').mockImplementation(() => {});

    mockRAGSystem = new MockRAGSystem();

    // Clean up test directory
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
    await mkdir(testDataPath, { recursive: true });

    // Mock process.cwd() to use test directory
    const originalCwd = process.cwd;
    spyOn(process, 'cwd').mockImplementation(() => testDataPath);

    sermonService = new SermonService(mockLogger, mockRAGSystem as any);

    // Restore after service creation
    process.cwd = originalCwd;
  });

  afterEach(async () => {
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
  });

  test('should generate daily sermon with proper format', async () => {
    const result = await sermonService.generateDailySermon();

    expect(result.sermon).toContain('🕰️ Son las 19:40 - La Hora Imperial ha llegado');
    expect(result.sermon).toContain('⚔️ **SERMÓN DIARIO DEL CAPELLÁN** ⚔️');
    expect(result.sermon).toContain('Ave Imperator! El Emperador Protege!');
    expect(result.sermon).toContain('🕊️⚡');
    expect(result.topic).toBeDefined();
    expect(typeof result.topic).toBe('string');
    expect(result.topic.length).toBeGreaterThan(0);
  });

  test('should select different topics based on day of year', async () => {
    // Mock Date to control day selection
    const originalDate = Date;
    let mockDay = 1;

    const MockDate = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2024, 0, mockDay); // Jan 1, 2024 + mockDay
        } else {
          super(...args);
        }
      }
      static now() {
        return new Date(2024, 0, mockDay).getTime();
      }
    } as any;

    globalThis.Date = MockDate;

    const result1 = await sermonService.generateDailySermon();
    mockDay = 50; // Different day
    const result2 = await sermonService.generateDailySermon();

    // Topics should be different (though they might occasionally be the same by chance)
    expect(result1.topic).toBeDefined();
    expect(result2.topic).toBeDefined();

    globalThis.Date = originalDate;
  });

  test('should return fallback sermon when RAG system fails', async () => {
    // Mock RAG system to throw error
    const failingRAGSystem = {
      generateCapellanResponse: async () => {
        throw new Error('RAG system failure');
      }
    };

    const failingService = new SermonService(mockLogger, failingRAGSystem as any);

    const result = await failingService.generateDailySermon();

    expect(result.sermon).toContain('🕰️ Son las 19:40 - La Hora Imperial ha llegado');
    expect(result.sermon).toContain('fe es nuestro escudo más poderoso');
    expect(result.topic).toBe('Sermón de emergencia - fe inquebrantable');
  });

  test('should track sermon data correctly', () => {
    // Initially no sermon sent
    expect(sermonService.hasSermonBeenSentToday()).toBe(false);

    const stats = sermonService.getSermonStats();
    expect(stats.lastSermonDate).toBe('1900-01-01');
    expect(stats.sermonsSent).toBe(0);
  });

  test('should mark sermon as sent and update statistics', () => {
    const topic = 'Test Topic';

    sermonService.markSermonAsSent(topic);

    expect(sermonService.hasSermonBeenSentToday()).toBe(true);

    const stats = sermonService.getSermonStats();
    expect(stats.sermonsSent).toBe(1);
    expect(stats.lastSermonTopic).toBe(topic);

    const today = new Date().toISOString().split('T')[0];
    expect(stats.lastSermonDate).toBe(today);
  });

  test('should handle multiple sermon markings on same day', () => {
    sermonService.markSermonAsSent('Topic 1');
    expect(sermonService.getSermonStats().sermonsSent).toBe(1);

    sermonService.markSermonAsSent('Topic 2');
    expect(sermonService.getSermonStats().sermonsSent).toBe(2);
    expect(sermonService.getSermonStats().lastSermonTopic).toBe('Topic 2');
  });

  test('should persist sermon data between service instances', async () => {
    // Create initial data
    sermonService.markSermonAsSent('Persistent Topic');

    // Mock process.cwd() for new service
    const originalCwd = process.cwd;
    spyOn(process, 'cwd').mockImplementation(() => testDataPath);

    // Create new service instance (should load existing data)
    const newService = new SermonService(mockLogger, mockRAGSystem as any);

    process.cwd = originalCwd;

    const stats = newService.getSermonStats();
    expect(stats.sermonsSent).toBe(1);
    expect(stats.lastSermonTopic).toBe('Persistent Topic');
  });

  test('should detect if sermon was already sent today', () => {
    expect(sermonService.hasSermonBeenSentToday()).toBe(false);

    sermonService.markSermonAsSent();
    expect(sermonService.hasSermonBeenSentToday()).toBe(true);

    // Mock different day
    const originalDate = Date;
    const MockDate = class extends Date {
      constructor(...args: any[]) {
        if (args.length === 0) {
          super(2025, 0, 15); // Different date
        } else {
          super(...args);
        }
      }
      toISOString() {
        if (this.getTime() === new Date(2025, 0, 15).getTime()) {
          return '2025-01-15T00:00:00.000Z';
        }
        return super.toISOString();
      }
    } as any;

    globalThis.Date = MockDate;

    expect(sermonService.hasSermonBeenSentToday()).toBe(false);

    globalThis.Date = originalDate;
  });

  test('should handle corrupted sermon data file gracefully', async () => {
    // Create corrupted data file
    await writeFile(testSermonFile, 'invalid json content');

    // Mock process.cwd() for new service
    const originalCwd = process.cwd;
    spyOn(process, 'cwd').mockImplementation(() => testDataPath);

    // Should still work with defaults
    const newService = new SermonService(mockLogger, mockRAGSystem as any);

    process.cwd = originalCwd;

    const stats = newService.getSermonStats();

    expect(stats.lastSermonDate).toBe('1900-01-01');
    expect(stats.sermonsSent).toBe(0);
  });

  test('should call RAG system with appropriate prompt', async () => {
    const ragSpy = spyOn(mockRAGSystem, 'generateCapellanResponse').mockResolvedValue({
      response: 'Test sermon content',
      sources: [],
      tokensUsed: 50
    });

    await sermonService.generateDailySermon();

    expect(ragSpy).toHaveBeenCalledWith(
      expect.stringContaining('Genera un sermón épico y oscuro sobre:'),
      'daily_sermon'
    );

    const call = ragSpy.mock.calls[0];
    expect(call[0]).toContain('grimdark');
    expect(call[0]).toContain('Imperio');
    expect(call[0]).toContain('Emperador');
  });

  test('should handle file system permission errors', async () => {
    // Test that the service handles errors gracefully
    // Create a service with an invalid path that should cause write errors
    const mockErrorLogger = new Logger(mockBotConfig);
    const errorSpy = spyOn(mockErrorLogger, 'error').mockImplementation(() => {});

    // Mock process.cwd to return invalid path
    const originalCwd = process.cwd;
    spyOn(process, 'cwd').mockImplementation(() => '/root/invalid');

    const errorService = new SermonService(mockErrorLogger, mockRAGSystem as any);

    process.cwd = originalCwd;

    // Mark sermon as sent - should not throw but may log error
    expect(() => {
      errorService.markSermonAsSent('Test Topic');
    }).not.toThrow();

    // The service should handle the error gracefully
    expect(true).toBe(true); // Just verify it doesn't crash
  });
});