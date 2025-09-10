
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { RAGSystem } from '@/services/rag-system';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';

export class SermonCommand extends BaseCommand {
  name = 'sermon';
  description = 'Genera un sermón diario inspirador para fortalecer la fe imperial';
  aliases = ['s'];
  requiresInquisitor = false;

  private ragSystem: RAGSystem;
  private gamificationService: GamificationService;

  constructor(logger: Logger, ragSystem: RAGSystem, gamificationService?: GamificationService) {
    super(logger);
    this.ragSystem = ragSystem;
    this.gamificationService = gamificationService!; // Will be provided by CommandManager
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setDescription('📜 *Preparando sermón sagrado...*')
      .setFooter({ text: 'Ave Imperator' });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      // Use custom topic if provided
      const topic = args.length > 0 
        ? args.join(' ') 
        : 'Genera un sermón diario inspirador para fortalecer la fe imperial';
      const result = await this.ragSystem.generateCapellanResponse(topic, 'daily_sermon');

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('📜 Sermón del Capellán')
        .setDescription(result.response)
        .setTimestamp()
        .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.GREETING });

      // Add sources if available
      if (result.sources.length > 0) {
        const sourcesText = result.sources
          .map(s => s.source)
          .slice(0, 3) // Limit to 3 sources for sermon
          .join(', ');
        
        embed.addFields({ 
          name: '📚 Basado en doctrina', 
          value: sourcesText || 'Sabiduría del Capellán', 
          inline: false 
        });
      }

      await loadingMsg.edit({ embeds: [embed] });

      if (this.gamificationService) {
        await this.gamificationService.getOrCreateProfile(context.userId, context.username);
        await this.gamificationService.recordSermon(context.userId);
      }

      this.logger.capellan('Sermón generado', {
        userId: context.userId,
        topic: args.length > 0 ? topic : 'sermón diario',
        sourcesUsed: result.sources.length,
        tokensUsed: result.tokensUsed
      });

    } catch (error: any) {
      this.logger.error('Error generating sermon', { 
        error: error?.message || 'Unknown error', 
        userId: context.userId 
      });

      // Fallback sermons
      const fallbackSermons = [
        {
          title: 'Fe Imperial',
          content: `🕊️ *${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION} a quienes marchan en Su nombre. Que Su luz dorada guíe vuestros pasos en este día, hermanos.*\n\n**${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.GREETING}** ⚡`
        },
        {
          title: 'Vigilancia Eterna',
          content: `⚔️ *Recordad: la herejía no duerme, ni tampoco debe hacerlo nuestra vigilancia. Manteneos puros en pensamiento y acción.*\n\n**${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.BATTLE_CRY}** 👑`
        },
        {
          title: 'Servicio al Emperador',
          content: `👑 *Solo en el servicio al Emperador encontramos verdadero propósito. Que cada acción sea una ofrenda al Trono Dorado.*\n\n**${WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.BLESSING}** 🕊️`
        }
      ];

      const randomSermon = fallbackSermons[Math.floor(Math.random() * fallbackSermons.length)];
      
      const fallbackEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle(`📜 ${randomSermon.title}`)
        .setDescription(randomSermon.content)
        .setFooter({ text: WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES.PROTECTION });

      await loadingMsg.edit({ embeds: [fallbackEmbed] });
    }
  }
}