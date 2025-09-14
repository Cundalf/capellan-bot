import { ActivityType, type Client } from 'discord.js';
import type { Logger } from '@/utils/logger';
import type { BaseDocumentsLoader } from '../base-documents-loader';
import type { SlashCommandManager } from '../slash-command-manager';

export class InitializationHandler {
  constructor(
    private client: Client,
    private logger: Logger,
    private slashCommandManager: SlashCommandManager,
    private baseDocumentsLoader: BaseDocumentsLoader
  ) {}

  async completeInitialization(): Promise<void> {
    if (!this.client.user) return;

    try {
      await this.logDocumentsStatus();
      await this.registerCommands();
      this.setBotActivity();
      await this.logFinalStats();
      this.logSuccessMessage();
    } catch (error: any) {
      this.handleInitializationError(error);
    }
  }

  private async logDocumentsStatus(): Promise<void> {
    const status = await this.baseDocumentsLoader.checkBaseDocumentsStatus();
    const totalDocs = status.heresyAnalysis.count + status.sermons.count + status.generalLore.count;

    this.logger.info('📊 Base documents status', {
      totalDocuments: totalDocs,
      heresyAnalysis: status.heresyAnalysis.count,
      sermons: status.sermons.count,
      generalLore: status.generalLore.count,
    });
  }

  private async registerCommands(): Promise<void> {
    this.logger.info('⚔️  Registrando comandos...');
    await this.slashCommandManager.registerSlashCommands();
    this.logger.info('✅ Comandos registrados exitosamente');
  }

  private setBotActivity(): void {
    this.client.user!.setActivity('🔍 Vigilando por herejía | /help', {
      type: ActivityType.Watching,
    });
  }

  private async logFinalStats(): Promise<void> {
    const status = await this.baseDocumentsLoader.checkBaseDocumentsStatus();
    const totalDocs = status.heresyAnalysis.count + status.sermons.count + status.generalLore.count;

    this.logger.capellan('🕊️ Bot Capellán completamente operativo - Ave Imperator!');
    this.logger.info('📊 Estadísticas del bot', {
      guilds: this.client.guilds.cache.size,
      users: this.client.users.cache.size,
      channels: this.client.channels.cache.size,
      baseDocuments: totalDocs,
    });
  }

  private logSuccessMessage(): void {
    console.log('\n✅ Bot Capellán listo para servir al Emperador! 🕊️⚡👑\n');
  }

  private handleInitializationError(error: any): void {
    this.logger.error('❌ Error crítico durante la finalización', {
      error: error?.message || 'Unknown error',
    });
    console.log('\n❌ Bot Capellán falló en la finalización - revisando logs...\n');
    process.exit(1);
  }
}
