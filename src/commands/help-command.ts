import { type CommandInteraction, EmbedBuilder, type Message } from 'discord.js';
import type { InquisitorService } from '@/services/inquisitor-service';
import type { CommandContext } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import { BaseCommand } from './base-command';

export class HelpCommand extends BaseCommand {
  name = 'help';
  description = 'Muestra ayuda sobre los comandos disponibles';
  aliases = ['ayuda', 'comandos'];
  requiresInquisitor = false;

  private inquisitorService: InquisitorService;

  constructor(logger: Logger, inquisitorService: InquisitorService) {
    super(logger);
    this.inquisitorService = inquisitorService;
  }

  async execute(
    message: Message | CommandInteraction,
    args: string[],
    context: CommandContext
  ): Promise<void> {
    this.logCommand(context, this.name, args);

    if (context.isInquisitor) {
      // For Inquisitors: respond with secrecy message and DM admin commands
      const publicEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('👁️ Secretos del Capellán')
        .setDescription(
          '*Los secretos del Imperio no son para oídos comunes, Inquisidor. Consultad vuestros canales privados.*'
        )
        .setTimestamp()
        .setFooter({ text: 'El Emperador ve todo' });

      await this.sendResponse(message, { embeds: [publicEmbed] });

      // Send admin commands via DM
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.GOLD)
          .setTitle('👁️ Comandos de Inquisidor')
          .setDescription(`*Comandos reservados para aquellos con autoridad imperial:*

**Prefijo:** \`!capellan\` o \`!c\``)
          .addFields(
            {
              name: '🔗 Agregar Conocimiento',
              value: '`agregar [URL/texto]` - Descargar y agregar doctrina sagrada',
              inline: false,
            },
            {
              name: '⚖️ Penitencia',
              value: '`penitencia [@usuario] [horas] [razón]` - Asignar penitencia',
              inline: false,
            },
            {
              name: '👁️ Inquisidores',
              value: '`inquisidor [subcomando]` - Gestión de administradores',
              inline: false,
            },
            {
              name: '🔥 Purgar',
              value: '`purgar` - Reconstruir índice de conocimiento',
              inline: false,
            },
            {
              name: '📊 Estadísticas',
              value: '`stats` - Ver estado del sistema y base de conocimiento',
              inline: false,
            },
            {
              name: '⚙️ Admin',
              value: '`admin [subcomando]` - Herramientas avanzadas (Supremos)',
              inline: false,
            }
          )
          .setTimestamp()
          .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION });

        const user = 'author' in message ? message.author : message.user;
        await user.send({ embeds: [dmEmbed] });
      } catch (error) {
        // If DM fails, send a follow-up message
        await this.sendResponse(
          message,
          '*No puedo enviarte mensajes privados, Inquisidor. Verifica tu configuración.*'
        );
      }
      return;
    }

    // For regular users: show normal help
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('📜 Comandos del Capellán')
      .setDescription(`*En nombre del Emperador, estos son los comandos disponibles:*

**Slash Commands:** \`/help\`, \`/herejia\`, \`/sermon\`, \`/buscar\`, etc.
**Prefijo:** \`!capellan\` o \`!c\` (comandos tradicionales)`)
      .addFields(
        {
          name: '🔍 Análisis de Herejía',
          value: '`herejia [mensaje]` - Examinar un mensaje en busca de corrupción',
          inline: false,
        },
        {
          name: '📖 Sermón',
          value: '`sermon [tema]` - Recibir bendición y guía espiritual',
          inline: false,
        },
        {
          name: '🕊️ Bendición',
          value: '`bendicion [@usuario]` - Otorgar bendición imperial',
          inline: false,
        },
        {
          name: '📜 Credo',
          value: '`credo` - Recitar el Credo Imperial',
          inline: false,
        },
        {
          name: '🔍 Búsqueda',
          value: '`buscar [término]` - Buscar en documentos sagrados',
          inline: false,
        },
        {
          name: '🏆 Ranking',
          value: '`ranking [subcomando]` - Ver rankings y perfiles',
          inline: false,
        },
        {
          name: '📚 Fuentes',
          value: '`fuentes` - Listar documentos disponibles',
          inline: false,
        }
      )
      .addFields(
        {
          name: '🎯 Sistema de Gamificación',
          value:
            '• Gana **Puntos de Pureza** por buenas acciones\n• Evita **Puntos de Corrupción** por herejía\n• Desbloquea **Logros** y sube de **Rango**\n• Compite en los **Rankings** imperiales',
          inline: false,
        },
        {
          name: '🌟 Ejemplos de Uso',
          value:
            '`/herejia mensaje: El Emperador está muerto`\n`/bendicion`\n`!c ranking perfil`\n`/credo`',
          inline: false,
        }
      )
      .setTimestamp()
      .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION });

    await this.sendResponse(message, { embeds: [embed] });
  }
}
