
import { OpenAI } from 'openai';
import { VectorStore } from './vector-store';
import { Logger } from '@/utils/logger';
import { WARHAMMER_CONSTANTS } from '@/utils/constants';
import { DocumentMetadata, VectorDocument, RAGResponse, RAGStats, CommandType } from '@/types';

// Define collections for different command types
const RAG_COLLECTIONS = {
  heresy_analysis: ['heresy-analysis'],
  daily_sermon: ['sermons'],
  knowledge_search: ['general-lore', 'user'], // Include user documents for general knowledge
  questions: ['general-lore', 'heresy-analysis', 'sermons', 'user'], // All collections for questions
  general: ['user'] // Default for backwards compatibility
} as const;

export class RAGSystem {
  private openai: OpenAI;
  private vectorStore: VectorStore;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.vectorStore = new VectorStore(logger);
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: WARHAMMER_CONSTANTS.RAG_CONFIG.EMBEDDING_MODEL,
        input: text.substring(0, 8000) // Limit text length for embedding
      });

      return response.data[0].embedding;
    } catch (error: any) {
      this.logger.error('Failed to generate embedding', { error: error.message });
      throw new Error('Failed to generate embedding');
    }
  }

  async generateCapellanResponse(query: string, type: CommandType = 'general'): Promise<RAGResponse> {
    try {
      this.logger.debug('Generating RAG response', { query: query.substring(0, 100), type });

      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query);

      // Get collections for this command type
      const collections = RAG_COLLECTIONS[type] || RAG_COLLECTIONS.general;
      
      // Search for similar documents in the appropriate collections
      const searchResults = await this.vectorStore.searchSimilar(
        queryEmbedding,
        WARHAMMER_CONSTANTS.RAG_CONFIG.MAX_RESULTS,
        WARHAMMER_CONSTANTS.RAG_CONFIG.SIMILARITY_THRESHOLD,
        collections
      );

      // Build context from search results
      const context = this.buildContext(searchResults, type);
      
      // Generate response using OpenAI
      const systemPrompt = this.getSystemPrompt(type);
      const userPrompt = this.buildUserPrompt(query, context, type);

      const completion = await this.openai.chat.completions.create({
        model: WARHAMMER_CONSTANTS.RAG_CONFIG.CHAT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_completion_tokens: 300
      });

      const response = completion.choices[0].message.content || 'Los espíritus de la máquina me fallan, hermano.';
      const tokensUsed = completion.usage?.total_tokens || 0;

      this.logger.info('RAG response generated', { 
        type, 
        tokensUsed, 
        contextSources: searchResults.length,
        queryLength: query.length 
      });

      return {
        response,
        sources: searchResults,
        tokensUsed
      };
    } catch (error: any) {
      this.logger.error('Failed to generate RAG response', { 
        error: error.message, 
        query: query.substring(0, 100) 
      });
      
      return {
        response: this.getFallbackResponse(type),
        sources: [],
        tokensUsed: 0
      };
    }
  }

  private buildContext(searchResults: any[], type: CommandType): string {
    if (searchResults.length === 0) return '';

    const contextChunks = searchResults.map(result => 
      `Fuente: ${result.source}
Contenido: ${result.document.content}
Relevancia: ${Math.round(result.similarity * 100)}%`
    );

    return contextChunks.join('\n\n---\n\n').substring(0, WARHAMMER_CONSTANTS.RAG_CONFIG.MAX_CONTEXT_LENGTH);
  }

  private getSystemPrompt(type: CommandType): string {
    const basePrompt = `Eres un Capellán de los Adeptus Astartes en el universo de Warhammer 40,000. Tu deber es:
- Proteger la fe imperial y detectar herejía REAL (no vulgaridades menores)
- Hablar con el lenguaje característico del 40k (Ave Imperator, El Emperador Protege, etc.)
- Ser un guerrero duro, no un predicador sensible - esto es GRIMDARK
- Categorizar la herejía en niveles: PURA_FE, SOSPECHOSO, HEREJIA_MENOR, HEREJIA_MAYOR, HEREJIA_EXTREMA
- RESPONDER MÁXIMO EN 1 PÁRRAFO CORTO`;

    const typeSpecificPrompts = {
      heresy_analysis: `${basePrompt}

ANALIZA HEREJÍA con criterio MILITAR W40K:

PURA_FE: Odio a xenos (orkos, eldars, tau), devoción al Emperador, fervor de batalla
SOSPECHOSO: Dudas menores, falta de fervor, cobardía  
HEREJIA_MENOR: Cuestionar autoridad imperial, simpatía hacia xenos
HEREJIA_MAYOR: Negar al Emperador, usar poderes psíquicos sin licencia
HEREJIA_EXTREMA: Adorar al Caos, traicionar al Imperio, brujería

IMPORTANTE: 
- Lenguaje vulgar contra ENEMIGOS = BUENO (fervor imperial)
- Palabrotas normales = NO ES HEREJÍA (somos guerreros)
- Solo blasfemia contra Emperador/Imperio = HEREJÍA REAL
- Respuesta DIRECTA en 1 párrafo`,

      daily_sermon: `${basePrompt}

GENERA SERMÓN MILITAR conciso que fortalezca fe imperial. Incluye fervor de batalla y devoción al Emperador. Máximo 1 párrafo inspirador.`,

      knowledge_search: `${basePrompt}

RESPONDE preguntas sobre lore W40K de forma directa y concisa. Usa contexto disponible y conocimiento del 40k. Máximo 1 párrafo informativo.`,

      general: basePrompt
    };

    return typeSpecificPrompts[type] || typeSpecificPrompts.general;
  }

  private buildUserPrompt(query: string, context: string, type: CommandType): string {
    const contextSection = context 
      ? `

CONTEXTO DE LOS ARCHIVOS SAGRADOS:
${context}

`
      : '\n\nNo hay contexto específico disponible de los archivos sagrados.\n\n';

    const typeMessages = {
      heresy_analysis: `ANALIZA LA SIGUIENTE DECLARACIÓN EN BUSCA DE HEREJÍA:
"${query}"`,
      daily_sermon: `GENERA UN SERMÓN DIARIO SOBRE: ${query}`,
      knowledge_search: `RESPONDE LA SIGUIENTE PREGUNTA SOBRE EL LORE: ${query}`,
      general: `RESPONDE COMO UN CAPELLÁN: ${query}`
    };

    return `${contextSection}${typeMessages[type] || typeMessages.general}`;
  }

  private getFallbackResponse(type: CommandType): string {
    const fallbacks = {
      heresy_analysis: '⚡ Los espíritus de la máquina me fallan al analizar este mensaje. Sin embargo, mantened la vigilancia, hermanos. **SOSPECHOSO** por precaución.',
      daily_sermon: '🕊️ El Emperador protege a quienes marchan en Su nombre. Que Su luz dorada guíe vuestros pasos en este día, hermanos. **Ave Imperator!**',
      knowledge_search: '📚 Los archivos sagrados no responden en este momento. Consultad al Adeptus Mechanicus o intentad más tarde.',
      general: '🔧 Los espíritus de la máquina requieren apaciguamiento. El Omnissiah nos ha fallado temporalmente.'
    };

    return fallbacks[type] || fallbacks.general;
  }

  async addDocument(content: string, metadata: DocumentMetadata, collection: string = 'user', isBaseDocument: boolean = false): Promise<void> {
    try {
      // Split content into chunks
      const chunks = this.chunkText(content);
      const documents: VectorDocument[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.generateEmbedding(chunk);
        
        documents.push({
          id: `${metadata.source}_chunk_${i}`,
          content: chunk,
          embedding,
          metadata: { ...metadata, processed: true },
          chunkIndex: i
        });
      }

      await this.vectorStore.addDocuments(documents, collection, isBaseDocument);
      this.logger.info('Document added to RAG system', { 
        source: metadata.source, 
        chunks: chunks.length,
        type: metadata.type,
        collection,
        isBaseDocument
      });
    } catch (error: any) {
      this.logger.error('Failed to add document to RAG system', { 
        error: error.message, 
        source: metadata.source 
      });
      throw error;
    }
  }

  private chunkText(text: string): string[] {
    const { CHUNK_SIZE, CHUNK_OVERLAP } = WARHAMMER_CONSTANTS.RAG_CONFIG;
    const chunks: string[] = [];
    
    // Simple sentence-aware chunking
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const testChunk = currentChunk + sentence + '.';
      
      if (testChunk.length <= CHUNK_SIZE) {
        currentChunk = testChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          // Start new chunk with overlap
          const words = currentChunk.split(' ');
          const overlapWords = words.slice(-Math.floor(CHUNK_OVERLAP / 5)); // Rough word estimate
          currentChunk = overlapWords.join(' ') + ' ' + sentence + '.';
        } else {
          // Single sentence longer than chunk size, split it
          currentChunk = sentence.substring(0, CHUNK_SIZE) + '.';
        }
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  async deleteDocumentsBySource(source: string): Promise<void> {
    await this.vectorStore.deleteDocumentsBySource(source);
    this.logger.info('Documents deleted from RAG system', { source });
  }

  async rebuildIndex(): Promise<void> {
    this.logger.info('Rebuilding RAG index...');
    await this.vectorStore.clearAllDocuments();
    this.logger.info('RAG index rebuilt (cleared - documents need to be re-added)');
  }

  async hasBaseDocuments(collection?: string): Promise<boolean> {
    return await this.vectorStore.hasBaseDocuments(collection);
  }

  async getCollections(): Promise<string[]> {
    return await this.vectorStore.getCollections();
  }

  async clearCollection(collection: string): Promise<void> {
    await this.vectorStore.clearCollection(collection);
    this.logger.info('Collection cleared', { collection });
  }

  getCollectionStats(collection: string): { documents: number; sources: string[] } {
    return this.vectorStore.getCollectionStats(collection);
  }

  getStats(): RAGStats {
    return this.vectorStore.getStats();
  }

  async close(): Promise<void> {
    await this.vectorStore.close();
  }
}