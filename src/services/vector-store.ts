
import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Logger } from '@/utils/logger';
import { loadConfig } from '@/utils/config';
import { VectorDocument, SearchResult, RAGStats } from '@/types';

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

    // Create indexes
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents(json_extract(metadata, "$.source"))');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_documents_chunk ON documents(chunk_index)');
  }

  async addDocument(document: VectorDocument): Promise<void> {
    const insertDoc = this.db.prepare(`
      INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index)
      VALUES (?, ?, ?, ?)
    `);

    const insertVector = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (document_id, embedding)
      VALUES (?, ?)
    `);

    try {
      this.db.transaction((trx) => {
        insertDoc.run(
          document.id,
          document.content,
          JSON.stringify(document.metadata),
          document.chunkIndex
        );

        insertVector.run(
          document.id,
          JSON.stringify(document.embedding)
        );
      });

      this.logger.debug('Document added to vector store', { 
        id: document.id, 
        source: document.metadata.source,
        chunkIndex: document.chunkIndex
      });
    } catch (error: any) {
      this.logger.error('Failed to add document to vector store', { 
        error: error.message, 
        documentId: document.id 
      });
      throw error;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    const insertDoc = this.db.prepare(`
      INSERT OR REPLACE INTO documents (id, content, metadata, chunk_index)
      VALUES (?, ?, ?, ?)
    `);

    const insertVector = this.db.prepare(`
      INSERT OR REPLACE INTO vectors (document_id, embedding)
      VALUES (?, ?)
    `);

    try {

      this.db.transaction((trx) => {
        for (const document of documents) {
          insertDoc.run(
            document.id,
            document.content,
            JSON.stringify(document.metadata),
            document.chunkIndex
          );

          insertVector.run(
            document.id,
            JSON.stringify(document.embedding)
          );
        }
      });

      this.logger.info('Batch documents added to vector store', { count: documents.length });
    } catch (error: any) {
      this.logger.error('Failed to add documents batch to vector store', { 
        error: error.message, 
        count: documents.length 
      });
      throw error;
    }
  }

  async searchSimilar(queryEmbedding: number[], limit: number = 5, threshold: number = 0.7): Promise<SearchResult[]> {
    try {
      // Get all vectors and calculate similarity manually
      const searchQuery = `
        SELECT 
          d.id,
          d.content,
          d.metadata,
          d.chunk_index,
          v.embedding
        FROM documents d
        JOIN vectors v ON d.id = v.document_id
      `;

      const results = this.db.prepare(searchQuery).all() as any[];

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
            chunkIndex: row.chunk_index
          },
          similarity,
          source: JSON.parse(row.metadata).source
        };
      });

      // Filter by threshold and sort by similarity
      return similarities
        .filter(result => result.similarity >= threshold)
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
      const documentsCount = this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as { count: number };
      const sourcesResult = this.db.prepare(`
        SELECT DISTINCT json_extract(metadata, '$.source') as source 
        FROM documents
      `).all() as { source: string }[];

      const typesResult = this.db.prepare(`
        SELECT 
          json_extract(metadata, '$.type') as type,
          COUNT(*) as count
        FROM documents
        GROUP BY json_extract(metadata, '$.type')
      `).all() as { type: string; count: number }[];

      const types: Record<string, number> = {};
      for (const typeRow of typesResult) {
        types[typeRow.type] = typeRow.count;
      }

      return {
        documents: documentsCount.count,
        embeddings: documentsCount.count, // Each document has one embedding
        sources: sourcesResult.map(s => s.source),
        types
      };
    } catch (error: any) {
      this.logger.error('Failed to get vector store stats', { error: error.message });
      return {
        documents: 0,
        embeddings: 0,
        sources: [],
        types: {}
      };
    }
  }

  async close(): Promise<void> {
    this.db.close();
    this.logger.info('Vector store database closed');
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