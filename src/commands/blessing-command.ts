
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext, UserRank } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';

export class BlessingCommand extends BaseCommand {
  name = 'bendicion';
  description = 'Otorga una bendición imperial a un usuario';
  aliases = ['blessing', 'bless'];
  requiresInquisitor = false;

  private gamificationService: GamificationService;
  private lastBlessings: Map<string, number> = new Map();

  constructor(logger: Logger, gamificationService: GamificationService) {
    super(logger);
    this.gamificationService = gamificationService;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    const now = Date.now();
    const lastBlessing = this.lastBlessings.get(context.userId) || 0;
    const cooldownMinutes = 30;
    const cooldownMs = cooldownMinutes * 60 * 1000;

    if (now - lastBlessing < cooldownMs) {
      const remainingTime = Math.ceil((cooldownMs - (now - lastBlessing)) / 60000);
      await message.reply(`*Debes esperar ${remainingTime} minutos antes de bendecir nuevamente, hermano.*`);
      return;
    }

    const userMention = args[0];
    
    if (!userMention) {
      await this.showSelfBlessing(message, context);
      return;
    }

    const userId = this.extractUserIdFromMention(userMention);
    
    if (userId === context.userId) {
      await message.reply('*No puedes bendecirte a ti mismo, hermano. La humildad es una virtud imperial.*');
      return;
    }

    try {
      const targetUser = await message.client.users.fetch(userId);
      const targetProfile = await this.gamificationService.getOrCreateProfile(userId, targetUser.username);
      const blesserProfile = await this.gamificationService.getOrCreateProfile(context.userId, context.username);

      await this.gamificationService.addPurityPoints(userId, 15, `Bendición de ${context.username}`);
      await this.gamificationService.addPurityPoints(context.userId, 5, 'Otorgar bendición');

      this.lastBlessings.set(context.userId, now);

      const blessings = [
        `🕊️ *Que ${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION} a ${targetUser.username} y le otorgue fortaleza en estos tiempos oscuros.*`,
        `✨ *${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.BLESSING}, ${targetUser.username}. Que Su sabiduría ilumine tu camino.*`,
        `👑 *Por decreto del Emperador, ${targetUser.username} recibe Su bendición. Que Su luz dorada te acompañe.*`,
        `⚡ *Los vientos del Warp no pueden tocar a ${targetUser.username}, pues el Emperador vela por su alma.*`,
        `🔥 *Que la llama de la fe arda eterna en el corazón de ${targetUser.username}. Ave Imperator!*`
      ];

      const randomBlessing = blessings[Math.floor(Math.random() * blessings.length)];

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('🕊️ Bendición Imperial')
        .setDescription(randomBlessing)
        .addFields(
          { name: '🙏 Bendecido por', value: context.username, inline: true },
          { name: '✨ Puntos de Pureza', value: '+15 puntos', inline: true },
          { name: '👁️ Nuevo Rango', value: this.getRankEmoji(targetProfile.rank) + ' ' + targetProfile.rank, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION });

      await message.reply({ embeds: [embed] });

      this.logger.info('Blessing given', {
        blesser: context.userId,
        target: userId,
        targetRank: targetProfile.rank
      });

    } catch (error) {
      await message.reply('*No puedo encontrar a ese usuario, hermano.*');
    }
  }

  private async showSelfBlessing(message: Message, context: CommandContext): Promise<void> {
    const profile = await this.gamificationService.getOrCreateProfile(context.userId, context.username);
    
    const personalBlessings = [
      `🕊️ *${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION}, ${context.username}. Tu fe es inquebrantable.*`,
      `✨ *El Emperador reconoce tu devoción, ${context.username}. Continúa en Su sagrado servicio.*`,
      `👑 *Que la luz del Trono Dorado ilumine tu alma, fiel ${context.username}.*`,
      `⚔️ *Tu valor no pasa desapercibido ante el Emperador, ${context.username}. Mantente firme.*`
    ];

    const randomBlessing = personalBlessings[Math.floor(Math.random() * personalBlessings.length)];

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('🕊️ Bendición Personal')
      .setDescription(randomBlessing)
      .addFields(
        { name: '📊 Tu Rango', value: this.getRankEmoji(profile.rank) + ' ' + profile.rank, inline: true },
        { name: '✨ Pureza', value: profile.purityPoints.toString(), inline: true },
        { name: '🏆 Logros', value: profile.achievements.length.toString(), inline: true }
      )
      .setTimestamp()
      .setFooter({ text: 'El Emperador te ve' });

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
}