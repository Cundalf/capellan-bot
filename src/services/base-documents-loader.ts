import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DocumentMetadata } from '@/types';
import type { Logger } from '@/utils/logger';
import type { RAGSystem } from './rag-system';

export class BaseDocumentsLoader {
  private ragSystem: RAGSystem;
  private logger: Logger;
  private baseDocsPath: string;

  constructor(ragSystem: RAGSystem, logger: Logger) {
    this.ragSystem = ragSystem;
    this.logger = logger;
    this.baseDocsPath = join(process.cwd(), 'database', 'base-documents');
  }

  async initializeBaseDocuments(): Promise<void> {
    try {
      this.logger.info('Initializing base documents...');

      // Check if base documents directory exists
      if (!existsSync(this.baseDocsPath)) {
        this.logger.warn('Base documents directory not found', { path: this.baseDocsPath });
        return;
      }

      // Load documents from each collection
      await this.loadCollectionDocuments('heresy-analysis');
      await this.loadCollectionDocuments('sermons');
      await this.loadCollectionDocuments('general-lore');

      this.logger.info('Base documents initialization completed');
    } catch (error: any) {
      this.logger.error('Failed to initialize base documents', { error: error.message });
      throw error;
    }
  }

  private async loadCollectionDocuments(collection: string): Promise<void> {
    const collectionPath = join(this.baseDocsPath, collection);

    if (!existsSync(collectionPath)) {
      this.logger.warn(`Collection directory not found: ${collection}`);
      return;
    }

    // Check if this collection already has base documents
    const hasExisting = await this.ragSystem.hasBaseDocuments(collection);
    if (hasExisting) {
      const stats = this.ragSystem.getCollectionStats(collection);
      this.logger.info(`⏭️  Base documents already exist for collection: ${collection}`, {
        documents: stats.documents,
        sources: stats.sources.length,
      });
      return;
    }

    this.logger.info(`Loading base documents for collection: ${collection}`);

    try {
      const files = readdirSync(collectionPath).filter((file) => file.endsWith('.md'));
      let loadedCount = 0;

      for (const file of files) {
        const filePath = join(collectionPath, file);
        const content = readFileSync(filePath, 'utf-8');

        // Skip empty files
        if (content.trim().length === 0) {
          this.logger.warn(`Skipping empty base document: ${file}`);
          continue;
        }

        const metadata: DocumentMetadata = {
          source: `base-${collection}-${file.replace('.md', '')}`,
          type: this.getDocumentType(collection),
          filePath: filePath,
          addedBy: 'system',
          addedAt: new Date().toISOString(),
          processed: false,
        };

        await this.ragSystem.addDocument(content, metadata, collection, true);
        loadedCount++;

        this.logger.debug(`Loaded base document: ${file}`, { collection, file });
      }

      this.logger.info(`Loaded ${loadedCount} base documents for collection: ${collection}`);
    } catch (error: any) {
      this.logger.error(`Failed to load collection: ${collection}`, { error: error.message });
      throw error;
    }
  }

  private getDocumentType(collection: string): 'pdf' | 'web' | 'text' {
    return 'text'; // Base documents are always text files
  }

  async checkBaseDocumentsStatus(): Promise<{
    heresyAnalysis: { hasDocuments: boolean; count: number };
    sermons: { hasDocuments: boolean; count: number };
    generalLore: { hasDocuments: boolean; count: number };
  }> {
    try {
      const heresyStats = this.ragSystem.getCollectionStats('heresy-analysis');
      const sermonsStats = this.ragSystem.getCollectionStats('sermons');
      const loreStats = this.ragSystem.getCollectionStats('general-lore');

      return {
        heresyAnalysis: {
          hasDocuments: heresyStats.documents > 0,
          count: heresyStats.documents,
        },
        sermons: {
          hasDocuments: sermonsStats.documents > 0,
          count: sermonsStats.documents,
        },
        generalLore: {
          hasDocuments: loreStats.documents > 0,
          count: loreStats.documents,
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to check base documents status', { error: error.message });
      return {
        heresyAnalysis: { hasDocuments: false, count: 0 },
        sermons: { hasDocuments: false, count: 0 },
        generalLore: { hasDocuments: false, count: 0 },
      };
    }
  }

  async reloadBaseDocuments(collection?: string): Promise<void> {
    if (collection) {
      this.logger.info(`Reloading base documents for collection: ${collection}`);
      await this.ragSystem.clearCollection(collection);
      await this.loadCollectionDocuments(collection);
    } else {
      this.logger.info('Reloading all base documents');
      await this.ragSystem.clearCollection('heresy-analysis');
      await this.ragSystem.clearCollection('sermons');
      await this.ragSystem.clearCollection('general-lore');

      await this.loadCollectionDocuments('heresy-analysis');
      await this.loadCollectionDocuments('sermons');
      await this.loadCollectionDocuments('general-lore');
    }
  }

  getBaseDocumentsPath(): string {
    return this.baseDocsPath;
  }

  listAvailableBaseDocuments(): { [collection: string]: string[] } {
    const result: { [collection: string]: string[] } = {};

    try {
      const collections = ['heresy-analysis', 'sermons', 'general-lore'];

      for (const collection of collections) {
        const collectionPath = join(this.baseDocsPath, collection);

        if (existsSync(collectionPath)) {
          const files = readdirSync(collectionPath)
            .filter((file) => file.endsWith('.md'))
            .map((file) => file.replace('.md', ''));

          result[collection] = files;
        } else {
          result[collection] = [];
        }
      }

      return result;
    } catch (error: any) {
      this.logger.error('Failed to list available base documents', { error: error.message });
      return {};
    }
  }
}
