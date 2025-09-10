
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { RAGSystem } from '@/services/rag-system';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';

export class SourcesCommand extends BaseCommand {
  name = 'fuentes';
  description = 'Lista todas las fuentes de conocimiento disponibles';
  aliases = ['sources'];
  requiresInquisitor = false;

  private ragSystem: RAGSystem;

  constructor(logger: Logger, ragSystem: RAGSystem) {
    super(logger);
    this.ragSystem = ragSystem;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    try {
      const stats = this.ragSystem.getStats();
      
      if (stats.sources.length === 0) {
        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.ORANGE)
          .setTitle('📚 Archivos Sagrados')
          .setDescription('*No hay fuentes de conocimiento disponibles. Los Inquisidores pueden agregar documentos usando el comando `agregar`.*')
          .setFooter({ text: 'Base de conocimiento vacía' });

        await message.reply({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.BLUE)
        .setTitle('📚 Fuentes de Conocimiento Imperial')
        .setDescription('*Lista completa de documentos sagrados disponibles:*')
        .addFields(
          { name: '📊 Resumen', value: `**${stats.documents}** fragmentos de ${stats.sources.length} fuentes`, inline: false }
        );

      if (Object.keys(stats.types).length > 0) {
        const typesText = Object.entries(stats.types)
          .map(([type, count]) => `**${type}**: ${count}`)
          .join(' • ');
        
        embed.addFields({ name: '📋 Tipos de Contenido', value: typesText, inline: false });
      }

      const itemsPerPage = 15;
      const page = parseInt(args[0]) || 1;
      const startIndex = (page - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const totalPages = Math.ceil(stats.sources.length / itemsPerPage);

      const sourcesList = stats.sources
        .slice(startIndex, endIndex)
        .map((source, index) => {
          const num = startIndex + index + 1;
          const truncated = this.truncateSource(source);
          return `${num}. ${truncated}`;
        })
        .join('\n');

      embed.addFields({ 
        name: `📖 Fuentes (Página ${page}/${totalPages})`, 
        value: sourcesList || '*No hay fuentes en esta página*', 
        inline: false 
      });

      if (totalPages > 1) {
        embed.addFields({
          name: '📄 Navegación',
          value: `Usa \`!capellan fuentes [página]\` para ver otras páginas\nEjemplo: \`!capellan fuentes 2\``,
          inline: false
        });
      }

      embed.setTimestamp().setFooter({ 
        text: `Archivos Imperiales | Página ${page}/${totalPages}` 
      });

      await message.reply({ embeds: [embed] });

      this.logger.info('Sources listed', {
        userId: context.userId,
        totalSources: stats.sources.length,
        page,
        totalPages
      });

    } catch (error: any) {
      this.logger.error('Error listing sources', { 
        error: error?.message || 'Unknown error', 
        userId: context.userId 
      });
      
      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription('*Error accediendo a la lista de fuentes. Los archivos sagrados están temporalmente inaccesibles.*')
        .setFooter({ text: 'Error reportado' });

      await message.reply({ embeds: [errorEmbed] });
    }
  }

  private truncateSource(source: string): string {
    if (source.length <= 60) return source;
    
    if (source.startsWith('http')) {
      try {
        const url = new URL(source);
        const path = url.pathname.length > 30 ? url.pathname.substring(0, 30) + '...' : url.pathname;
        return `${url.hostname}${path}`;
      } catch {
        return source.substring(0, 60) + '...';
      }
    }
    
    return source.substring(0, 60) + '...';
  }
}