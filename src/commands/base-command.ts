
import { Message } from 'discord.js';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';

export abstract class BaseCommand {
  protected logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  abstract name: string;
  abstract description: string;
  abstract aliases: string[];
  abstract requiresInquisitor: boolean;

  abstract execute(message: Message, args: string[], context: CommandContext): Promise<void>;

  protected createContext(message: Message, isInquisitor: boolean): CommandContext {
    return {
      isInquisitor,
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channel.id,
      guildId: message.guild?.id
    };
  }

  protected extractUserIdFromMention(mention: string): string {
    return mention.replace(/[<@!>]/g, '');
  }

  protected async sendLoadingMessage(message: Message, text: string = '🔍 *Procesando...*') {
    return await message.reply(text);
  }

  protected logCommand(context: CommandContext, command: string, args: string[]) {
    this.logger.info(`Command executed: ${command}`, {
      userId: context.userId,
      username: context.username,
      args: args.length > 0 ? args : undefined,
      channelId: context.channelId,
      guildId: context.guildId,
      isInquisitor: context.isInquisitor
    });
  }
}