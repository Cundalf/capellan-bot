import { Message, EmbedBuilder } from 'discord.js';
import { BaseCommand } from './base-command';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';
import { DISCORD_COLORS, WARHAMMER_CONSTANTS } from '@/utils/constants';

export class GreetCommand extends BaseCommand {
  name = 'saludar';
  description = 'El Capellán saluda como un verdadero servidor del Emperador';
  aliases = ['saludo', 'greet', 'greeting'];
  requiresInquisitor = false;

  constructor(logger: Logger) {
    super(logger);
  }

  async execute(message: Message, args: string[], context: CommandContext): Promise<void> {
    this.logCommand(context, this.name, args);

    const greetings = [
      {
        title: '🕊️ Ave Imperator!',
        description: `¡Saludos, ${context.username}! Por la gracia del Emperador en Su Trono Dorado, me alegra encontrar a un fiel servidor del Imperio en estas tierras desoladas.\n\n*El Emperador protege a quienes mantienen la fe. Que Su luz ilumine tu camino en estos tiempos oscuros.*`,
        footer: 'La fe es tu escudo, la devoción tu espada'
      },
      {
        title: '⚔️ En nombre del Emperador',
        description: `¡Hermano ${context.username}! Que la bendición del Maestro de la Humanidad caiga sobre ti. En estos tiempos donde la herejía acecha en cada sombra, es reconfortante encontrar a un alma pura.\n\n*Mantente firme en tu devoción, pues el Emperador recompensa a los fieles con Su protección eterna.*`,
        footer: 'Solo en la muerte termina el deber'
      },
      {
        title: '👑 Gloria al Emperador',
        description: `¡Salve, noble ${context.username}! Como Capellán del Imperio, es mi sagrado deber reconocer a aquellos que sirven fielmente. El Emperador desde Su Trono Dorado ve tu lealtad.\n\n*Que Su luz dorada ahuyente las tinieblas de tu alma y fortalezca tu espíritu para los desafíos venideros.*`,
        footer: 'El Emperador es vida'
      },
      {
        title: '✨ Bendiciones del Trono',
        description: `¡Por la gloria del Imperio, ${context.username}! Es un honor dirigirme a otro fiel servidor de la humanidad. En estos días sombríos, cada alma leal es un tesoro para el Imperio.\n\n*Que los vientos del Warp no puedan tocarte, pues llevas la marca de la fe verdadera en tu corazón.*`,
        footer: 'La ignorancia es una bendición'
      },
      {
        title: '🔥 Llama de la Fe',
        description: `¡Saludos en nombre del Maestro de la Humanidad, ${context.username}! Como guardián de las almas imperiales, reconozco en ti el fuego sagrado de la devoción.\n\n*Que la llama de la fe arda eternamente en tu corazón y que nunca conozcas la duda que lleva a la perdición.*`,
        footer: 'Bienaventurados los ignorantes'
      },
      {
        title: '⚡ Poder del Emperador',
        description: `¡Ave Imperator, hermano ${context.username}! Desde las sagradas naves catedrales hasta los mundos fronterizos, resonó el eco de tu llegada. El Emperador ve todo, y te ha bendecido con Su presencia.\n\n*Permanece vigilante contra la corrupción, pues en la pureza de pensamiento reside la salvación del alma.*`,
        footer: 'Una mente abierta es como una fortaleza desprotegida'
      }
    ];

    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];

    const embed = new EmbedBuilder()
      .setColor(DISCORD_COLORS.GOLD)
      .setTitle(randomGreeting.title)
      .setDescription(randomGreeting.description)
      .setTimestamp()
      .setFooter({ text: randomGreeting.footer });

    await message.reply({ embeds: [embed] });

    this.logger.info('Greeting command executed', {
      userId: context.userId,
      username: context.username,
      greetingTitle: randomGreeting.title
    });
  }
}