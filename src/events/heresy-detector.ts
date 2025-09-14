import type { Message } from 'discord.js';
import type { CommandManager } from '@/services/command-manager';
import type { GamificationService } from '@/services/gamification-service';
import type { RAGSystem } from '@/services/rag-system';
import { loadConfig } from '@/utils/config';
import { WARHAMMER_CONSTANTS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';

export class HeresyDetector {
  private logger: Logger;
  private ragSystem: RAGSystem;
  private commandManager: CommandManager;
  private gamificationService: GamificationService;
  private config = loadConfig();

  constructor(
    logger: Logger,
    ragSystem: RAGSystem,
    commandManager: CommandManager,
    gamificationService: GamificationService
  ) {
    this.logger = logger;
    this.ragSystem = ragSystem;
    this.commandManager = commandManager;
    this.gamificationService = gamificationService;
  }

  async checkMessage(message: Message): Promise<void> {
    // Skip bots and commands
    if (message.author.bot) return;
    if (this.isCommand(message.content)) return;

    // Check for heretical keywords
    const containsKeyword = this.containsHereticalKeywords(message.content);

    if (containsKeyword && this.shouldTriggerDetection()) {
      // Random delay to make it feel more natural
      const delay = Math.random() * 3000 + 1000; // 1-4 seconds

      setTimeout(async () => {
        try {
          await this.performHeresyAnalysis(message);
        } catch (error: any) {
          this.logger.error('Auto heresy detection failed', {
            error: error.message,
            messageId: message.id,
            channelId: message.channel.id,
          });
        }
      }, delay);
    }
  }

  private isCommand(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return lowerContent.startsWith('!capellan') || lowerContent.startsWith('!c');
  }

  private containsHereticalKeywords(content: string): boolean {
    const lowerContent = content.toLowerCase();

    return WARHAMMER_CONSTANTS.HERETICAL_KEYWORDS.some((keyword) =>
      lowerContent.includes(keyword.toLowerCase())
    );
  }

  private shouldTriggerDetection(): boolean {
    return Math.random() < this.config.autoHeresyDetectionChance;
  }

  private async performHeresyAnalysis(message: Message): Promise<void> {
    this.logger.heresy('Auto-detección activada', {
      messageId: message.id,
      userId: message.author.id,
      channelId: message.channel.id,
      contentLength: message.content.length,
    });

    const heresyCommand = this.commandManager.getCommand('herejia');

    if (heresyCommand) {
      const context = {
        isInquisitor: false,
        userId: message.author.id,
        username: message.author.username,
        channelId: message.channel.id,
        guildId: message.guild?.id,
      };

      await this.gamificationService.getOrCreateProfile(message.author.id, message.author.username);
      await heresyCommand.execute(message, [message.content], context);
    }
  }

  // Method to add custom heretical keywords (for Inquisitors)
  addHereticalKeyword(keyword: string): void {
    // This would need to be implemented with persistent storage
    this.logger.inquisitor('Custom heretical keyword would be added', { keyword });
  }

  // Method to remove heretical keywords (for Inquisitors)
  removeHereticalKeyword(keyword: string): void {
    // This would need to be implemented with persistent storage
    this.logger.inquisitor('Custom heretical keyword would be removed', { keyword });
  }
}
