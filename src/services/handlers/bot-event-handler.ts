import { type Client, Events } from 'discord.js';
import type { HeresyDetector } from '@/events/heresy-detector';
import type { Logger } from '@/utils/logger';
import type { CommandManager } from '../command-manager';
import type { GamificationService } from '../gamification-service';

export class BotEventHandler {
  constructor(
    private client: Client,
    private logger: Logger,
    private commandManager: CommandManager,
    private heresyDetector: HeresyDetector,
    private gamificationService: GamificationService,
    private onReady?: () => Promise<void>
  ) {}

  setupEvents(): void {
    this.client.on(Events.ClientReady, () => this.handleReady());
    this.client.on(Events.MessageCreate, (message) => this.handleMessage(message));
    this.client.on(Events.InteractionCreate, (interaction) => this.handleInteraction(interaction));
    this.client.on(Events.Error, (error) => this.handleError(error));
    this.client.on(Events.Warn, (warning) => this.handleWarning(warning));
  }

  private async handleReady(): Promise<void> {
    if (this.onReady) {
      await this.onReady();
    }
  }

  private async handleMessage(message: any): Promise<void> {
    if (!this.isValidMessage(message)) return;

    setImmediate(async () => {
      try {
        await Promise.all([
          this.commandManager.handleCommand(message),
          this.heresyDetector.checkMessage(message),
        ]);

        if (!message.content.startsWith('!')) {
          await this.gamificationService.recordMessage(message.author.id);
        }
      } catch (error) {
        this.logMessageError(error, message);
      }
    });
  }

  private async handleInteraction(interaction: any): Promise<void> {
    if (!this.isSlashCommand(interaction)) return;

    setImmediate(async () => {
      try {
        await this.commandManager.handleSlashCommand(interaction);
      } catch (error) {
        this.logInteractionError(error, interaction);
      }
    });
  }

  private handleError(error: Error): void {
    this.logger.error('Discord client error', { error: error.message });
  }

  private handleWarning(warning: string): void {
    this.logger.warn('Discord client warning', { warning });
  }

  private isValidMessage(message: any): boolean {
    return message && message.author && !message.author.bot;
  }

  private isSlashCommand(interaction: any): boolean {
    return interaction && typeof interaction.isCommand === 'function' && interaction.isCommand();
  }

  private logMessageError(error: any, message: any): void {
    this.logger.error('Error processing message', {
      error: error?.message || 'Unknown error',
      messageId: message?.id,
      userId: message?.author?.id,
      channelId: message?.channel?.id,
    });
  }

  private logInteractionError(error: any, interaction: any): void {
    this.logger.error('Error processing interaction', {
      error: error?.message || 'Unknown error',
      interactionId: interaction?.id,
      userId: interaction?.user?.id,
      channelId: interaction?.channelId,
    });
  }
}
