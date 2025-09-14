import axios from 'axios';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import * as pdfjsLib from 'pdfjs-dist';
import { promisify } from 'util';
import type { DocumentMetadata } from '@/types';
import { loadConfig } from '@/utils/config';
import { WARHAMMER_CONSTANTS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import type { RAGSystem } from './rag-system';

const execAsync = promisify(exec);

export class DocumentProcessor {
  private logger: Logger;
  private ragSystem: RAGSystem;
  private config = loadConfig();

  constructor(logger: Logger, ragSystem: RAGSystem) {
    this.logger = logger;
    this.ragSystem = ragSystem;
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    const dirs = [this.config.documentsPath, join(this.config.documentsPath, 'metadata')];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
        this.logger.info('Created directory', { path: dir });
      }
    }
  }

  async downloadAndProcessUrl(url: string, addedBy: string): Promise<void> {
    this.logger.info('Starting URL processing', { url, addedBy });

    // Validate domain
    this.validateDomain(url);

    // Generate safe filename
    const urlObj = new URL(url);
    const fileName = this.generateSafeFilename(urlObj);
    const pdfPath = join(this.config.documentsPath, `${fileName}_${Date.now()}.pdf`);
    const metadataPath = join(
      this.config.documentsPath,
      'metadata',
      `${fileName}_${Date.now()}_metadata.json`
    );

    try {
      // Download as PDF using wkhtmltopdf
      await this.downloadAsPdf(url, pdfPath);

      // Extract text from PDF
      const text = await this.extractTextFromPdf(pdfPath);

      if (text.length < 100) {
        throw new Error('El documento descargado parece estar vacío o ser demasiado corto');
      }

      // Create metadata
      const metadata: DocumentMetadata = {
        source: url,
        addedBy,
        addedAt: new Date().toISOString(),
        filePath: pdfPath,
        title: this.extractTitleFromText(text),
        type: 'pdf',
        processed: false,
      };

      // Save metadata
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Add to RAG system
      await this.ragSystem.addDocument(text, metadata);

      // Update metadata as processed
      metadata.processed = true;
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      this.logger.info('Document processed successfully', {
        url,
        addedBy,
        pdfPath,
        textLength: text.length,
        title: metadata.title,
      });
    } catch (error: any) {
      this.logger.error('Failed to process URL', {
        error: error.message,
        url,
        addedBy,
      });
      throw error;
    }
  }

  private validateDomain(url: string): void {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    const isAllowed = WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.some((allowed) =>
      domain.includes(allowed.toLowerCase())
    );

    if (!isAllowed) {
      throw new Error(
        `Dominio no permitido: ${domain}. Solo se permiten: ${WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.join(', ')}`
      );
    }
  }

  private generateSafeFilename(urlObj: URL): string {
    const pathname = urlObj.pathname;
    let filename = pathname.split('/').pop() || 'document';

    // Remove extension and clean
    filename = filename.replace(/\\.[^.]*$/, '');
    filename = filename.replace(/[^a-zA-Z0-9_-]/g, '_');
    filename = filename.substring(0, 50); // Limit length

    return filename || 'document';
  }

  private async downloadAsPdf(url: string, outputPath: string): Promise<void> {
    const command = [
      'wkhtmltopdf',
      '--page-size A4',
      '--margin-top 0.75in',
      '--margin-right 0.75in',
      '--margin-bottom 0.75in',
      '--margin-left 0.75in',
      '--encoding UTF-8',
      '--load-error-handling ignore',
      '--load-media-error-handling ignore',
      `"${url}"`,
      `"${outputPath}"`,
    ].join(' ');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });

      if (stderr && !stderr.includes('Warning')) {
        this.logger.warn('wkhtmltopdf warnings', { stderr, url });
      }

      if (!existsSync(outputPath)) {
        throw new Error('PDF file was not created');
      }

      this.logger.debug('PDF download completed', { url, outputPath });
    } catch (error: any) {
      this.logger.error('wkhtmltopdf execution failed', {
        error: error.message,
        url,
        outputPath,
      });
      throw new Error(`Error descargando PDF: ${error.message}`);
    }
  }

  private async extractTextFromPdf(pdfPath: string): Promise<string> {
    try {
      const pdfBuffer = await readFile(pdfPath);

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: pdfBuffer,
        verbosity: 0, // Disable console warnings
      });

      const pdfDocument = await loadingTask.promise;
      let fullText = '';

      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Combine all text items
        const pageText = textContent.items.map((item: any) => item.str).join(' ');

        fullText += pageText + '\n';
      }

      // Clean up the text
      const text = this.cleanExtractedText(fullText);

      if (text.length < 50) {
        throw new Error('Extracted text is too short, PDF might be corrupted or image-only');
      }

      this.logger.debug('Text extracted from PDF', {
        pdfPath,
        textLength: text.length,
        pages: pdfDocument.numPages,
      });

      return text;
    } catch (error: any) {
      this.logger.error('Failed to extract text from PDF', {
        error: error.message,
        pdfPath,
      });
      throw new Error(`Error extrayendo texto del PDF: ${error.message}`);
    }
  }

  private cleanExtractedText(text: string): string {
    return (
      text
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        // Remove page numbers and headers/footers patterns
        .replace(/\n\s*\d+\s*\n/g, ' ')
        // Remove common PDF artifacts
        .replace(/\uFFFD/g, '') // Replacement character
        .replace(/\uFEFF/g, '') // BOM
        // Normalize quotes and dashes
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/[—–]/g, '-')
        // Remove excessive line breaks
        .replace(/\n{3,}/g, '\n\n')
        // Trim whitespace
        .trim()
    );
  }

  private extractTitleFromText(text: string): string {
    // Try to extract title from first lines
    const lines = text.split('\n').filter((line) => line.trim().length > 0);

    if (lines.length === 0) return 'Documento sin título';

    // Look for a title-like first line (not too long, not too short)
    const firstLine = lines[0].trim();

    if (firstLine.length >= 10 && firstLine.length <= 100 && !firstLine.includes('.')) {
      return firstLine;
    }

    // Look in first few lines for something title-like
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (
        line.length >= 10 &&
        line.length <= 100 &&
        !line.includes('.') &&
        !line.toLowerCase().includes('page')
      ) {
        return line;
      }
    }

    // Fallback to first 50 characters
    return firstLine.substring(0, 50) + (firstLine.length > 50 ? '...' : '');
  }

  async processTextDocument(
    text: string,
    source: string,
    addedBy: string,
    title?: string
  ): Promise<void> {
    this.logger.info('Processing text document', { source, addedBy, textLength: text.length });

    try {
      const metadata: DocumentMetadata = {
        source,
        addedBy,
        addedAt: new Date().toISOString(),
        filePath: '', // No file for direct text
        title: title || this.extractTitleFromText(text),
        type: 'text',
        processed: false,
      };

      // Save metadata
      const metadataPath = join(
        this.config.documentsPath,
        'metadata',
        `text_${Date.now()}_metadata.json`
      );
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      // Add to RAG system
      await this.ragSystem.addDocument(text, metadata);

      // Update metadata as processed
      metadata.processed = true;
      await writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      this.logger.info('Text document processed successfully', {
        source,
        addedBy,
        textLength: text.length,
        title: metadata.title,
      });
    } catch (error: any) {
      this.logger.error('Failed to process text document', {
        error: error.message,
        source,
        addedBy,
      });
      throw error;
    }
  }

  async downloadWebContent(url: string): Promise<string> {
    this.logger.debug('Downloading web content', { url });

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'CapellanBot/1.0 (Warhammer40k Knowledge Collector)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Simple HTML cleaning - remove tags and get text content
      let content = response.data;

      // Remove script and style tags and their content
      content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
      content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

      // Remove HTML tags
      content = content.replace(/<[^>]*>/g, ' ');

      // Decode HTML entities
      content = content
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      // Clean whitespace
      content = this.cleanExtractedText(content);

      this.logger.debug('Web content downloaded', { url, contentLength: content.length });
      return content;
    } catch (error: any) {
      this.logger.error('Failed to download web content', { error: error.message, url });
      throw new Error(`Error descargando contenido web: ${error.message}`);
    }
  }

  async getProcessedDocuments(): Promise<DocumentMetadata[]> {
    try {
      const metadataDir = join(this.config.documentsPath, 'metadata');

      if (!existsSync(metadataDir)) {
        return [];
      }

      const files = await readFile(metadataDir);
      // This is a simplified version - in practice you'd read the directory
      // and parse each metadata file
      return [];
    } catch (error: any) {
      this.logger.error('Failed to get processed documents', { error: error.message });
      return [];
    }
  }
}
