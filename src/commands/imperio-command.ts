
import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import { CommandContext, UserRank } from '@/types';
import { DISCORD_COLORS } from '@/utils/constants';

export class ImperioCommand extends BaseCommand {
  name = 'imperio';
  description = 'Explica el Sistema de Gamificación Imperial';
  aliases = ['empire', 'sistema', 'system'];
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
      case 'rangos':
      case 'ranks':
        await this.showRanks(message);
        break;
      case 'penitencias':
      case 'penitence':
        await this.showPenitence(message);
        break;
      case 'puntos':
      case 'points':
        await this.showPoints(message);
        break;
      case 'logros':
      case 'achievements':
        await this.showAchievements(message);
        break;
      default:
        await this.showOverview(message);
    }
  }

  private async showOverview(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle('👑 Sistema de Gamificación Imperial')
      .setDescription(`*En el nombre del Emperador, este sistema mide tu devoción y pureza espiritual.*`)
      .addFields(
        { 
          name: '⭐ Puntos de Pureza', 
          value: 'Ganados por devoción, sermones y comportamiento piadoso', 
          inline: true 
        },
        { 
          name: '🔴 Puntos de Corrupción', 
          value: 'Adquiridos por herejía, blasfemia y comportamiento sospechoso', 
          inline: true 
        },
        { 
          name: '🏆 Sistema de Rangos', 
          value: 'Tu posición en la jerarquía imperial según tu pureza neta', 
          inline: true 
        },
        { 
          name: '⚡ Penitencias', 
          value: 'Castigos temporales por comportamiento herético', 
          inline: true 
        },
        { 
          name: '🎖️ Logros', 
          value: 'Reconocimientos especiales por servicio al Emperador', 
          inline: true 
        },
        { 
          name: '📊 Clasificación', 
          value: 'Compite con otros ciudadanos por la pureza más alta', 
          inline: true 
        }
      )
      .addFields({
        name: '📖 Comandos de Ayuda',
        value: '`!capellan imperio rangos` - Ver todos los rangos\n' +
               '`!capellan imperio puntos` - Sistema de puntos\n' +
               '`!capellan imperio penitencias` - Sistema de penitencias\n' +
               '`!capellan imperio logros` - Sistema de logros',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: 'Ave Imperator - Gloria al Emperador' });

    await message.reply({ embeds: [embed] });
  }

  private async showRanks(message: Message): Promise<void> {
    const ranks: { rank: UserRank; description: string; requirement: string }[] = [
      { rank: 'Herético', description: 'Alma perdida en las garras del Caos', requirement: 'Pureza neta < -100' },
      { rank: 'Sospechoso', description: 'Bajo vigilancia constante del Ordo Hereticus', requirement: 'Pureza neta: -100 a -1' },
      { rank: 'Ciudadano', description: 'Ciudadano básico del Imperium', requirement: 'Pureza neta: 0 a 49' },
      { rank: 'Fiel', description: 'Demostró fe verdadera en el Emperador', requirement: 'Pureza neta: 50 a 99' },
      { rank: 'Devoto', description: 'Seguidor dedicado de la doctrina imperial', requirement: 'Pureza neta: 100 a 199' },
      { rank: 'Piadoso', description: 'Alma verdaderamente pura y devota', requirement: 'Pureza neta: 200 a 399' },
      { rank: 'Santo', description: 'Bendecido por la luz dorada del Emperador', requirement: 'Pureza neta: 400 a 699' },
      { rank: 'Mártir', description: 'Dispuesto a morir por el Emperador', requirement: 'Pureza neta: 700 a 999' },
      { rank: 'Servo del Emperador', description: 'El más alto honor para un mortal', requirement: 'Pureza neta: 1000+' }
    ];

    const rankText = ranks.map(({ rank, description, requirement }) => 
      `**${rank}**\n*${description}*\n📊 ${requirement}\n`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.BLUE)
      .setTitle('🏆 Rangos del Sistema Imperial')
      .setDescription('*Los rangos se calculan basándose en tu Pureza Neta (Puntos de Pureza - Puntos de Corrupción):*\n\n' + rankText)
      .addFields({
        name: '💡 Consejos',
        value: '• Usa `!capellan ranking` para ver tu posición\n' +
               '• Los sermones y detección de herejías otorgan pureza\n' +
               '• Evita blasfemias para no recibir corrupción',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: 'Sistema de Jerarquía Imperial' });

    await message.reply({ embeds: [embed] });
  }

  private async showPoints(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GREEN)
      .setTitle('⭐ Sistema de Puntos Imperial')
      .setDescription('*Tu posición en el Imperio se basa en dos tipos de puntos:*')
      .addFields(
        {
          name: '⭐ Puntos de Pureza - Formas de Ganar',
          value: '• **Recibir sermones**: +5 puntos\n' +
                 '• **Detectar herejías**: +10-50 puntos (según gravedad)\n' +
                 '• **Participación activa**: +1-5 puntos por mensaje\n' +
                 '• **Bendiciones de Inquisidores**: Variable',
          inline: false
        },
        {
          name: '🔴 Puntos de Corrupción - Formas de Adquirir',
          value: '• **Ser detectado como hereje**: +20-100 puntos\n' +
                 '• **Recibir penitencias**: +20 puntos por penitencia\n' +
                 '• **Comportamiento sospechoso**: Variable\n' +
                 '• **Blasfemias confirmadas**: +50 puntos',
          inline: false
        },
        {
          name: '📊 Cálculo del Rango',
          value: '**Pureza Neta = Puntos de Pureza - Puntos de Corrupción**\n\n' +
                 'Tu rango se determina únicamente por tu Pureza Neta. ' +
                 'Mantente puro y evita la corrupción para ascender en la jerarquía imperial.',
          inline: false
        },
        {
          name: '🎯 Estrategia',
          value: '• Usa `!capellan sermon` regularmente\n' +
                 '• Ayuda a detectar herejías con `!capellan herejia`\n' +
                 '• Evita comportamientos que puedan ser interpretados como heréticos\n' +
                 '• Participa activamente en el servidor',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'El Emperador Juzga Todos Tus Actos' });

    await message.reply({ embeds: [embed] });
  }

  private async showPenitence(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.RED)
      .setTitle('⚡ Sistema de Penitencias Imperial')
      .setDescription('*Las penitencias son castigos temporales impuestos por los Inquisidores por comportamiento herético o sospechoso.*')
      .addFields(
        {
          name: '⚖️ ¿Qué son las Penitencias?',
          value: '• **Castigos temporales** por comportamiento no imperial\n' +
                 '• **Duración**: Entre 1 y 168 horas (máximo 1 semana)\n' +
                 '• **Múltiples penitencias**: Un usuario puede tener varias activas\n' +
                 '• **Solo Inquisidores** pueden asignar penitencias',
          inline: false
        },
        {
          name: '🎯 Razones Comunes',
          value: '• Blasfemia contra el Emperador\n' +
                 '• Comportamiento herético confirmado\n' +
                 '• Desobediencia a las autoridades imperiales\n' +
                 '• Difusión de doctrinas heréticas\n' +
                 '• Falta de respeto a los Inquisidores',
          inline: false
        },
        {
          name: '📋 Efectos de la Penitencia',
          value: '• **+20 Puntos de Corrupción** por cada penitencia asignada\n' +
                 '• **Marca visible** en tu registro imperial\n' +
                 '• **Vigilancia aumentada** por parte de los Inquisidores\n' +
                 '• **Restricciones sociales** dentro del servidor',
          inline: false
        },
        {
          name: '🔄 Gestión de Penitencias',
          value: '• **Expiración automática** al cumplirse el tiempo\n' +
                 '• **Perdón imperial** por gracia de un Inquisidor\n' +
                 '• **Seguimiento por ID** único para cada penitencia\n' +
                 '• **Historial permanente** en tu perfil imperial',
          inline: false
        },
        {
          name: '🛡️ Protección para Inquisidores',
          value: '• Los **Inquisidores no pueden** recibir penitencias entre sí\n' +
                 '• Solo el **Emperador** (o el desarrollador) puede juzgar a un Inquisidor\n' +
                 '• Los Inquisidores están **exentos** del rate limiting de comandos',
          inline: false
        }
      )
      .addFields({
        name: '💡 Consejos para Evitar Penitencias',
        value: '• Mantén un comportamiento respetuoso y leal\n' +
               '• Evita blasfemias o comentarios heréticos\n' +
               '• Respeta a los Inquisidores y su autoridad\n' +
               '• Consulta las reglas del servidor regularmente',
        inline: false
      })
      .setTimestamp()
      .setFooter({ text: 'La Justicia del Emperador es Implacable' });

    await message.reply({ embeds: [embed] });
  }

  private async showAchievements(message: Message): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.PURPLE)
      .setTitle('🎖️ Sistema de Logros Imperial')
      .setDescription('*Los logros son reconocimientos especiales otorgados automáticamente por el sistema por actos destacados de servicio imperial.*')
      .addFields(
        {
          name: '🏆 Tipos de Logros',
          value: '• **Logros de Pureza**: Por alcanzar ciertos niveles de pureza\n' +
                 '• **Logros de Actividad**: Por participación constante\n' +
                 '• **Logros de Servicio**: Por acciones específicas\n' +
                 '• **Logros Especiales**: Por eventos únicos o raros',
          inline: false
        },
        {
          name: '🎯 Ejemplos de Logros',
          value: '• **Alma Pura**: Alcanzar 500 puntos de pureza neta\n' +
                 '• **Detector de Herejías**: Detectar 10 herejías\n' +
                 '• **Devoto Constante**: Recibir 50 sermones\n' +
                 '• **Veterano Imperial**: 100 días de servicio\n' +
                 '• **Cazador de Herejes**: Detectar una herejía extrema',
          inline: false
        },
        {
          name: '📊 Beneficios de los Logros',
          value: '• **Prestigio social** dentro del servidor\n' +
                 '• **Reconocimiento público** en rankings\n' +
                 '• **Historial de servicio** permanente\n' +
                 '• **Prueba de dedicación** al Emperador',
          inline: false
        },
        {
          name: '🔍 Consultar tus Logros',
          value: 'Usa `!capellan ranking` para ver tu perfil completo, ' +
                 'incluyendo todos los logros que has desbloqueado. ' +
                 'Los logros se otorgan automáticamente cuando cumples los requisitos.',
          inline: false
        }
      )
      .setTimestamp()
      .setFooter({ text: 'Gloria a Quienes Sirven con Honor' });

    await message.reply({ embeds: [embed] });
  }
}