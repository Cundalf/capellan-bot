import { EmbedBuilder, type Message } from 'discord.js';
import type { RAGSystem } from '@/services/rag-system';
import type { CommandContext } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import { BaseCommand } from './base-command';

export class SearchCommand extends BaseCommand {
  name = 'buscar';
  description = 'Busca información específica en los documentos sagrados';
  aliases = ['search', 'find'];
  requiresInquisitor = false;

  private ragSystem: RAGSystem;

  constructor(logger: Logger, ragSystem: RAGSystem) {
    super(logger);
    this.ragSystem = ragSystem;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);
    const query = args.join(' ');

    if (!query) {
      const helpEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('🔍 Búsqueda en Archivos Sagrados')
        .setDescription('*Busca información específica en los documentos imperiales.*')
        .addFields(
          { name: '📖 Uso', value: '`!capellan buscar [término de búsqueda]`', inline: false },
          {
            name: '💡 Ejemplos',
            value:
              '`!capellan buscar Emperador de la Humanidad`\n`!capellan buscar Space Marines`\n`!capellan buscar Warp`',
            inline: false,
          }
        )
        .setFooter({ text: 'El conocimiento es poder' });

      await message.reply({ embeds: [helpEmbed] });
      return;
    }

    if (query.length < 3) {
      await message.reply('*El término de búsqueda debe tener al menos 3 caracteres.*');
      return;
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.BLUE)
      .setDescription('🔍 *Buscando en los archivos sagrados...*')
      .setFooter({ text: 'Consultando documentos imperiales' });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      const result = await this.ragSystem.generateCapellanResponse(query, 'knowledge_search');

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.BLUE)
        .setTitle('📚 Resultados de Búsqueda')
        .setDescription(result.response)
        .addFields({ name: '🔎 Consulta', value: `"${query}"`, inline: false })
        .setTimestamp()
        .setFooter({ text: 'Archivos Imperiales' });

      if (result.sources.length > 0) {
        const sourcesText = result.sources
          .slice(0, 5)
          .map(
            (source, index) =>
              `${index + 1}. ${source.source} (${Math.round(source.similarity * 100)}% relevancia)`
          )
          .join('\n');

        embed.addFields({
          name: '📖 Fuentes Consultadas',
          value: sourcesText,
          inline: false,
        });
      } else {
        embed.addFields({
          name: '⚠️ Nota',
          value: 'No se encontraron documentos específicos. Respuesta basada en conocimiento base.',
          inline: false,
        });
      }

      await loadingMsg.edit({ embeds: [embed] });

      this.logger.info('Search performed', {
        userId: context.userId,
        query: query.substring(0, 100),
        sourcesFound: result.sources.length,
        tokensUsed: result.tokensUsed,
      });
    } catch (error: any) {
      this.logger.error('Search failed', {
        error: error?.message || 'Unknown error',
        query,
        userId: context.userId,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('❌ Error en Búsqueda')
        .setDescription(
          '*Los espíritus de la máquina no responden. Los archivos sagrados están temporalmente inaccesibles.*'
        )
        .setFooter({ text: 'Error reportado al Adeptus Mechanicus' });

      await loadingMsg.edit({ embeds: [errorEmbed] });
    }
  }
}
