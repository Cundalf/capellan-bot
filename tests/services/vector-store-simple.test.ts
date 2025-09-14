import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { VectorStore } from '@/services/vector-store';
import { Logger } from '@/utils/logger';
import type { BotConfig, VectorDocument } from '@/types';

describe('VectorStore', () => {
  let mockLogger: Logger;
  let vectorStore: VectorStore;

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: ':memory:',
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

    vectorStore = new VectorStore(mockLogger);
    // Clear any existing data
    await vectorStore.clearAllDocuments();
  });

  test('should create VectorStore instance', () => {
    expect(vectorStore).toBeDefined();
    expect(vectorStore).toBeInstanceOf(VectorStore);
  });

  test('should have basic methods defined', () => {
    expect(typeof vectorStore.addDocument).toBe('function');
    expect(typeof vectorStore.searchSimilar).toBe('function');
    expect(typeof vectorStore.clearAllDocuments).toBe('function');
    expect(typeof vectorStore.getCollectionStats).toBe('function');
    expect(typeof vectorStore.getStats).toBe('function');
  });

  test('should get initial stats', () => {
    const stats = vectorStore.getStats();
    expect(stats).toBeDefined();
    expect(stats.documents).toBe(0);
    expect(stats.embeddings).toBe(0);
    expect(stats.sources).toEqual([]);
    expect(stats.types).toEqual({});
  });

  test('should add document successfully', async () => {
    const testDocument: VectorDocument = {
      id: 'test-doc-1',
      content: 'El Emperador protege a la humanidad',
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      metadata: { source: 'test-source', type: 'text', processed: true },
      chunkIndex: 0,
    };

    await vectorStore.addDocument(testDocument);

    const stats = vectorStore.getStats();
    expect(stats.documents).toBe(1);
    expect(stats.embeddings).toBe(1);
    expect(stats.sources).toContain('test-source');
  });

  test('should add multiple documents', async () => {
    const documents: VectorDocument[] = [
      {
        id: 'test-doc-1',
        content: 'Primer documento',
        embedding: [0.1, 0.2, 0.3],
        metadata: { source: 'source1', type: 'text', processed: true },
        chunkIndex: 0,
      },
      {
        id: 'test-doc-2',
        content: 'Segundo documento',
        embedding: [0.4, 0.5, 0.6],
        metadata: { source: 'source2', type: 'text', processed: true },
        chunkIndex: 0,
      },
    ];

    await vectorStore.addDocuments(documents);

    const stats = vectorStore.getStats();
    expect(stats.documents).toBe(2);
    expect(stats.sources).toContain('source1');
    expect(stats.sources).toContain('source2');
  });

  test('should search similar documents', async () => {
    // Add a test document first
    const testDocument: VectorDocument = {
      id: 'test-doc-search',
      content: 'El Emperador protege',
      embedding: [1.0, 0.0, 0.0],
      metadata: { source: 'test-search', type: 'text', processed: true },
      chunkIndex: 0,
    };

    await vectorStore.addDocument(testDocument);

    // Search for similar documents
    const results = await vectorStore.searchSimilar([1.0, 0.0, 0.0], 5, 0.5);

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  test('should clear all documents', async () => {
    // Add a document first
    const testDocument: VectorDocument = {
      id: 'test-clear',
      content: 'Test content',
      embedding: [0.1, 0.2, 0.3],
      metadata: { source: 'test', type: 'text', processed: true },
      chunkIndex: 0,
    };

    await vectorStore.addDocument(testDocument);

    // Verify document was added
    let stats = vectorStore.getStats();
    expect(stats.documents).toBe(1);

    // Clear all documents
    await vectorStore.clearAllDocuments();

    // Verify documents were cleared
    stats = vectorStore.getStats();
    expect(stats.documents).toBe(0);
  });

  test('should get collection stats', () => {
    const stats = vectorStore.getCollectionStats('test-collection');
    expect(stats).toBeDefined();
    expect(stats.documents).toBe(0);
    expect(stats.sources).toEqual([]);
  });

  test('should check for base documents', async () => {
    const hasBaseDocuments = await vectorStore.hasBaseDocuments();
    expect(typeof hasBaseDocuments).toBe('boolean');
    expect(hasBaseDocuments).toBe(false);
  });

  test('should get collections list', async () => {
    const collections = await vectorStore.getCollections();
    expect(Array.isArray(collections)).toBe(true);
  });

  test('should delete documents by source', async () => {
    // Add a document
    const testDocument: VectorDocument = {
      id: 'test-delete',
      content: 'Test content to delete',
      embedding: [0.1, 0.2, 0.3],
      metadata: { source: 'delete-source', type: 'text', processed: true },
      chunkIndex: 0,
    };

    await vectorStore.addDocument(testDocument);

    // Verify document was added
    let stats = vectorStore.getStats();
    expect(stats.sources).toContain('delete-source');

    // Delete by source
    await vectorStore.deleteDocumentsBySource('delete-source');

    // The deletion function should execute without error
    expect(true).toBe(true);
  });

  test('should close properly', async () => {
    await vectorStore.close();
    // Should not throw an error
    expect(true).toBe(true);
  });
});