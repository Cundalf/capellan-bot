
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { RAGSystem } from '@/services/rag-system';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext, HeresyLevel } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';

export class HeresyCommand extends BaseCommand {
  name = 'herejia';
  description = 'Analiza un mensaje en busca de herejía usando conocimiento del lore';
  aliases = ['heresy', 'h'];
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

    let textToAnalyze = args.join(' ');

    // If no text provided, check if replying to another message
    if (!textToAnalyze && message.reference?.messageId) {
      try {
        const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
        textToAnalyze = referencedMessage.content;
      } catch (error) {
        await message.reply('*No puedo acceder al mensaje referenciado, hermano.*');
        return;
      }
    }

    if (!textToAnalyze) {
      const helpEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('📋 Uso del Comando de Análisis')
        .setDescription('*Para analizar herejía, utiliza uno de estos métodos:*')
        .addFields(
          { name: '💬 Texto directo', value: '`!capellan herejia [mensaje]`', inline: false },
          { name: '↩️ Responder a mensaje', value: 'Responde a un mensaje con `!capellan herejia`', inline: false }
        )
        .setFooter({ text: 'El Emperador ve todo' });

      await message.reply({ embeds: [helpEmbed] });
      return;
    }

    const loadingEmbed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.ORANGE)
      .setDescription('🔍 *Consultando los archivos sagrados...*')
      .setFooter({ text: 'El Emperador ve todo' });

    const loadingMsg = await message.reply({ embeds: [loadingEmbed] });

    try {
      const result = await this.ragSystem.generateCapellanResponse(textToAnalyze, 'heresy_analysis');
      
      const level = this.extractHeresyLevel(result.response);
      const colorConfig = WARHAMMER_CONSTANTS.HERESY_LEVELS[level];

      const embed = new EmbedBuilder()
        .setColor(parseInt(colorConfig.color.replace('#', '0x')))
        .setTitle('⚖️ Juicio del Capellán')
        .setDescription(result.response)
        .addFields(
          { 
            name: '📋 Mensaje Analizado', 
            value: `"${textToAnalyze.substring(0, 200)}${textToAnalyze.length > 200 ? '...' : '\"'}`, 
            inline: false 
          },
          { 
            name: '🎯 Nivel de Herejía', 
            value: `**${level}** - *${colorConfig.description}*`, 
            inline: true 
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Veredicto del Emperador' });

      // Add sources if available
      if (result.sources.length > 0) {
        const sourcesText = result.sources
          .map(s => `• ${s.source} (${Math.round(s.similarity * 100)}% relevancia)`)
          .join('\n');
        
        embed.addFields({ 
          name: '📚 Fuentes Consultadas', 
          value: sourcesText, 
          inline: false 
        });
      }

      await loadingMsg.edit({ embeds: [embed] });

      if (this.gamificationService) {
        await this.gamificationService.getOrCreateProfile(context.userId, context.username);
        await this.gamificationService.recordHeresyDetection(context.userId, level);
      }

      this.logger.heresy('Herejía analizada', {
        userId: context.userId,
        level,
        textLength: textToAnalyze.length,
        sourcesUsed: result.sources.length,
        tokensUsed: result.tokensUsed
      });

    } catch (error: any) {
      this.logger.error('Error in heresy analysis', { 
        error: error?.message || 'Unknown error', 
        userId: context.userId 
      });
      
      const errorEmbed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription('⚠️ *Los espíritus de la máquina me fallan. El Omnissiah requiere plegarias.*')
        .setFooter({ text: 'Error técnico reportado' });

      await loadingMsg.edit({ embeds: [errorEmbed] });
    }
  }

  private extractHeresyLevel(response: string): HeresyLevel {
    const levels: HeresyLevel[] = ['HEREJIA_EXTREMA', 'HEREJIA_MAYOR', 'HEREJIA_MENOR', 'SOSPECHOSO', 'PURA_FE'];
    
    for (const level of levels) {
      if (response.includes(level)) {
        return level;
      }
    }
    
    return 'SOSPECHOSO'; // Default fallback
  }
}