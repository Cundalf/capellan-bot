import { 
  SlashCommandBuilder, 
  SlashCommandSubcommandBuilder,
  REST, 
  Routes, 
  Client,
  CommandInteraction,
  InteractionType
} from 'discord.js';
import { Logger } from '@/utils/logger';
import { CommandManager } from './command-manager';
import { CommandContext } from '@/types';

export class SlashCommandManager {
  private client: Client;
  private logger: Logger;
  private commandManager: CommandManager;
  private rest: REST;

  constructor(client: Client, logger: Logger, commandManager: CommandManager) {
    this.client = client;
    this.logger = logger;
    this.commandManager = commandManager;
    this.rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  }

  async registerSlashCommands(): Promise<void> {
    try {
      this.logger.info('Registrando slash commands...');

      const commands = this.buildSlashCommands();
      
      // Limpiar comandos de servidor primero para evitar duplicados
      const guilds = this.client.guilds.cache;
      for (const [guildId, guild] of guilds) {
        try {
          await this.rest.put(
            Routes.applicationGuildCommands(this.client.user!.id, guildId),
            { body: [] }
          );
          this.logger.info(`🧹 Comandos de servidor limpiados en: ${guild.name}`);
        } catch (guildError: any) {
          this.logger.warn(`No se pudieron limpiar comandos en servidor ${guild.name}:`, guildError.message);
        }
      }
      
      // Register commands globally
      const globalData = await this.rest.put(
        Routes.applicationCommands(this.client.user!.id),
        { body: commands }
      ) as any[];

      this.logger.info(`✅ ${globalData.length} slash commands globales registrados exitosamente`);
      
    } catch (error: any) {
      this.logger.error('Error registrando slash commands', { 
        error: error?.message || 'Unknown error' 
      });
      throw error;
    }
  }

  private buildSlashCommands() {
    const commands = [
      // Comandos directos (sin subcomandos)
      new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la ayuda de comandos disponibles'),

      new SlashCommandBuilder()
        .setName('herejia')
        .setDescription('Detecta herejía en un mensaje')
        .addStringOption(option =>
          option
            .setName('mensaje')
            .setDescription('El mensaje a analizar')
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('sermon')
        .setDescription('Genera un sermón del Capellán')
        .addStringOption(option =>
          option
            .setName('tema')
            .setDescription('Tema del sermón')
            .setRequired(false)
        ),

      new SlashCommandBuilder()
        .setName('buscar')
        .setDescription('Busca en la base de conocimientos')
        .addStringOption(option =>
          option
            .setName('consulta')
            .setDescription('Consulta a realizar')
            .setRequired(true)
        ),

      new SlashCommandBuilder()
        .setName('fuentes')
        .setDescription('Muestra las fuentes de conocimiento disponibles'),

      new SlashCommandBuilder()
        .setName('bendicion')
        .setDescription('Recibe una bendición del Capellán'),

      new SlashCommandBuilder()
        .setName('credo')
        .setDescription('Recita el Credo Imperial'),

      new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Muestra el ranking de fieles'),

      new SlashCommandBuilder()
        .setName('imperio')
        .setDescription('Información sobre el Imperio'),

      new SlashCommandBuilder()
        .setName('preguntar')
        .setDescription('Pregunta al Capellán sobre el lore de Warhammer 40k')
        .addStringOption(option =>
          option
            .setName('pregunta')
            .setDescription('Tu pregunta sobre el lore')
            .setRequired(true)
        )
    ];

    return commands.map(command => command.toJSON());
  }

  async handleSlashCommand(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    try {
      // Crear contexto similar al de los comandos de prefijo
      const context = this.createContext(interaction);
      
      // Mapear slash command a comando de prefijo
      const commandName = this.mapSlashToPrefixCommand(interaction);
      const args = this.extractArgsFromInteraction(interaction);

      // Obtener el comando del CommandManager
      const command = this.commandManager.getCommand(commandName);
      
      if (!command) {
        await interaction.reply('*Comando no reconocido, hermano. Usa `/capellan help` para ver los comandos disponibles.*');
        return;
      }

      // Verificar privilegios de Inquisidor
      if (command.requiresInquisitor && !context.isInquisitor) {
        await interaction.reply('🚫 *Este comando requiere privilegios de Inquisidor.*');
        return;
      }

      // Verificar rate limiting y AI task management
      const aiCommands = new Set(['herejia', 'heresy', 'h', 'sermon', 's', 'conocimiento', 'knowledge', 'k', 'buscar', 'search']);
      
      if (aiCommands.has(commandName)) {
        const aiTaskManager = this.commandManager.getAITaskManager();
        const rateLimiter = this.commandManager.getRateLimiter();

        // Verificar si hay una tarea AI activa para este usuario
        if (aiTaskManager.hasActiveTask(context.userId)) {
          await interaction.reply('⏳ *Ya tienes una consulta al Capellán en curso. Espera a que termine antes de hacer otra.*');
          return;
        }

        // Verificar límite global de tareas AI
        if (aiTaskManager.hasAnyActiveTask()) {
          const activeTasks = aiTaskManager.getActiveTasks();
          const activeUser = activeTasks[0];
          await interaction.reply(`🔄 *El Capellán está ocupado atendiendo a ${activeUser.username}. Espera tu turno, hermano.*`);
          return;
        }

        // Verificar rate limiting (excepto para Inquisidores)
        if (!context.isInquisitor && !rateLimiter.isAllowed(context.userId)) {
          const remainingTime = rateLimiter.getRemainingTime(context.userId);
          await interaction.reply(`⏰ *Debes esperar ${remainingTime} segundos antes de hacer otra consulta costosa al Capellán.*`);
          return;
        }

        // Iniciar seguimiento de tarea AI
        aiTaskManager.startTask(context.userId, context.username, commandName, context.channelId);
      }

      // Ejecutar el comando
      await command.execute(interaction, args, context);
      
      // Completar tarea AI si era un comando AI
      if (this.commandManager.getAITaskManager().hasActiveTask(context.userId)) {
        this.commandManager.getAITaskManager().completeTask(context.userId);
      }

    } catch (error: any) {
      this.logger.error('Slash command execution failed', {
        error: error?.message || 'Unknown error',
        command: interaction.commandName,
        userId: interaction.user.id,
        subcommand: interaction.options.getSubcommand(false)
      });

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply('⚠️ *Los espíritus de la máquina han fallado. El error ha sido reportado a los Adeptus Mechanicus.*');
      } else {
        await interaction.followUp('⚠️ *Los espíritus de la máquina han fallado. El error ha sido reportado a los Adeptus Mechanicus.*');
      }
    }
  }

  private mapSlashToPrefixCommand(interaction: CommandInteraction): string {
    const commandName = interaction.commandName;

    // Mapear comandos directos a comandos de prefijo
    const commandMap: { [key: string]: string } = {
      'help': 'help',
      'herejia': 'herejia',
      'sermon': 'sermon',
      'buscar': 'buscar',
      'fuentes': 'sources',
      'bendicion': 'blessing',
      'credo': 'credo',
      'ranking': 'ranking',
      'imperio': 'imperio',
      'preguntar': 'preguntar'
    };

    return commandMap[commandName] || 'help';
  }

  private extractArgsFromInteraction(interaction: CommandInteraction): string[] {
    const args: string[] = [];
    
    // Extraer argumentos de las opciones
    const options = (interaction as any).options;
    if (options?.data) {
      options.data.forEach((option: any) => {
        if (option.value) {
          args.push(String(option.value));
        }
      });
    }

    return args;
  }

  private createContext(interaction: CommandInteraction): CommandContext {
    return {
      isInquisitor: false, // Se determinará en el CommandManager
      userId: interaction.user.id,
      username: interaction.user.username,
      channelId: interaction.channelId || '',
      guildId: interaction.guildId || undefined
    };
  }
}
