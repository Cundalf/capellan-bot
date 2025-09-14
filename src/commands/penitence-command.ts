import { EmbedBuilder, type Message } from 'discord.js';
import type { GamificationService } from '@/services/gamification-service';
import type { InquisitorService } from '@/services/inquisitor-service';
import type { CommandContext } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';
import type { Logger } from '@/utils/logger';
import { BaseCommand } from './base-command';

export class PenitenceCommand extends BaseCommand {
  name = 'penitencia';
  description = 'Asigna penitencia a un usuario (solo Inquisidores)';
  aliases = ['penitence', 'penance'];
  requiresInquisitor = true;

  private gamificationService: GamificationService;
  private inquisitorService: InquisitorService;

  constructor(
    logger: Logger,
    gamificationService: GamificationService,
    inquisitorService: InquisitorService
  ) {
    super(logger);
    this.gamificationService = gamificationService;
    this.inquisitorService = inquisitorService;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    if (!context.isInquisitor) {
      await message.reply('🚫 *Solo un Inquisidor puede asignar penitencia.*');
      return;
    }

    this.logCommand(context, this.name, args);

    const subCommand = args[0]?.toLowerCase();
    if (subCommand === 'remover' || subCommand === 'remove') {
      await this.handleRemovePenitence(message, args[1], context);
      return;
    }
    if (subCommand === 'lista' || subCommand === 'list') {
      await this.handleListPenitence(message, context);
      return;
    }

    if (!args[0] || !args[1]) {
      await this.showHelp(message);
      return;
    }

    await this.handleAssignPenitence(message, args, context);
  }

  private async handleAssignPenitence(
    message: Message,
    args: string[],
    context: CommandContext
  ): Promise<void> {
    const userMention = args[0];
    const durationStr = args[1];
    const reason = args.slice(2).join(' ') || 'Comportamiento no imperial';

    const userId = this.extractUserIdFromMention(userMention);

    if (userId === context.userId) {
      await message.reply('*No puedes asignarte penitencia a ti mismo, Inquisidor.*');
      return;
    }

    // Prevent assigning penitence between Inquisitors
    if (this.inquisitorService.isInquisitor(userId)) {
      await message.reply(
        '*No puedes asignar penitencia a otro Inquisitor. Los Inquisidores solo responden ante el Emperador.*'
      );
      return;
    }

    const duration = parseInt(durationStr);
    if (isNaN(duration) || duration < 1 || duration > 168) {
      await message.reply('*La duración debe ser entre 1 y 168 horas (1 semana máximo).*');
      return;
    }

    try {
      const targetUser = await message.client.users.fetch(userId);
      const targetProfile = await this.gamificationService.getOrCreateProfile(
        userId,
        targetUser.username
      );

      const penitenceId = await this.gamificationService.assignPenitence(
        userId,
        reason,
        context.username,
        duration
      );

      if (!penitenceId) {
        await message.reply('*Error asignando penitencia.*');
        return;
      }

      await this.gamificationService.addCorruptionPoints(
        userId,
        20,
        `Penitencia asignada: ${reason}`
      );

      const activePenitencias = this.gamificationService.getActivePenitencias(userId);

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setTitle('⚡ PENITENCIA ASIGNADA')
        .setDescription(
          `*${targetUser.username} ha sido sentenciado a penitencia por decreto del Inquisidor ${context.username}.*`
        )
        .addFields(
          { name: '⚖️ Razón', value: reason, inline: false },
          { name: '⏰ Duración', value: `${duration} horas`, inline: true },
          { name: '👁️ Asignado por', value: context.username, inline: true },
          {
            name: '📅 Expira',
            value: new Date(Date.now() + duration * 60 * 60 * 1000).toLocaleString(),
            inline: true,
          },
          {
            name: '📋 Penitencias activas',
            value: activePenitencias.length.toString(),
            inline: true,
          },
          { name: '🔖 ID', value: `\`${penitenceId}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Justicia Imperial' });

      await message.reply({ embeds: [embed] });

      this.logger.inquisitor('Penitence assigned', {
        target: userId,
        reason,
        duration,
        assignedBy: context.userId,
      });
    } catch (error) {
      await message.reply('*No puedo encontrar a ese usuario, Inquisidor.*');
    }
  }

  private async handleRemovePenitence(
    message: Message,
    userOrId: string,
    context: CommandContext
  ): Promise<void> {
    if (!userOrId) {
      await message.reply(
        '*Especifica el usuario o ID: `!capellan penitencia remover @usuario` o `!capellan penitencia remover pen_123456`*'
      );
      return;
    }

    try {
      // Check if it's a penitence ID
      if (userOrId.startsWith('pen_')) {
        // Find the user with this penitence ID
        const allProfiles = Object.values(this.gamificationService['profiles'] || {});
        let foundUser: any = null;

        for (const profile of allProfiles) {
          const allPenitencias = this.gamificationService.getAllPenitencias(profile.userId);
          if (allPenitencias.some((p) => p.id === userOrId)) {
            foundUser = profile;
            break;
          }
        }

        if (!foundUser) {
          await message.reply(`*No encontré ninguna penitencia con ID \`${userOrId}\`.*`);
          return;
        }

        const success = await this.gamificationService.removePenitenceById(
          foundUser.userId,
          userOrId
        );

        if (!success) {
          await message.reply(`*Error removiendo penitencia con ID \`${userOrId}\`.*`);
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.GREEN)
          .setTitle('✅ PENITENCIA REMOVIDA')
          .setDescription(
            `*La penitencia \`${userOrId}\` de ${foundUser.username} ha sido levantada por gracia del Inquisidor ${context.username}.*`
          )
          .setTimestamp()
          .setFooter({ text: 'Perdón Imperial' });

        await message.reply({ embeds: [embed] });
        return;
      }

      // Handle user mention
      const userId = this.extractUserIdFromMention(userOrId);
      const targetUser = await message.client.users.fetch(userId);
      const activePenitencias = this.gamificationService.getActivePenitencias(userId);

      if (activePenitencias.length === 0) {
        await message.reply(`*${targetUser.username} no tiene penitencias activas.*`);
        return;
      }

      // Remove all active penitencias for the user
      const success = await this.gamificationService.removePenitence(userId);

      if (!success) {
        await message.reply(`*Error removiendo penitencias de ${targetUser.username}.*`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GREEN)
        .setTitle('✅ PENITENCIAS REMOVIDAS')
        .setDescription(
          `*Todas las penitencias activas (${activePenitencias.length}) de ${targetUser.username} han sido levantadas por gracia del Inquisidor ${context.username}.*`
        )
        .setTimestamp()
        .setFooter({ text: 'Perdón Imperial' });

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply('*No puedo encontrar a ese usuario, Inquisidor.*');
    }
  }

  private async handleListPenitence(message: Message, context: CommandContext): Promise<void> {
    const allProfiles = Object.values(this.gamificationService['profiles'] || {});
    let totalActivePenitencias = 0;
    const usersWithPenitencias: any[] = [];

    for (const profile of allProfiles) {
      const activePenitencias = this.gamificationService.getActivePenitencias(profile.userId);
      if (activePenitencias.length > 0) {
        totalActivePenitencias += activePenitencias.length;
        usersWithPenitencias.push({
          profile,
          penitencias: activePenitencias,
        });
      }
    }

    if (totalActivePenitencias === 0) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GREEN)
        .setTitle('📋 Estado de Penitencias')
        .setDescription('*No hay penitencias activas. El Imperio está en paz.*')
        .setFooter({ text: 'Archivos Imperiales' });

      await message.reply({ embeds: [embed] });
      return;
    }

    const penitenceList = usersWithPenitencias
      .map(({ profile, penitencias }) => {
        const userInfo = penitencias
          .map((penitence: any) => {
            const remaining = new Date(penitence.endsAt).getTime() - Date.now();
            const hoursRemaining = Math.max(0, Math.ceil(remaining / (60 * 60 * 1000)));

            return `  • ${penitence.reason} (${hoursRemaining}h - ID: \`${penitence.id.slice(-6)}\`)`;
          })
          .join('\n');

        return `**${profile.username}** (${penitencias.length} activas)\n${userInfo}`;
      })
      .join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.ORANGE)
      .setTitle('📋 Penitencias Activas')
      .setDescription(penitenceList)
      .addFields({
        name: 'Total penitencias',
        value: totalActivePenitencias.toString(),
        inline: true,
      })
      .setTimestamp()
      .setFooter({ text: 'Justicia Imperial' });

    await message.reply({ embeds: [embed] });
  }

  private async showHelp(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('⚖️ Comando Penitencia')
      .setDescription('*Sistema de penitencias imperiales para Inquisidores:*')
      .addFields(
        {
          name: '⚡ Asignar',
          value: '`!capellan penitencia @usuario [horas] [razón]`',
          inline: false,
        },
        {
          name: '✅ Remover por usuario',
          value: '`!capellan penitencia remover @usuario`',
          inline: false,
        },
        {
          name: '🆔 Remover por ID',
          value: '`!capellan penitencia remover pen_123456`',
          inline: false,
        },
        { name: '📋 Lista', value: '`!capellan penitencia lista`', inline: false },
        {
          name: '📖 Ejemplo',
          value: '`!capellan penitencia @hereje 24 Blasfemia contra el Emperador`',
          inline: false,
        },
        {
          name: '📝 Nota',
          value: '*Los usuarios pueden tener múltiples penitencias activas simultáneamente*',
          inline: false,
        }
      )
      .setFooter({ text: 'Solo Inquisidores - El Emperador Juzga' });

    await message.reply({ embeds: [embed] });
  }
}
