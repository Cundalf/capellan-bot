import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import type { RAGStats, SearchResult, VectorDocument } from '@/types';
import { loadConfig } from '@/utils/config';
import type { Logger } from '@/utils/logger';

export class VectorStore {
  private db!: Database;
  private logger: Logger;
  private config = loadConfig();

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      // Ensure directory exists
      const dbDir = dirname(this.config.sqlitePath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      this.db = new Database(this.config.sqlitePath);
      // Using better-sqlite3 for cross-platform compatibility
      // Cosine similarity is calculated manually in JavaScript

      // Create tables
      this.createTables();
      this.logger.info('SQLite vector database initialized', { path: this.config.sqlitePath });
    } catch (error: any) {
      this.logger.error('Failed to initialize vector database', { error: error.message });
      throw error;
    }
  }

  private createTables() {
    const createDocumentsTable = `
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        metadata TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Simplified vector table without vec0 extension for Bun compatibility
    const createVectorTable = `
      CREATE TABLE IF NOT EXISTS vectors (
        document_id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `;

    this.db.exec(createDocumentsTable);
    this.db.exec(createVectorTable);

    // Run migrations for existing databases
    this.runMigrations();

    // Create indexes
    this.db.exec(
      'CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents(json_extract(metadata, "$.source"))'
    );
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_chunk ON documents(chunk_index)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_is_base ON documents(is_base_document)');
  }

  private runMigrations() {
    try {
      // Check if collection column exists
      const tableInfo = this.db.prepare('PRAGMA table_info(documents)').all() as any[];
      const hasCollectionColumn = tableInfo.some((col) => col.name === 'collection');
      const hasIsBaseDocumentColumn = tableInfo.some((col) => col.name === 'is_base_document');

      if (!hasCollectionColumn) {
        this.db.exec('ALTER TABLE documents ADD COLUMN collection TEXT DEFAULT "user"');
        this.logger.info('Added collection column to documents table');
      }

      if (!hasIsBaseDocumentColumn) {
        this.db.exec('ALTER TABLE documents ADD COLUMN is_base_document BOOLEAN DEFAULT FALSE');
        this.logger.info('Added is_base_document column to documents table');
      }
    } catch (error: any) {
      this.logger.error('Error running migrations', { error: error.message });
      throw error;
    }
  }

  async addDocument(
    document: VectorDocument,
    collection: string = 'user',
    isBaseDocument: boolean = false
  ): Promise<void> {
    const insertDoc = this.db.prepare(`
      INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index, collection, is_base_document)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertVector = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (document_id, embedding)
      VALUES (?, ?)
    `);

    try {
      insertDoc.run(
        document.id,
        document.content,
        JSON.stringify(document.metadata),
        document.chunkIndex,
        collection,
        isBaseDocument ? 1 : 0
      );

      insertVector.run(document.id, JSON.stringify(document.embedding));

      // Force database sync
      this.db.exec('PRAGMA synchronous = FULL');

      this.logger.debug('Document added to vector store', {
        id: document.id,
        source: document.metadata.source,
        chunkIndex: document.chunkIndex,
        collection,
        isBaseDocument,
      });
    } catch (error: any) {
      this.logger.error('Failed to add document to vector store', {
        error: error.message,
        documentId: document.id,
      });
      throw error;
    }
  }

  async addDocuments(
    documents: VectorDocument[],
    collection: string = 'user',
    isBaseDocument: boolean = false
  ): Promise<void> {
    const insertDoc = this.db.prepare(`
      INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index, collection, is_base_document)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertVector = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (document_id, embedding)
      VALUES (?, ?)
    `);

    try {
      // Insert documents one by one and verify
      let successCount = 0;
      for (const document of documents) {
        try {
          insertDoc.run(
            document.id,
            document.content,
            JSON.stringify(document.metadata),
            document.chunkIndex,
            collection,
            isBaseDocument ? 1 : 0
          );

          insertVector.run(document.id, JSON.stringify(document.embedding));

          successCount++;
        } catch (docError: any) {
          this.logger.error('Failed to insert individual document', {
            error: docError.message,
            documentId: document.id,
          });
        }
      }

      // Force database sync
      this.db.exec('PRAGMA synchronous = FULL');

      this.logger.info('Batch documents added to vector store', {
        count: documents.length,
        successCount,
        collection,
        isBaseDocument,
      });

      // Immediate verification
      const verifyCount = this.db
        .prepare(
          'SELECT COUNT(*) as count FROM documents WHERE collection = ? AND is_base_document = ?'
        )
        .get(collection, isBaseDocument ? 1 : 0) as { count: number };
      this.logger.debug('Documents verification after batch insert', {
        collection,
        isBaseDocument,
        expectedCount: documents.length,
        actualCount: verifyCount.count,
        totalDocsInDB: this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as {
          count: number;
        },
      });
    } catch (error: any) {
      this.logger.error('Failed to add documents batch to vector store', {
        error: error.message,
        count: documents.length,
      });
      throw error;
    }
  }

  async searchSimilar(
    queryEmbedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
    collections?: string[]
  ): Promise<SearchResult[]> {
    try {
      // Build query with collection filter if specified
      let searchQuery = `
        SELECT 
          d.id,
          d.content,
          d.metadata,
          d.chunk_index,
          d.collection,
          v.embedding
        FROM documents d
        JOIN vectors v ON d.id = v.document_id
      `;

      const queryParams: any[] = [];

      if (collections && collections.length > 0) {
        const placeholders = collections.map(() => '?').join(',');
        searchQuery += ` WHERE d.collection IN (${placeholders})`;
        queryParams.push(...collections);
      }

      const results = this.db.prepare(searchQuery).all(...queryParams) as any[];

      // Calculate cosine similarity for each result
      const similarities = results.map((row: any) => {
        const storedEmbedding = JSON.parse(row.embedding);
        const similarity = this.calculateCosineSimilarity(queryEmbedding, storedEmbedding);
        return {
          document: {
            id: row.id,
            content: row.content,
            embedding: queryEmbedding, // We don't need to return the full embedding
            metadata: JSON.parse(row.metadata),
            chunkIndex: row.chunk_index,
          },
          similarity,
          source: JSON.parse(row.metadata).source,
        };
      });

      // Filter by threshold and sort by similarity
      return similarities
        .filter((result) => result.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error: any) {
      this.logger.error('Failed to search similar documents', { error: error.message });
      throw error;
    }
  }

  private calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async deleteDocumentsBySource(source: string): Promise<void> {
    try {
      const deleteQuery = `
        DELETE FROM documents 
        WHERE json_extract(metadata, '$.source') = ?
      `;

      const deleteVectorsQuery = `
        DELETE FROM vectors 
        WHERE document_id IN (
          SELECT id FROM documents 
          WHERE json_extract(metadata, '$.source') = ?
        )
      `;

      this.db.transaction((trx) => {
        this.db.prepare(deleteVectorsQuery).run(source);
        this.db.prepare(deleteQuery).run(source);
      });

      this.logger.info('Documents deleted by source', { source });
    } catch (error: any) {
      this.logger.error('Failed to delete documents by source', { error: error.message, source });
      throw error;
    }
  }

  async clearAllDocuments(): Promise<void> {
    try {
      this.db.exec('DELETE FROM vectors');
      this.db.exec('DELETE FROM documents');
      this.logger.info('All documents cleared from vector store');
    } catch (error: any) {
      this.logger.error('Failed to clear all documents', { error: error.message });
      throw error;
    }
  }

  getStats(): RAGStats {
    try {
      const documentsCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as {
        count: number;
      };
      const sourcesResult = this.db
        .prepare(`
        SELECT DISTINCT json_extract(metadata, '$.source') as source 
        FROM documents
      `)
        .all() as { source: string }[];

      const typesResult = this.db
        .prepare(`
        SELECT 
          json_extract(metadata, '$.type') as type,
          COUNT(*) as count
        FROM documents
        GROUP BY json_extract(metadata, '$.type')
      `)
        .all() as { type: string; count: number }[];

      const types: Record<string, number> = {};
      for (const typeRow of typesResult) {
        types[typeRow.type] = typeRow.count;
      }

      return {
        documents: documentsCount.count,
        embeddings: documentsCount.count, // Each document has one embedding
        sources: sourcesResult.map((s) => s.source),
        types,
      };
    } catch (error: any) {
      this.logger.error('Failed to get vector store stats', { error: error.message });
      return {
        documents: 0,
        embeddings: 0,
        sources: [],
        types: {},
      };
    }
  }

  async close(): Promise<void> {
    this.db.close();
    this.logger.info('Vector store database closed');
  }

  // Check if base documents exist for a specific collection
  async hasBaseDocuments(collection?: string): Promise<boolean> {
    try {
      // Check for both possible boolean representations
      let query =
        'SELECT COUNT(*) as count FROM documents WHERE (is_base_document = 1 OR is_base_document = true)';
      const params: any[] = [];

      if (collection) {
        query += ' AND collection = ?';
        params.push(collection);
      }

      const result = this.db.prepare(query).get(...params) as { count: number };
      const hasBaseDocuments = result.count > 0;

      // Debug logging
      this.logger.debug(`Checking base documents for collection: ${collection || 'all'}`, {
        query,
        params,
        count: result.count,
        hasBaseDocuments,
      });

      return hasBaseDocuments;
    } catch (error: any) {
      this.logger.error('Failed to check for base documents', { error: error.message });
      return false;
    }
  }

  // Get all available collections
  async getCollections(): Promise<string[]> {
    try {
      const results = this.db.prepare('SELECT DISTINCT collection FROM documents').all() as {
        collection: string;
      }[];
      return results.map((r) => r.collection);
    } catch (error: any) {
      this.logger.error('Failed to get collections', { error: error.message });
      return [];
    }
  }

  // Delete all documents in a specific collection
  async clearCollection(collection: string): Promise<void> {
    try {
      const deleteQuery = `DELETE FROM documents WHERE collection = ?`;
      const deleteVectorsQuery = `
        DELETE FROM vectors 
        WHERE document_id IN (SELECT id FROM documents WHERE collection = ?)
      `;

      this.db.transaction((trx) => {
        this.db.prepare(deleteVectorsQuery).run(collection);
        this.db.prepare(deleteQuery).run(collection);
      });

      this.logger.info('Collection cleared', { collection });
    } catch (error: any) {
      this.logger.error('Failed to clear collection', { error: error.message, collection });
      throw error;
    }
  }

  // Get stats for a specific collection
  getCollectionStats(collection: string): { documents: number; sources: string[] } {
    try {
      const documentsCount = this.db
        .prepare('SELECT COUNT(*) as count FROM documents WHERE collection = ?')
        .get(collection) as { count: number };
      const sourcesResult = this.db
        .prepare(`
        SELECT DISTINCT json_extract(metadata, '$.source') as source 
        FROM documents 
        WHERE collection = ?
      `)
        .all(collection) as { source: string }[];

      const stats = {
        documents: documentsCount.count,
        sources: sourcesResult.map((s) => s.source),
      };

      // Debug logging for timing issues
      if (collection && stats.documents === 0) {
        const allDocs = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as {
          count: number;
        };
        this.logger.debug(`Collection stats check`, {
          collection,
          collectionCount: stats.documents,
          totalDocsInDB: allDocs.count,
        });
      }

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to get collection stats', { error: error.message, collection });
      return { documents: 0, sources: [] };
    }
  }

  // Utility method for maintenance
  async vacuum(): Promise<void> {
    try {
      this.db.exec('VACUUM');
      this.logger.info('Vector store vacuumed');
    } catch (error: any) {
      this.logger.error('Failed to vacuum vector store', { error: error.message });
    }
  }
}
