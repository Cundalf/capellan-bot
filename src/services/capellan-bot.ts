import { Client, GatewayIntentBits, Events, ActivityType } from 'discord.js';
import { Logger } from '@/utils/logger';
import { validateEnvironment, loadConfig } from '@/utils/config';
import { RAGSystem } from './rag-system';
import { InquisitorService } from './inquisitor-service';
import { DocumentProcessor } from './document-processor';
import { CommandManager } from './command-manager';
import { SlashCommandManager } from './slash-command-manager';
import { GamificationService } from './gamification-service';
import { BaseDocumentsLoader } from './base-documents-loader';
import { HeresyDetector } from '@/events/heresy-detector';
import { WARHAMMER_CONSTANTS } from '@/utils/constants';
import cron from 'node-cron';

export class CapellanBot {
  private client: Client;
  private logger: Logger;
  private config = loadConfig();
  private ragSystem!: RAGSystem;
  private inquisitorService!: InquisitorService;
  private documentProcessor!: DocumentProcessor;
  private gamificationService!: GamificationService;
  private commandManager!: CommandManager;
  private slashCommandManager!: SlashCommandManager;
  private heresyDetector!: HeresyDetector;
  private baseDocumentsLoader!: BaseDocumentsLoader;

  constructor() {
    // Validate environment first
    validateEnvironment();
    
    this.logger = new Logger(this.config);
    
    // Initialize Discord client
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    // Initialize services
    this.initializeServices();
    
    // Setup events
    this.setupEvents();
    
    // Setup cron jobs
    this.setupCronJobs();
    
    this.logger.capellan('Capellán inicializado, listo para servir al Emperador');
  }

  private initializeServices() {
    this.ragSystem = new RAGSystem(this.logger);
    this.inquisitorService = new InquisitorService(this.logger);
    this.documentProcessor = new DocumentProcessor(this.logger, this.ragSystem);
    this.gamificationService = new GamificationService(this.logger);
    this.baseDocumentsLoader = new BaseDocumentsLoader(this.ragSystem, this.logger);
    this.commandManager = new CommandManager(
      this.logger,
      this.inquisitorService,
      this.ragSystem,
      this.documentProcessor,
      this.gamificationService
    );
    this.slashCommandManager = new SlashCommandManager(this.client, this.logger, this.commandManager);
    this.heresyDetector = new HeresyDetector(this.logger, this.ragSystem, this.commandManager, this.gamificationService);
  }

  private setupEvents() {
    this.client.on(Events.ClientReady, () => {
      this.onReady();
    });

    this.client.on(Events.MessageCreate, (message) => {
      this.onMessageCreate(message);
    });

    this.client.on(Events.InteractionCreate, (interaction) => {
      this.onInteractionCreate(interaction);
    });

    this.client.on(Events.Error, (error) => {
      this.logger.error('Discord client error', { error: error.message });
    });

    this.client.on(Events.Warn, (warning) => {
      this.logger.warn('Discord client warning', { warning });
    });

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private setupCronJobs() {
    cron.schedule('0 6 * * *', async () => {
      this.logger.info('Daily sermon cron triggered');
    });

    cron.schedule('0 3 * * *', async () => {
      this.logger.info('Running database maintenance');
      await this.gamificationService.cleanupExpiredPenitence();
    });

    cron.schedule('0 2 * * 0', async () => {
      this.logger.info('Creating weekly backup');
      try {
        await this.inquisitorService.createBackup();
      } catch (error: any) {
        this.logger.error('Weekly backup failed', { error: error?.message || 'Unknown error' });
      }
    });
  }

  private async onReady() {
    if (!this.client.user) return;
    
    this.logger.info(`🕊️ Bot ${this.client.user.tag} conectado - finalizando configuración...`);
    
    try {
      // Base documents are already loaded before Discord connection
      // Just get the final status for logging
      const status = await this.baseDocumentsLoader.checkBaseDocumentsStatus();
      const totalDocs = status.heresyAnalysis.count + status.sermons.count + status.generalLore.count;

      // Step 1: Register slash commands  
      this.logger.info('⚔️  Registrando comandos...');
      await this.slashCommandManager.registerSlashCommands();
      this.logger.info('✅ Comandos registrados exitosamente');

      // Step 2: Set bot activity
      this.client.user.setActivity('🔍 Vigilando por herejía | /help', { 
        type: ActivityType.Watching 
      });

      // Step 3: Final initialization complete
      this.logger.capellan(`🕊️ Bot Capellán completamente operativo - Ave Imperator!`);
      this.logger.info('📊 Estadísticas del bot', {
        guilds: this.client.guilds.cache.size,
        users: this.client.users.cache.size,
        channels: this.client.channels.cache.size,
        baseDocuments: totalDocs
      });

      // Final success message
      console.log('\n✅ Bot Capellán listo para servir al Emperador! 🕊️⚡👑\n');

    } catch (error: any) {
      this.logger.error('❌ Error crítico durante la finalización', { 
        error: error?.message || 'Unknown error' 
      });
      console.log('\n❌ Bot Capellán falló en la finalización - revisando logs...\n');
      process.exit(1); // Exit if initialization fails
    }
  }

  private async onMessageCreate(message: any) {
    try {
      // Verificar que el mensaje sea válido
      if (!message || !message.author || message.author.bot) {
        return;
      }

      // Manejar comandos de forma asíncrona sin bloquear
      setImmediate(async () => {
        try {
          await this.commandManager.handleCommand(message);
          await this.heresyDetector.checkMessage(message);
          
          if (!message.content.startsWith('!')) {
            await this.gamificationService.recordMessage(message.author.id);
          }
        } catch (error: any) {
          this.logger.error('Error processing message', {
            error: error?.message || 'Unknown error',
            messageId: message?.id,
            userId: message?.author?.id,
            channelId: message?.channel?.id
          });
        }
      });
      
    } catch (error: any) {
      this.logger.error('Error in onMessageCreate', {
        error: error?.message || 'Unknown error'
      });
    }
  }

  private async onInteractionCreate(interaction: any) {
    try {
      // Solo manejar comandos slash
      if (interaction && typeof interaction.isCommand === 'function' && interaction.isCommand()) {
        setImmediate(async () => {
          try {
            await this.commandManager.handleSlashCommand(interaction);
          } catch (error: any) {
            this.logger.error('Error processing interaction', {
              error: error?.message || 'Unknown error',
              interactionId: interaction?.id,
              userId: interaction?.user?.id,
              channelId: interaction?.channelId
            });
          }
        });
      }
    } catch (error: any) {
      this.logger.error('Error in onInteractionCreate', {
        error: error?.message || 'Unknown error'
      });
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Iniciando servicios del Capellán...');
      
      // Initialize RAG system first
      this.logger.info('Inicializando sistema RAG...');
      await this.initializeRAGSystem();
      
      // Initialize base documents BEFORE connecting to Discord
      this.logger.info('📝 Inicializando documentos base...');
      await this.baseDocumentsLoader.initializeBaseDocuments();
      
      // Wait for database transactions to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify base documents were loaded
      const status = await this.baseDocumentsLoader.checkBaseDocumentsStatus();
      const totalDocs = status.heresyAnalysis.count + status.sermons.count + status.generalLore.count;
      
      if (totalDocs > 0) {
        this.logger.info(`✅ Documentos base cargados correctamente`, {
          totalDocuments: totalDocs,
          heresyAnalysis: status.heresyAnalysis.count,
          sermons: status.sermons.count,
          generalLore: status.generalLore.count
        });
      } else {
        this.logger.warn('⚠️  No se encontraron documentos base en la base de datos');
        throw new Error('Base documents not loaded - bot cannot function properly');
      }
      
      // Now connect to Discord (this will trigger onReady when successful)
      this.logger.info('Conectando a Discord...');
      await this.client.login(process.env.DISCORD_TOKEN!);
      
      // Success message is now handled in onReady() after full initialization
      
    } catch (error: any) {
      this.logger.error('Failed to start bot', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private async initializeRAGSystem(): Promise<void> {
    this.logger.info('Initializing RAG system...');
    
    try {
      // The RAG system is initialized automatically
      // This is where we could load initial documents or verify the database
      const stats = this.ragSystem.getStats();
      
      this.logger.info('RAG system initialized', {
        documents: stats.documents,
        embeddings: stats.embeddings,
        sources: stats.sources.length
      });
      
      if (stats.documents === 0) {
        this.logger.warn('No documents found in RAG system. Inquisitors should add knowledge using !capellan agregar');
      }
      
    } catch (error: any) {
      this.logger.error('RAG system initialization failed', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private async shutdown(): Promise<void> {
    this.logger.info('Shutting down Capellan Bot...');
    
    try {
      // Close RAG system
      await this.ragSystem.close();
      
      // Destroy Discord client
      this.client.destroy();
      
      this.logger.capellan('Bot desconectado - El Emperador protege');
      
      process.exit(0);
    } catch (error: any) {
      this.logger.error('Error during shutdown', { error: error?.message || 'Unknown error' });
      process.exit(1);
    }
  }

  // Utility methods for external access
  getClient(): Client {
    return this.client;
  }

  getRAGSystem(): RAGSystem {
    return this.ragSystem;
  }

  getInquisitorService(): InquisitorService {
    return this.inquisitorService;
  }

  getStats() {
    return {
      bot: {
        uptime: this.client.uptime,
        guilds: this.client.guilds.cache.size,
        users: this.client.users.cache.size,
        channels: this.client.channels.cache.size
      },
      rag: this.ragSystem.getStats(),
      inquisitors: this.inquisitorService.getInquisitorCount()
    };
  }
}