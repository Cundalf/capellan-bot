
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { InquisitorService } from '@/services/inquisitor-service';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';

export class InquisitorCommand extends BaseCommand {
  name = 'inquisidor';
  description = 'Gestiona el sistema de Inquisidores (administradores)';
  aliases = ['inq', 'admin'];
  requiresInquisitor = false; // Some subcommands are public (supremo, lista, help)

  private inquisitorService: InquisitorService;

  constructor(logger: Logger, inquisitorService: InquisitorService) {
    super(logger);
    this.inquisitorService = inquisitorService;
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    const subCommand = args[0]?.toLowerCase();

    // Commands available to everyone
    if (subCommand === 'supremo') {
      await this.handleSupremeCommand(message, context);
      return;
    }

    if (subCommand === 'lista' || subCommand === 'list') {
      await this.handleList(message, context);
      return;
    }

    // Handle help command
    if (!subCommand || subCommand === 'help') {
      await this.showHelp(message, context);
      return;
    }

    // Check if user is inquisitor for other commands
    if (!context.isInquisitor) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription('🚫 *Solo un Inquisitor tiene autoridad para usar estos comandos, hermano.*')
        .setFooter({ text: 'Acceso Denegado' });

      await message.reply({ embeds: [embed] });
      return;
    }

    this.logCommand(context, this.name, args);

    switch (subCommand) {
      case 'nominar':
      case 'nombrar':
        await this.handleNominate(message, args[1], context);
        break;
        
      case 'revocar':
      case 'destituir':
        await this.handleRevoke(message, args[1], context);
        break;

      case 'promover':
        await this.handlePromote(message, args[1], context);
        break;

      case 'info':
        await this.handleInfo(message, args[1], context);
        break;
        
      default:
        await this.showHelp(message, context);
    }
  }

  private async handleSupremeCommand(message: Message, context: CommandContext): Promise<void> {
    try {
      if (this.inquisitorService.getInquisitorCount() > 0) {
        const embed = new EmbedBuilder()
          .setColor(DISCORD_COLORS.RED)
          .setDescription('⚠️ *Ya existen Inquisidores en el sistema. No puedes autoproclamarte.*')
          .setFooter({ text: 'Acceso Denegado' });

        await message.reply({ embeds: [embed] });
        return;
      }

      await this.inquisitorService.createSupremeInquisitor(context.userId, context.username);
      
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.DARK_RED)
        .setTitle('👑 INQUISIDOR SUPREMO AUTOPROCLAMADO')
        .setDescription(`*${context.username} ha sido nombrado el primer Inquisidor Supremo por voluntad del Emperador.*\n\n**¡QUE NADIE SE ATREVA A CUESTIONAR SU AUTORIDAD!**`)
        .setTimestamp()
        .setFooter({ text: 'El Emperador Juzga' });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      this.logger.error('Error in supreme command', { error: error?.message || 'Unknown error', userId: context.userId });
      
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription(`❌ *Error: ${error?.message || 'Unknown error'}*`)
        .setFooter({ text: 'Falló la Operación' });

      await message.reply({ embeds: [embed] });
    }
  }

  private async handleNominate(message: Message, userMention: string, context: CommandContext): Promise<void> {
    if (!userMention) {
      await message.reply('*Debéis especificar a quién nombrar: `!capellan inquisidor nominar @usuario`*');
      return;
    }

    const userId = this.extractUserIdFromMention(userMention);
    
    try {
      const targetUser = await message.client.users.fetch(userId);
      
      if (this.inquisitorService.isInquisitor(userId)) {
        await message.reply(`*${targetUser.username} ya es un Inquisidor, hermano.*`);
        return;
      }

      await this.inquisitorService.addInquisitor(userId, targetUser.username, context.username);

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.DARK_RED)
        .setTitle('👁️ NUEVO INQUISIDOR NOMBRADO')
        .setDescription(`*Por decreto de Inquisidor ${context.username}, ${targetUser.username} ha sido elevado al rango de **INQUISIDOR**.*\n\n**Que su vigilancia sea eterna y su juicio implacable.**`)
        .addFields(
          { name: 'Autorizado por', value: context.username, inline: true },
          { name: 'Fecha', value: new Date().toLocaleString(), inline: true }
        )
        .setTimestamp()
        .setFooter({ text: 'Por la Gloria del Emperador' });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      this.logger.error('Error nominating inquisitor', { error: error?.message || 'Unknown error', userId, nominatedBy: context.userId });
      await message.reply(`*Error: ${error?.message || 'Unknown error'}*`);
    }
  }

  private async handleRevoke(message: Message, userMention: string, context: CommandContext): Promise<void> {
    if (!userMention) {
      await message.reply('*Debéis especificar a quién destituir: `!capellan inquisidor revocar @usuario`*');
      return;
    }

    const userId = this.extractUserIdFromMention(userMention);
    
    if (userId === context.userId) {
      await message.reply('*No podéis destituiros a vos mismo, hermano.*');
      return;
    }

    try {
      const revokedInquisitor = await this.inquisitorService.removeInquisitor(userId);
      
      if (!revokedInquisitor) {
        await message.reply('*Ese usuario no es un Inquisidor.*');
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.ORANGE)
        .setTitle('⚡ INQUISIDOR DESTITUIDO')
        .setDescription(`*Por decreto de Inquisidor ${context.username}, ${revokedInquisitor.username} ha sido **DESTITUIDO** de su cargo.*\n\n**Sus privilegios han sido revocados.**`)
        .setTimestamp()
        .setFooter({ text: 'Justicia Imperial' });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      this.logger.error('Error revoking inquisitor', { error: error?.message || 'Unknown error', userId, revokedBy: context.userId });
      await message.reply(`*Error: ${error?.message || 'Unknown error'}*`);
    }
  }

  private async handleList(message: Message, context: CommandContext): Promise<void> {
    const inquisitorsList = this.inquisitorService.formatInquisitorsList();

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.DARK_RED)
      .setTitle('👁️ REGISTRO DE INQUISIDORES')
      .setDescription(inquisitorsList)
      .setTimestamp()
      .setFooter({ text: `Total: ${this.inquisitorService.getInquisitorCount()} Inquisidores` });

    await message.reply({ embeds: [embed] });
  }

  private async handlePromote(message: Message, userMention: string, context: CommandContext): Promise<void> {
    // Only Supreme Inquisitors can promote others to Supreme
    if (!this.inquisitorService.isSupremeInquisitor(context.userId)) {
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.RED)
        .setDescription('👑 *Solo un Inquisidor Supremo puede promover a otros al rango supremo.*')
        .setFooter({ text: 'Privilegios Insuficientes' });

      await message.reply({ embeds: [embed] });
      return;
    }

    if (!userMention) {
      await message.reply('*Debéis especificar a quién promover: `!capellan inquisidor promover @usuario`*');
      return;
    }

    const userId = this.extractUserIdFromMention(userMention);
    
    try {
      await this.inquisitorService.promoteToSupreme(userId, context.username);
      
      const inquisitor = this.inquisitorService.getInquisitor(userId)!;
      
      const embed = new EmbedBuilder()
        .setColor(DISCORD_COLORS.GOLD)
        .setTitle('👑 PROMOCIÓN A INQUISIDOR SUPREMO')
        .setDescription(`*${inquisitor.username} ha sido promovido al rango de **INQUISIDOR SUPREMO** por decreto de ${context.username}.*\n\n**¡Que su autoridad sea absoluta!**`)
        .setTimestamp()
        .setFooter({ text: 'Gloria Imperial' });

      await message.reply({ embeds: [embed] });

    } catch (error: any) {
      this.logger.error('Error promoting inquisitor', { error: error?.message || 'Unknown error', userId, promotedBy: context.userId });
      await message.reply(`*Error: ${error?.message || 'Unknown error'}*`);
    }
  }

  private async handleInfo(message: Message, userMention: string, context: CommandContext): Promise<void> {
    const userId = userMention 
      ? this.extractUserIdFromMention(userMention) 
      : context.userId;

    const inquisitorInfo = this.inquisitorService.formatInquisitorInfo(userId);

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.BLUE)
      .setTitle('📋 Información del Inquisidor')
      .setDescription(inquisitorInfo)
      .setTimestamp()
      .setFooter({ text: 'Archivos Imperiales' });

    await message.reply({ embeds: [embed] });
  }

  private async showHelp(message: Message, context: CommandContext): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('👁️ Comandos de Inquisidor')
      .setDescription('*Gestión del sistema de Inquisidores:*');

    if (context.isInquisitor) {
      embed.addFields(
        { name: '🔸 Nominar', value: '`!capellan inquisidor nominar @usuario`', inline: false },
        { name: '🔸 Revocar', value: '`!capellan inquisidor revocar @usuario`', inline: false },
        { name: '🔸 Lista', value: '`!capellan inquisidor lista`', inline: false },
        { name: '🔸 Info', value: '`!capellan inquisidor info [@usuario]`', inline: false }
      );

      if (this.inquisitorService.isSupremeInquisitor(context.userId)) {
        embed.addFields(
          { name: '👑 Promover', value: '`!capellan inquisidor promover @usuario`', inline: false }
        );
      }
    } else {
      embed.addFields(
        { name: '🔸 Autoproclamación', value: '`!capellan inquisidor supremo` (solo si no hay Inquisidores)', inline: false },
        { name: '🔸 Lista', value: '`!capellan inquisidor lista`', inline: false }
      );
    }

    embed.setFooter({ text: 'El Emperador ve todo' });

    await message.reply({ embeds: [embed] });
  }
}