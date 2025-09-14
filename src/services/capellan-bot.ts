import { Client, GatewayIntentBits } from 'discord.js';
import { HeresyDetector } from '@/events/heresy-detector';
import { loadConfig, validateEnvironment } from '@/utils/config';
import { Logger } from '@/utils/logger';
import { BaseDocumentsLoader } from './base-documents-loader';
import { CommandManager } from './command-manager';
import { DocumentProcessor } from './document-processor';
import { GamificationService } from './gamification-service';
import { BotEventHandler } from './handlers/bot-event-handler';
import { CronJobHandler } from './handlers/cron-job-handler';
import { InitializationHandler } from './handlers/initialization-handler';
import { NotificationHandler } from './handlers/notification-handler';
import { InquisitorService } from './inquisitor-service';
import { RAGSystem } from './rag-system';
import { SermonService } from './sermon-service';
import { SlashCommandManager } from './slash-command-manager';
import { SteamOffersService } from './steam-offers-service';

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

  private eventHandler!: BotEventHandler;
  private cronHandler!: CronJobHandler;
  private initializationHandler!: InitializationHandler;
  private notificationHandler!: NotificationHandler;

  constructor() {
    validateEnvironment();
    this.logger = new Logger(this.config);
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.initializeServices();
    this.initializeHandlers();
    this.setupEvents();
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
    this.slashCommandManager = new SlashCommandManager(
      this.client,
      this.logger,
      this.commandManager
    );
    this.heresyDetector = new HeresyDetector(
      this.logger,
      this.ragSystem,
      this.commandManager,
      this.gamificationService
    );
  }

  private initializeHandlers(): void {
    this.eventHandler = new BotEventHandler(
      this.client,
      this.logger,
      this.commandManager,
      this.heresyDetector,
      this.gamificationService,
      () => this.onReady()
    );

    this.cronHandler = new CronJobHandler(
      this.logger,
      this.config,
      this.gamificationService,
      this.inquisitorService,
      () => this.notificationHandler.sendDailySermon(),
      () => this.notificationHandler.checkAndNotifyOffers()
    );

    this.initializationHandler = new InitializationHandler(
      this.client,
      this.logger,
      this.slashCommandManager,
      this.baseDocumentsLoader
    );

    this.notificationHandler = new NotificationHandler(
      this.client,
      this.logger,
      this.config,
      this.steamOffersService,
      this.sermonService
    );
  }

  private setupEvents(): void {
    this.eventHandler.setupEvents();
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private setupCronJobs(): void {
    this.cronHandler.setupCronJobs();
  }

  private async onReady(): Promise<void> {
    await this.initializationHandler.completeInitialization();
    await this.scheduleInitialChecks();
  }

  private async scheduleInitialChecks(): Promise<void> {
    if (this.config.steamOffersChannelId) {
      this.logger.info('Performing initial Steam offers check...');
      setTimeout(() => this.notificationHandler.checkAndNotifyOffers(), 5000);
    }

    if (this.config.sermonChannelId) {
      this.logger.info('Checking for missed daily sermon on startup...');
      setTimeout(() => this.notificationHandler.checkMissedSermon(), 6000);
    }
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Iniciando servicios del Capellán...');

      await this.initializeRAGSystem();
      await this.initializeBaseDocuments();

      this.logger.info('Conectando a Discord...');
      await this.client.login(process.env.DISCORD_TOKEN!);
    } catch (error: any) {
      this.logger.error('Failed to start bot', { error: error?.message || 'Unknown error' });
      throw error;
    }
  }

  private async initializeBaseDocuments(): Promise<void> {
    this.logger.info('📝 Inicializando documentos base...');
    await this.baseDocumentsLoader.initializeBaseDocuments();

    await new Promise((resolve) => setTimeout(resolve, 500));

    const status = await this.baseDocumentsLoader.checkBaseDocumentsStatus();
    const totalDocs = status.heresyAnalysis.count + status.sermons.count + status.generalLore.count;

    if (totalDocs > 0) {
      this.logger.info('✅ Documentos base cargados correctamente', {
        totalDocuments: totalDocs,
        heresyAnalysis: status.heresyAnalysis.count,
        sermons: status.sermons.count,
        generalLore: status.generalLore.count,
      });
    } else {
      this.logger.warn('⚠️  No se encontraron documentos base en la base de datos');
      throw new Error('Base documents not loaded - bot cannot function properly');
    }
  }

  private async initializeRAGSystem(): Promise<void> {
    this.logger.info('Inicializando sistema RAG...');

    try {
      const stats = this.ragSystem.getStats();

      this.logger.info('RAG system initialized', {
        documents: stats.documents,
        embeddings: stats.embeddings,
        sources: stats.sources.length,
      });

      if (stats.documents === 0) {
        this.logger.warn(
          'No documents found in RAG system. Inquisitors should add knowledge using !capellan agregar'
        );
      }
    } catch (error: any) {
      this.logger.error('RAG system initialization failed', {
        error: error?.message || 'Unknown error',
      });
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
        channels: this.client.channels.cache.size,
      },
      rag: this.ragSystem.getStats(),
      inquisitors: this.inquisitorService.getInquisitorCount(),
      steamOffers: this.steamOffersService.getStats(),
    };
  }
}
