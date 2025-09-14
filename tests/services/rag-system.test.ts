import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { RAGSystem } from '@/services/rag-system';
import { Logger } from '@/utils/logger';
import type { BotConfig, DocumentMetadata } from '@/types';

// Mock OpenAI module
const mockOpenAI = {
  embeddings: {
    create: spyOn({}, 'create').mockResolvedValue({
      data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5] }],
    }),
  },
  chat: {
    completions: {
      create: spyOn({}, 'create').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'El Emperador protege a los fieles. PURA_FE detectada en este mensaje, hermano.',
            },
          },
        ],
        usage: { total_tokens: 150 },
      }),
    },
  },
};

// Mock the OpenAI constructor
spyOn(global, 'require').mockImplementation((module: string) => {
  if (module === 'openai') {
    return {
      OpenAI: function() {
        return mockOpenAI;
      },
    };
  }
  return jest.requireActual(module);
});

describe('RAGSystem', () => {
  let mockLogger: Logger;
  let ragSystem: RAGSystem;

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: ':memory:',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'error').mockImplementation(() => {});
    spyOn(mockLogger, 'warn').mockImplementation(() => {});
    spyOn(mockLogger, 'debug').mockImplementation(() => {});

    ragSystem = new RAGSystem(mockLogger);
  });

  test('should create RAGSystem instance', () => {
    expect(ragSystem).toBeDefined();
    expect(ragSystem).toBeInstanceOf(RAGSystem);
  });

  test('should have all required methods', () => {
    expect(typeof ragSystem.generateEmbedding).toBe('function');
    expect(typeof ragSystem.generateCapellanResponse).toBe('function');
    expect(typeof ragSystem.addDocument).toBe('function');
    expect(typeof ragSystem.deleteDocumentsBySource).toBe('function');
    expect(typeof ragSystem.rebuildIndex).toBe('function');
    expect(typeof ragSystem.getStats).toBe('function');
    expect(typeof ragSystem.close).toBe('function');
    expect(typeof ragSystem.hasBaseDocuments).toBe('function');
    expect(typeof ragSystem.getCollections).toBe('function');
    expect(typeof ragSystem.clearCollection).toBe('function');
    expect(typeof ragSystem.getCollectionStats).toBe('function');
  });

  test('should get stats from vector store', () => {
    const stats = ragSystem.getStats();
    expect(stats).toBeDefined();
    expect(typeof stats.documents).toBe('number');
    expect(typeof stats.embeddings).toBe('number');
    expect(Array.isArray(stats.sources)).toBe(true);
    expect(typeof stats.types).toBe('object');
  });

  test('should get collection stats', () => {
    const stats = ragSystem.getCollectionStats('test-collection');
    expect(stats).toBeDefined();
    expect(typeof stats.documents).toBe('number');
    expect(Array.isArray(stats.sources)).toBe(true);
  });

  test('should check for base documents', async () => {
    const hasBaseDocuments = await ragSystem.hasBaseDocuments();
    expect(typeof hasBaseDocuments).toBe('boolean');
  });

  test('should get collections list', async () => {
    const collections = await ragSystem.getCollections();
    expect(Array.isArray(collections)).toBe(true);
  });

  test('should clear collection', async () => {
    await ragSystem.clearCollection('test-collection');
    // Should not throw an error
    expect(true).toBe(true);
  });

  test('should rebuild index', async () => {
    await ragSystem.rebuildIndex();
    // Should not throw an error
    expect(true).toBe(true);
  });

  test('should delete documents by source', async () => {
    await ragSystem.deleteDocumentsBySource('test-source');
    // Should not throw an error
    expect(true).toBe(true);
  });

  test('should close properly', async () => {
    await ragSystem.close();
    // Should not throw an error
    expect(true).toBe(true);
  });

  test('should handle text chunking', () => {
    // Test the private chunkText method indirectly
    const chunkText = (ragSystem as any).chunkText;
    if (typeof chunkText === 'function') {
      const chunks = chunkText('First sentence. Second sentence. Third sentence.');
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    }
  });
});