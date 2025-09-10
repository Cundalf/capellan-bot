
import { Message, CommandInteraction } from 'discord.js';
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

  abstract execute(message: Message | CommandInteraction, args: string[], context: CommandContext): Promise<void>;

  protected createContext(message: Message, isInquisitor: boolean): CommandContext {
    return {
      isInquisitor,
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channel.id,
      guildId: message.guild?.id
    };
  }

  protected createContextFromInteraction(interaction: CommandInteraction, isInquisitor: boolean): CommandContext {
    return {
      isInquisitor,
      userId: interaction.user.id,
      username: interaction.user.username,
      channelId: interaction.channelId,
      guildId: interaction.guildId
    };
  }

  protected extractUserIdFromMention(mention: string): string {
    return mention.replace(/[<@!>]/g, '');
  }

  protected async sendLoadingMessage(message: Message | CommandInteraction, text: string = '🔍 *Procesando...*') {
    if ('reply' in message) {
      return await message.reply(text);
    } else {
      if (message.deferred) {
        return await message.followUp(text);
      } else {
        return await message.reply(text);
      }
    }
  }

  protected async sendResponse(message: Message | CommandInteraction, content: string | { embeds?: any[] }) {
    if ('reply' in message) {
      return await message.reply(content);
    } else {
      if (message.deferred) {
        return await message.followUp(content);
      } else {
        return await message.reply(content);
      }
    }
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