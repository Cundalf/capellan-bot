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
import { SteamOffersService } from './steam-offers-service';
import { SermonService } from './sermon-service';
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
  private steamOffersService!: SteamOffersService;
  private sermonService!: SermonService;

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
    this.steamOffersService = new SteamOffersService(this.logger, this.config);
    this.sermonService = new SermonService(this.logger, this.ragSystem);
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
    // Daily sermon at 19:40 (7:40 PM)
    cron.schedule('40 19 * * *', async () => {
      this.logger.info('Daily sermon cron triggered at Imperial Hour');
      await this.sendDailySermon();
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

    // Steam offers check - runs every X hours based on config
    const checkInterval = this.config.steamOffersCheckInterval;
    const cronExpression = `0 */${checkInterval} * * *`; // Every X hours
    
    cron.schedule(cronExpression, async () => {
      this.logger.info('Steam offers check triggered');
      await this.checkAndNotifyOffers();
    });

    this.logger.info('Cron jobs configured', {
      dailySermon: '19:40 daily',
      sermonChannel: this.config.sermonChannelId || 'NOT CONFIGURED',
      steamOffersInterval: `Every ${checkInterval} hours`,
      steamOffersChannel: this.config.steamOffersChannelId || 'NOT CONFIGURED'
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

      // Initial Steam offers check if configured
      if (this.config.steamOffersChannelId) {
        this.logger.info('Performing initial Steam offers check...');
        // Delay a bit to ensure everything is ready
        setTimeout(async () => {
          await this.checkAndNotifyOffers();
        }, 5000); // 5 seconds delay
      }

      // Check if we missed today's sermon on startup
      if (this.config.sermonChannelId) {
        this.logger.info('Checking for missed daily sermon on startup...');
        setTimeout(async () => {
          await this.checkMissedSermon();
        }, 6000); // 6 seconds delay, after steam offers
      }

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

  private async checkAndNotifyOffers(): Promise<void> {
    try {
      // Skip if no channel configured
      if (!this.config.steamOffersChannelId) {
        this.logger.debug('Steam offers channel not configured, skipping check');
        return;
      }

      this.logger.info('Checking for new Steam Warhammer offers...');
      
      const newOffers = await this.steamOffersService.checkForNewOffers();
      
      if (newOffers.length === 0) {
        this.logger.info('No new Warhammer offers found');
        return;
      }

      this.logger.info(`Found ${newOffers.length} new Warhammer offers, sending notification`);

      // Get the notification channel
      const channel = await this.client.channels.fetch(this.config.steamOffersChannelId);
      
      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        this.logger.error('Steam offers channel not found or not text-based', {
          channelId: this.config.steamOffersChannelId
        });
        return;
      }

      // Create and send embeds
      const embeds = this.steamOffersService.createOfferEmbeds(newOffers);
      
      // Send embeds in chunks (Discord limit is 10 embeds per message)
      const maxEmbedsPerMessage = 10;
      for (let i = 0; i < embeds.length; i += maxEmbedsPerMessage) {
        const chunk = embeds.slice(i, i + maxEmbedsPerMessage);
        await channel.send({ embeds: chunk });
        
        // Small delay between messages if sending multiple chunks
        if (i + maxEmbedsPerMessage < embeds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Mark offers as notified
      this.steamOffersService.markOffersAsNotified(newOffers);

      this.logger.info('Steam offers notification sent successfully', {
        offersCount: newOffers.length,
        embedsCount: embeds.length,
        channelId: this.config.steamOffersChannelId
      });

    } catch (error: any) {
      this.logger.error('Error in Steam offers notification', {
        error: error?.message || 'Unknown error',
        stack: error?.stack
      });
    }
  }

  private async sendDailySermon(): Promise<void> {
    try {
      // Skip if no sermon channel configured
      if (!this.config.sermonChannelId) {
        this.logger.debug('Sermon channel not configured, skipping daily sermon');
        return;
      }

      // Check if sermon was already sent today
      if (this.sermonService.hasSermonBeenSentToday()) {
        this.logger.info('Daily sermon already sent today, skipping to prevent duplicate');
        return;
      }

      this.logger.info('Generating and sending daily sermon...');

      // Generate the sermon
      const sermonResult = await this.sermonService.generateDailySermon();

      // Get the sermon channel
      const channel = await this.client.channels.fetch(this.config.sermonChannelId);

      if (!channel || !channel.isTextBased() || !('send' in channel)) {
        this.logger.error('Sermon channel not found or not text-based', {
          channelId: this.config.sermonChannelId
        });
        return;
      }

      // Send the sermon
      await channel.send(sermonResult.sermon);

      // Mark sermon as sent for today
      this.sermonService.markSermonAsSent(sermonResult.topic);

      this.logger.info('Daily sermon sent successfully', {
        channelId: this.config.sermonChannelId,
        sermonLength: sermonResult.sermon.length,
        topic: sermonResult.topic
      });

    } catch (error: any) {
      this.logger.error('Error sending daily sermon', {
        error: error?.message || 'Unknown error',
        stack: error?.stack
      });
    }
  }

  private async checkMissedSermon(): Promise<void> {
    try {
      // Skip if no sermon channel configured
      if (!this.config.sermonChannelId) {
        return;
      }

      // If sermon was already sent today, nothing to do
      if (this.sermonService.hasSermonBeenSentToday()) {
        this.logger.debug('Daily sermon already sent today, no missed sermon');
        return;
      }

      // Check if current time is past 19:40
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const sermonTime = 19 * 60 + 40; // 19:40 in minutes
      const currentTime = currentHour * 60 + currentMinute;

      if (currentTime >= sermonTime) {
        this.logger.info('Bot startup detected missed sermon for today, sending now...');
        await this.sendDailySermon();
      } else {
        this.logger.debug('Current time is before 19:40, sermon will be sent at scheduled time', {
          currentTime: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
          sermonTime: '19:40'
        });
      }

    } catch (error: any) {
      this.logger.error('Error checking for missed sermon', {
        error: error?.message || 'Unknown error',
        stack: error?.stack
      });
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

  getSteamOffersService(): SteamOffersService {
    return this.steamOffersService;
  }

  getSermonService(): SermonService {
    return this.sermonService;
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
      inquisitors: this.inquisitorService.getInquisitorCount(),
      steamOffers: this.steamOffersService.getStats()
    };
  }
}