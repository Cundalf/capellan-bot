
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext, UserRank } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';

export class RankingCommand extends BaseCommand {
  name = 'ranking';
  description = 'Muestra el ranking de fe imperial y estadísticas de usuarios';
  aliases = ['leaderboard', 'top', 'clasificacion'];
  requiresInquisitor = false;

  private gamificationService: GamificationService;

  constructor(logger: Logger, gamificationService: GamificationService) {
    super(logger);
    this.gamificationService = gamificationService;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    const subCommand = args[0]?.toLowerCase();

    switch (subCommand) {
      case 'perfil':
      case 'profile':
        await this.showProfile(message, args[1], context);
        break;
      case 'logros':
      case 'achievements':
        await this.showAchievements(message, args[1], context);
        break;
      case 'distribucion':
      case 'distribution':
        await this.showDistribution(message, context);
        break;
      default:
        await this.showLeaderboard(message, context);
    }
  }

  private async showLeaderboard(message: Message, context: CommandContext): Promise<void> {
    const leaderboard = this.gamificationService.getLeaderboard(15);
    
    if (leaderboard.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.BLUE)
        .setTitle('🏆 Ranking Imperial')
        .setDescription('*No hay datos de usuarios. ¡Sé el primero en servir al Emperador!*')
        .setFooter({ text: 'El Emperador ve todo' });

      await message.reply({ embeds: [embed] });
      return;
    }

    const rankings = leaderboard.map(({ rank, profile }) => {
      const netPurity = profile.purityPoints - profile.corruptionPoints;
      const rankEmoji = this.getRankEmoji(profile.rank);
      const positionEmoji = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `${rank}.`;
      
      return `${positionEmoji} ${rankEmoji} **${profile.username}**\n` +
             `   └ ${profile.rank} • ${netPurity} puntos netos`;
    }).join('\n\n');

    const userProfile = this.gamificationService.getUserStats(context.userId);
    let userRankText = '*No tienes perfil aún*';
    
    if (userProfile) {
      const allUsers = this.gamificationService.getLeaderboard(1000);
      const userPosition = allUsers.findIndex(u => u.profile.userId === context.userId) + 1;
      const netPurity = userProfile.purityPoints - userProfile.corruptionPoints;
      
      userRankText = `**Posición #${userPosition}** • ${this.getRankEmoji(userProfile.rank)} ${userProfile.rank}\n${netPurity} puntos netos`;
    }

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('🏆 Ranking Imperial de Fe')
      .setDescription('*Los más fieles servidores del Emperador:*\n\n' + rankings)
      .addFields(
        { name: '👤 Tu Posición', value: userRankText, inline: false },
        { name: '📊 Comandos Adicionales', value: '`!c ranking perfil [@usuario]` - Ver perfil\n`!c ranking logros [@usuario]` - Ver logros\n`!c ranking distribucion` - Distribución de rangos', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Total: ${this.gamificationService.getTotalUsers()} usuarios registrados` });

    await message.reply({ embeds: [embed] });
  }

  private async showProfile(message: Message, userMention: string, context: CommandContext): Promise<void> {
    let targetUserId = context.userId;
    let targetUsername = context.username;

    if (userMention) {
      targetUserId = this.extractUserIdFromMention(userMention);
      try {
        const targetUser = await message.client.users.fetch(targetUserId);
        targetUsername = targetUser.username;
      } catch {
        await message.reply('*No puedo encontrar a ese usuario.*');
        return;
      }
    }

    const profile = this.gamificationService.getUserStats(targetUserId);
    
    if (!profile) {
      await message.reply('*Este usuario no tiene perfil registrado.*');
      return;
    }

    const netPurity = profile.purityPoints - profile.corruptionPoints;
    const joinDate = new Date(profile.joinedAt).toLocaleDateString();
    const lastActive = new Date(profile.lastActivity).toLocaleDateString();
    
    const allUsers = this.gamificationService.getLeaderboard(1000);
    const userPosition = allUsers.findIndex(u => u.profile.userId === targetUserId) + 1;

    const embed = new EmbedBuilder()
      .setColor(this.getRankColor(profile.rank))
      .setTitle(`${this.getRankEmoji(profile.rank)} Perfil de ${targetUsername}`)
      .setDescription(`**Rango:** ${profile.rank}\n**Posición Global:** #${userPosition}`)
      .addFields(
        { name: '✨ Puntos de Pureza', value: profile.purityPoints.toString(), inline: true },
        { name: '💀 Puntos de Corrupción', value: profile.corruptionPoints.toString(), inline: true },
        { name: '📊 Puntos Netos', value: netPurity.toString(), inline: true },
        { name: '💬 Mensajes', value: profile.totalMessages.toString(), inline: true },
        { name: '🔍 Herejías Detectadas', value: profile.heresiesDetected.toString(), inline: true },
        { name: '📖 Sermones Recibidos', value: profile.sermonsReceived.toString(), inline: true },
        { name: '🏆 Logros', value: profile.achievements.length.toString(), inline: true },
        { name: '📅 Se Unió', value: joinDate, inline: true },
        { name: '🕒 Última Actividad', value: lastActive, inline: true }
      )
      .setTimestamp();

    if (profile.penitenceStatus?.active) {
      const endsAt = new Date(profile.penitenceStatus.endsAt);
      const remaining = Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / (60 * 60 * 1000)));
      
      embed.addFields({
        name: '⚡ Penitencia Activa',
        value: `**Razón:** ${profile.penitenceStatus.reason}\n**Tiempo restante:** ${remaining}h`,
        inline: false
      });
    }

    embed.setFooter({ text: 'Archivos Imperiales' });

    await message.reply({ embeds: [embed] });
  }

  private async showAchievements(message: Message, userMention: string, context: CommandContext): Promise<void> {
    let targetUserId = context.userId;
    let targetUsername = context.username;

    if (userMention) {
      targetUserId = this.extractUserIdFromMention(userMention);
      try {
        const targetUser = await message.client.users.fetch(targetUserId);
        targetUsername = targetUser.username;
      } catch {
        await message.reply('*No puedo encontrar a ese usuario.*');
        return;
      }
    }

    const profile = this.gamificationService.getUserStats(targetUserId);
    
    if (!profile) {
      await message.reply('*Este usuario no tiene perfil registrado.*');
      return;
    }

    if (profile.achievements.length === 0) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.BLUE)
        .setTitle(`🏆 Logros de ${targetUsername}`)
        .setDescription('*Este usuario aún no ha desbloqueado logros. ¡Sigue sirviendo al Emperador!*')
        .setFooter({ text: 'Sistema de Logros Imperial' });

      await message.reply({ embeds: [embed] });
      return;
    }

    const achievementsList = profile.achievements.map(achievementId => {
      const achievement = this.gamificationService.getAchievementById(achievementId);
      if (achievement) {
        return `${achievement.icon} **${achievement.name}**
   └ ${achievement.description}`;
      }
      return `🏅 **${achievementId}**
   └ Logro desconocido`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle(`🏆 Logros de ${targetUsername}`)
      .setDescription(achievementsList)
      .addFields({
        name: '📊 Progreso',
        value: `${profile.achievements.length} logros desbloqueados`,
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: 'Sistema de Logros Imperial' });

    await message.reply({ embeds: [embed] });
  }

  private async showDistribution(message: Message, context: CommandContext): Promise<void> {
    const distribution = this.gamificationService.getRankDistribution();
    const totalUsers = this.gamificationService.getTotalUsers();

    if (totalUsers === 0) {
      await message.reply('*No hay usuarios registrados en el sistema.*');
      return;
    }

    const distributionText = Object.entries(distribution)
      .filter(([_, count]) => count > 0)
      .map(([rank, count]) => {
        const percentage = ((count / totalUsers) * 100).toFixed(1);
        const emoji = this.getRankEmoji(rank as import('@/types').UserRank);
        return `${emoji} **${rank}**: ${count} usuarios (${percentage}%)`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.BLUE)
      .setTitle('📊 Distribución de Rangos Imperial')
      .setDescription(distributionText)
      .addFields({
        name: '👥 Total de Usuarios',
        value: totalUsers.toString(),
        inline: true
      })
      .setTimestamp()
      .setFooter({ text: 'Estadísticas del Imperio' });

    await message.reply({ embeds: [embed] });
  }

  private getRankEmoji(rank: UserRank): string {
    const rankEmojis: Record<UserRank, string> = {
      'Herético': '💀',
      'Sospechoso': '❓',
      'Ciudadano': '👤',
      'Fiel': '🙏',
      'Devoto': '✨',
      'Piadoso': '👼',
      'Santo': '😇',
      'Mártir': '⚡',
      'Servo del Emperador': '👑'
    };
    return rankEmojis[rank] || '👤';
  }

  private getRankColor(rank: UserRank): number {
    const rankColors: Record<UserRank, number> = {
      'Herético': DISCORD_COLORS.RED,
      'Sospechoso': DISCORD_COLORS.ORANGE,
      'Ciudadano': DISCORD_COLORS.BLUE,
      'Fiel': DISCORD_COLORS.GREEN,
      'Devoto': DISCORD_COLORS.GOLD,
      'Piadoso': DISCORD_COLORS.GOLD,
      'Santo': DISCORD_COLORS.GOLD,
      'Mártir': DISCORD_COLORS.GOLD,
      'Servo del Emperador': DISCORD_COLORS.GOLD
    };
    return rankColors[rank] || DISCORD_COLORS.BLUE;
  }
}