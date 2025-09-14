import { EmbedBuilder, type Message } from 'discord.js';
import type { DocumentProcessor } from '@/services/document-processor';
import type { RAGSystem } from '@/services/rag-system';
import type { CommandContext } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import { BaseCommand } from './base-command';

export class KnowledgeCommand extends BaseCommand {
  name = 'agregar';
  description = 'Agrega conocimiento sagrado desde URLs (solo Inquisidores)';
  aliases = ['add', 'conocimiento'];
  requiresInquisitor = true;

  private documentProcessor: DocumentProcessor;
  private ragSystem: RAGSystem;

  constructor(logger: Logger, documentProcessor: DocumentProcessor, ragSystem: RAGSystem) {
    super(logger);
    this.documentProcessor = documentProcessor;
    this.ragSystem = ragSystem;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    if (!context.isInquisitor) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription(
          '🚫 *Solo un Inquisitor puede agregar conocimiento sagrado a los archivos.*'
        )
        .setFooter({ text: 'Acceso Denegado' });

      await message.reply({ embeds: [embed] });
      return;
    }

    const url = args[0];
    const subCommand = url?.toLowerCase();

    // Handle subcommands
    if (subCommand === 'texto' || subCommand === 'text') {
      await this.handleTextInput(message, args.slice(1), context);
      return;
    }
    if (subCommand === 'help' || !url) {
      await this.showHelp(message);
      return;
    }

    this.logCommand(context, this.name, args);
    await this.handleUrlDownload(message, url, context);
  }

  private async handleUrlDownload(
    message: Message,
    url: string,
    context: CommandContext
  ): Promise<void> {
    // Validate URL format
    try {
      new URL(url);
    } catch {
      await message.reply('*Proporciona una URL válida: `!capellan agregar https://ejemplo.com`*');
      return;
    }

    // Validate domain
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      const isAllowed = WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.some((allowed) =>
        domain.includes(allowed.toLowerCase())
      );

      if (!isAllowed) {
        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.RED)
          .setTitle('⛔ Dominio No Autorizado')
          .setDescription(
            `*Solo se permiten URLs de dominios sagrados aprobados por la Inquisición.*`
          )
          .addFields(
            {
              name: 'Dominios Permitidos',
              value: WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.join('\n'),
              inline: false,
            },
            { name: 'Dominio Proporcionado', value: domain, inline: false }
          )
          .setFooter({ text: 'Protocolos de Seguridad' });

        await message.reply({ embeds: [embed] });
        return;
      }
    } catch (error: any) {
      await message.reply('*Error validando la URL proporcionada.*');
      return;
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.ORANGE)
      .setDescription(
        '📥 *Descargando conocimiento sagrado...\nEsta operación puede tardar varios minutos.*'
      )
      .setFooter({ text: 'Procesando...' });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      await this.documentProcessor.downloadAndProcessUrl(url, context.username);

      const successEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GREEN)
        .setTitle('✅ CONOCIMIENTO AGREGADO')
        .setDescription(
          `*El conocimiento sagrado de la fuente proporcionada ha sido incorporado a los archivos doctrinales.*`
        )
        .addFields(
          { name: 'Fuente', value: url, inline: false },
          { name: 'Agregado por', value: context.username, inline: true },
          { name: 'Fecha', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Sabiduría Preservada' });

      await loadingMsg.edit({ embeds: [successEmbed] });

      this.logger.inquisitor('Conocimiento agregado exitosamente', {
        url,
        addedBy: context.username,
        userId: context.userId,
      });
    } catch (error: any) {
      this.logger.error('Error adding knowledge', {
        error: error?.message || 'Unknown error',
        url,
        userId: context.userId,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('❌ ERROR EN DESCARGA')
        .setDescription(
          `*Error procesando el conocimiento sagrado:*\n\n\`\`\`${error?.message || 'Unknown error'}\`\`\``
        )
        .addFields({
          name: 'Posibles Soluciones',
          value:
            '• Verificar que la URL sea accesible\n• Comprobar que wkhtmltopdf esté instalado\n• Intentar con una URL diferente',
          inline: false,
        })
        .setFooter({ text: 'Operación Fallida' });

      await loadingMsg.edit({ embeds: [errorEmbed] });
    }
  }

  private async handleTextInput(
    message: Message,
    args: string[],
    context: CommandContext
  ): Promise<void> {
    const textContent = args.join(' ');

    if (!textContent || textContent.length < 100) {
      await message.reply(
        '*Proporciona texto suficiente (mínimo 100 caracteres): `!capellan agregar texto [contenido]`*'
      );
      return;
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.ORANGE)
      .setDescription('📄 *Procesando texto proporcionado...*')
      .setFooter({ text: 'Analizando contenido' });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      const source = `Texto directo - ${context.username} - ${new Date().toISOString()}`;
      await this.documentProcessor.processTextDocument(textContent, source, context.username);

      const successEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GREEN)
        .setTitle('✅ TEXTO PROCESADO')
        .setDescription(
          `*El conocimiento proporcionado ha sido incorporado a los archivos doctrinales.*`
        )
        .addFields(
          { name: 'Caracteres procesados', value: textContent.length.toString(), inline: true },
          { name: 'Agregado por', value: context.username, inline: true },
          { name: 'Fecha', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Conocimiento Preservado' });

      await loadingMsg.edit({ embeds: [successEmbed] });

      this.logger.inquisitor('Texto procesado exitosamente', {
        textLength: textContent.length,
        addedBy: context.username,
        userId: context.userId,
      });
    } catch (error: any) {
      this.logger.error('Error processing text', {
        error: error?.message || 'Unknown error',
        userId: context.userId,
      });

      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('❌ ERROR PROCESANDO TEXTO')
        .setDescription(
          `*Error incorporando el conocimiento:*\n\n\`\`\`${error?.message || 'Unknown error'}\`\`\``
        )
        .setFooter({ text: 'Operación Fallida' });

      await loadingMsg.edit({ embeds: [errorEmbed] });
    }
  }

  private async showHelp(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('📚 Agregar Conocimiento Sagrado')
      .setDescription('*Comandos para incorporar sabiduría a los archivos imperiales:*')
      .addFields(
        {
          name: '🌐 Descargar URL',
          value: '`!capellan agregar [URL]`\nDescarga y procesa una página web',
          inline: false,
        },
        {
          name: '📄 Texto directo',
          value: '`!capellan agregar texto [contenido]`\nProcesa texto proporcionado directamente',
          inline: false,
        },
        {
          name: '⚠️ Dominios Permitidos',
          value: WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.join('\n'),
          inline: false,
        }
      )
      .setFooter({ text: 'Solo Inquisidores - El Emperador Protege' });

    await message.reply({ embeds: [embed] });
  }
}
