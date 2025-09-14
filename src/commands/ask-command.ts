import { type CommandInteraction, EmbedBuilder, type Message } from 'discord.js';
import type { RAGSystem } from '@/services/rag-system';
import type { CommandContext } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import { BaseCommand } from './base-command';

export class AskCommand extends BaseCommand {
  name = 'preguntar';
  description = 'Hace una pregunta al Capellán sobre el lore de Warhammer 40k';
  aliases = ['ask', 'pregunta', 'question'];
  requiresInquisitor = false;

  private ragSystem: RAGSystem;

  constructor(logger: Logger, ragSystem: RAGSystem) {
    super(logger);
    this.ragSystem = ragSystem;
  }

  async execute(
    message: Message | CommandInteraction,
    args: string[],
    context: CommandContext
  ): Promise<void> {
    this.logCommand(context, this.name, args);

    const question = args.join(' ');

    if (!question) {
      const helpEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('❓ Pregunta al Capellán')
        .setDescription('*Consulta al Capellán sobre cualquier aspecto del lore de Warhammer 40k.*')
        .addFields(
          {
            name: '💬 Slash Command',
            value: '`/preguntar pregunta: [tu pregunta]`',
            inline: false,
          },
          { name: '💬 Prefijo', value: '`!capellan preguntar [tu pregunta]`', inline: false },
          {
            name: '💡 Ejemplos',
            value:
              '`/preguntar pregunta: ¿Quién es el Emperador?`\n`!capellan preguntar ¿Qué son los Space Marines?`\n`!capellan preguntar Cuéntame sobre la Herejía de Horus`',
            inline: false,
          }
        )
        .setFooter({ text: 'El conocimiento es poder, úsalo bien' });

      await this.sendResponse(message, { embeds: [helpEmbed] });
      return;
    }

    if (question.length < 5) {
      await this.sendResponse(
        message,
        '*Tu pregunta debe ser más específica, hermano. Al menos 5 caracteres.*'
      );
      return;
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.BLUE)
      .setDescription('🤔 *Consultando los archivos sagrados y reflexionando...*')
      .setFooter({ text: 'El Capellán medita sobre tu pregunta' });

    const loadingMsg = await this.sendResponse(message, { embeds: [loadingEmbed] });

    try {
      // Use the 'questions' command type which searches across all collections
      const result = await this.ragSystem.generateCapellanResponse(question, 'questions');

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('📚 Respuesta del Capellán')
        .setDescription(result.response)
        .addFields({
          name: '❓ Tu Pregunta',
          value: `"${question.substring(0, 200)}${question.length > 200 ? '...' : '"'}`,
          inline: false,
        })
        .setTimestamp()
        .setFooter({ text: 'Sabiduría Imperial' });

      // Add sources if available
      if (result.sources.length > 0) {
        const sourcesText = result.sources
          .slice(0, 5)
          .map((source, index) => {
            const sourceType = this.getSourceType(source.source);
            return `${index + 1}. ${sourceType} (${Math.round(source.similarity * 100)}% relevancia)`;
          })
          .join('\n');

        embed.addFields({
          name: '📖 Fuentes Consultadas',
          value: sourcesText,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '⚠️ Nota',
          value:
            'Respuesta basada en el conocimiento base del Capellán. Para mayor precisión, los Inquisidores pueden expandir la base de conocimientos.',
          inline: false,
        });
      }

      // Add recommendation for related commands
      const relatedCommands = this.getRelatedCommands(question);
      if (relatedCommands.length > 0) {
        embed.addFields({
          name: '💡 Comandos Relacionados',
          value: relatedCommands.join(' • '),
          inline: false,
        });
      }

      // For slash commands, we need to use followUp instead of edit
      if ('edit' in loadingMsg) {
        await loadingMsg.edit({ embeds: [embed] });
      } else {
        // For slash commands, we can't edit the original response, so we'll send a new one
        await this.sendResponse(message, { embeds: [embed] });
      }

      this.logger.info('Question answered', {
        userId: context.userId,
        question: question.substring(0, 100),
        sourcesFound: result.sources.length,
        tokensUsed: result.tokensUsed,
      });
    } catch (error: any) {
      this.logger.error('Failed to answer question', {
        error: error?.message || 'Unknown error',
        question,
        userId: context.userId,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('❌ Error del Servo-Cráneo')
        .setDescription(
          '*Los espíritus de la máquina no responden. Las runas sagradas están temporalmente inaccesibles.*\n\nIntenta de nuevo en unos momentos, o contacta a un Inquisidor si el problema persiste.'
        )
        .setFooter({ text: 'Error reportado al Adeptus Mechanicus' });

      // For slash commands, we need to use followUp instead of edit
      if ('edit' in loadingMsg) {
        await loadingMsg.edit({ embeds: [errorEmbed] });
      } else {
        // For slash commands, we can't edit the original response, so we'll send a new one
        await this.sendResponse(message, { embeds: [errorEmbed] });
      }
    }
  }

  private getSourceType(source: string): string {
    if (source.includes('base-heresy-analysis')) {
      return '📜 Doctrina Imperial';
    } else if (source.includes('base-sermons')) {
      return '🕊️ Sermones Sagrados';
    } else if (source.includes('base-general-lore')) {
      return '📚 Archivos del Lore';
    } else {
      return '📄 Conocimiento Agregado';
    }
  }

  private getRelatedCommands(question: string): string[] {
    const commands: string[] = [];
    const questionLower = question.toLowerCase();

    if (
      questionLower.includes('herej') ||
      questionLower.includes('caos') ||
      questionLower.includes('corrup')
    ) {
      commands.push('`!capellan herejia`');
    }

    if (
      questionLower.includes('sermon') ||
      questionLower.includes('orac') ||
      questionLower.includes('bendic')
    ) {
      commands.push('`!capellan sermon`');
    }

    if (questionLower.includes('buscar') || questionLower.includes('encontrar')) {
      commands.push('`!capellan buscar`');
    }

    if (
      questionLower.includes('emperador') ||
      questionLower.includes('imperio') ||
      questionLower.includes('fe')
    ) {
      commands.push('`!capellan credo`');
    }

    return commands.slice(0, 3); // Limit to 3 suggestions
  }
}
