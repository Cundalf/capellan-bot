
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext, UserRank } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';

export class CredoCommand extends BaseCommand {
  name = 'credo';
  description = 'Recita el Credo Imperial';
  aliases = ['creed', 'prayer'];
  requiresInquisitor = false;

  private gamificationService: GamificationService;
  private lastRecitation: Map<string, number> = new Map();

  constructor(logger: Logger, gamificationService: GamificationService) {
    super(logger);
    this.gamificationService = gamificationService;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    const now = Date.now();
    const lastTime = this.lastRecitation.get(context.userId) || 0;
    const cooldownMs = 10 * 60 * 1000;

    if (now - lastTime < cooldownMs) {
      const remainingTime = Math.ceil((cooldownMs - (now - lastTime)) / 60000);
      await message.reply(`*Has recitado el Credo recientemente. Espera ${remainingTime} minutos para recitarlo nuevamente.*`);
      return;
    }

    const profile = await this.gamificationService.getOrCreateProfile(context.userId, context.username);
    await this.gamificationService.addPurityPoints(context.userId, 8, 'Recitación del Credo Imperial');
    this.lastRecitation.set(context.userId, now);

    const credos = [
      {
        title: 'Credo Imperial',
        text: `**El Emperador es nuestro Señor y Salvador.**
        
*Es por Su voluntad sola que los marineros pueden navegar por el inmaterium sin perderse.*

*Es por Su Sagrada Guía que los planetas no se desvían de sus órbitas.*

*Es por Su Protección Divina que la humanidad sobrevive.*

*Nunca dudéis. Nunca flaquéis. Nunca temáis.*

*Pues el Emperador está con nosotros.*`
      },
      {
        title: 'Oración del Fiel',
        text: `**Ave Imperator! Gloria in Excelsis Terra!**
        
*Oh Emperador, Señor de la Humanidad, por Tu Gracia somos elevados.*

*Por Tu Ejemplo aprendemos valor.*

*Por Tu Infinita Sabiduría somos iluminados.*

*Por Tu Fuerza Inmortal somos protegidos.*

*Oh Emperador, extiende Tu Divina Protección sobre nosotros, Tus humildes siervos.*`
      },
      {
        title: 'Letanía de la Fe',
        text: `**El Emperador Protege. El Emperador Proporciona.**
        
*Bendito sea el Emperador que nos guía en la oscuridad.*

*Benditos sean Sus servidores que portan Su luz.*

*Benditos sean los puros de corazón, pues ellos heredarán Su Reino.*

*Malditos sean los herejes que se desvían de Su Sagrado Camino.*

*En Su nombre marchamos. En Su nombre luchamos. En Su nombre morimos.*`
      },
      {
        title: 'Oración de Protección',
        text: `**Por el Trono Dorado y la Gloria Terra!**
        
*Emperador, protégenos de las tentaciones del Caos.*

*Fortalece nuestras almas contra la corrupción del Warp.*

*Guía nuestras armas contra los enemigos de la humanidad.*

*Ilumina nuestras mentes con Tu Divina Sabiduría.*

*Que Tu Voluntad sea hecha, ahora y por siempre.*

*Ave Imperator!*`
      }
    ];

    const selectedCredo = credos[Math.floor(Math.random() * credos.length)];

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle(`📜 ${selectedCredo.title}`)
      .setDescription(selectedCredo.text)
      .addFields(
        { name: '🙏 Recitado por', value: context.username, inline: true },
        { name: '✨ Puntos ganados', value: '+8 Pureza', inline: true },
        { name: '👁️ Rango actual', value: this.getRankEmoji(profile.rank) + ' ' + profile.rank, inline: true }
      )
      .setTimestamp()
      .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION });

    await message.reply({ embeds: [embed] });

    this.logger.capellan('Credo recited', {
      userId: context.userId,
      credo: selectedCredo.title,
      newRank: profile.rank
    });
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