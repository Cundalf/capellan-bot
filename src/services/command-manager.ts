
import { Message } from 'discord.js';
import { BaseCommand } from '@/commands/base-command';
import { HelpCommand } from '@/commands/help-command';
import { HeresyCommand } from '@/commands/heresy-command';
import { SermonCommand } from '@/commands/sermon-command';
import { InquisitorCommand } from '@/commands/inquisitor-command';
import { KnowledgeCommand } from '@/commands/knowledge-command';
import { BlessingCommand } from '@/commands/blessing-command';
import { PenitenceCommand } from '@/commands/penitence-command';
import { CredoCommand } from '@/commands/credo-command';
import { SearchCommand } from '@/commands/search-command';
import { SourcesCommand } from '@/commands/sources-command';
import { RankingCommand } from '@/commands/ranking-command';
import { ImperioCommand } from '@/commands/imperio-command';
import { InquisitorService } from './inquisitor-service';
import { RAGSystem } from './rag-system';
import { DocumentProcessor } from './document-processor';
import { GamificationService } from './gamification-service';
import { RateLimiter, RateLimitConfig } from './rate-limiter';
import { AITaskManager } from './ai-task-manager';
import { Logger } from '@/utils/logger';
import { CommandContext } from '@/types';

export class CommandManager {
  private commands: Map<string, BaseCommand> = new Map();
  private logger: Logger;
  private inquisitorService: InquisitorService;
  private gamificationService: GamificationService;
  private rateLimiter: RateLimiter;
  private aiTaskManager: AITaskManager;
  
  // AI commands that consume OpenAI tokens and should be rate limited
  private readonly aiCommands = new Set(['herejia', 'heresy', 'h', 'sermon', 's', 'conocimiento', 'knowledge', 'k', 'buscar', 'search']);

  constructor(
    logger: Logger,
    inquisitorService: InquisitorService,
    ragSystem: RAGSystem,
    documentProcessor: DocumentProcessor,
    gamificationService: GamificationService
  ) {
    this.logger = logger;
    this.inquisitorService = inquisitorService;
    this.gamificationService = gamificationService;
    
    // Initialize rate limiter: 3 AI requests per 60 seconds
    const rateLimitConfig: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 3
    };
    this.rateLimiter = new RateLimiter(rateLimitConfig, logger);
    this.aiTaskManager = new AITaskManager(logger);
    
    // Clean up stuck AI tasks every 5 minutes
    setInterval(() => {
      this.aiTaskManager.cleanupStuckTasks(5 * 60 * 1000);
    }, 5 * 60 * 1000);
    
    this.initializeCommands(ragSystem, documentProcessor);
  }

  private initializeCommands(ragSystem: RAGSystem, documentProcessor: DocumentProcessor) {
    const commands = [
      new HelpCommand(this.logger, this.inquisitorService),
      new HeresyCommand(this.logger, ragSystem, this.gamificationService),
      new SermonCommand(this.logger, ragSystem, this.gamificationService),
      new InquisitorCommand(this.logger, this.inquisitorService),
      new KnowledgeCommand(this.logger, documentProcessor, ragSystem),
      new BlessingCommand(this.logger, this.gamificationService),
      new PenitenceCommand(this.logger, this.gamificationService, this.inquisitorService),
      new CredoCommand(this.logger, this.gamificationService),
      new SearchCommand(this.logger, ragSystem),
      new SourcesCommand(this.logger, ragSystem),
      new RankingCommand(this.logger, this.gamificationService),
      new ImperioCommand(this.logger, this.gamificationService)
    ];

    // Register commands and their aliases
    for (const command of commands) {
      this.commands.set(command.name, command);
      
      for (const alias of command.aliases) {
        this.commands.set(alias, command);
      }
    }

    this.logger.info('Commands initialized', { 
      commandCount: commands.length,
      totalAliases: Array.from(this.commands.keys()).length
    });
  }

  async handleCommand(message: Message): Promise<void> {
    const content = message.content.trim();
    
    // Check for command prefixes
    const prefixes = ['!capellan', '!c'];
    let usedPrefix: string | null = null;
    
    for (const prefix of prefixes) {
      if (content.toLowerCase().startsWith(prefix.toLowerCase())) {
        usedPrefix = prefix;
        break;
      }
    }

    if (!usedPrefix) return;

    // Parse command and arguments
    const args = content.slice(usedPrefix.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) {
      // No command specified, show help
      const helpCommand = this.commands.get('help');
      if (helpCommand) {
        const context = this.createContext(message);
        await helpCommand.execute(message, [], context);
      }
      return;
    }

    const command = this.commands.get(commandName);
    
    if (!command) {
      await message.reply('*Comando no reconocido, hermano. Usa `!capellan help` para ver los comandos disponibles.*');
      return;
    }

    // Create context
    const context = this.createContext(message);

    // Check if command requires Inquisitor privileges
    if (command.requiresInquisitor && !context.isInquisitor) {
      await message.reply('🚫 *Este comando requiere privilegios de Inquisitor.*');
      return;
    }

    // Check rate limiting and AI task management for AI commands
    if (this.aiCommands.has(commandName)) {
      // Check if there's already an AI task running for this user
      if (this.aiTaskManager.hasActiveTask(context.userId)) {
        await message.reply('⏳ *Ya tienes una consulta al Capellán en curso. Espera a que termine antes de hacer otra.*');
        return;
      }

      // Check global AI task limit (only one AI task at a time)
      if (this.aiTaskManager.hasAnyActiveTask()) {
        const activeTasks = this.aiTaskManager.getActiveTasks();
        const activeUser = activeTasks[0];
        await message.reply(`🔄 *El Capellán está ocupado atendiendo a ${activeUser.username}. Espera tu turno, hermano.*`);
        return;
      }

      // Check rate limiting (except for Inquisitors)
      if (!context.isInquisitor && !this.rateLimiter.isAllowed(context.userId)) {
        const remainingTime = this.rateLimiter.getRemainingTime(context.userId);
        await message.reply(`⏰ *Debes esperar ${remainingTime} segundos antes de hacer otra consulta costosa al Capellán.*`);
        return;
      }

      // Start AI task tracking
      this.aiTaskManager.startTask(context.userId, context.username, commandName, context.channelId);
    }

    try {
      await command.execute(message, args, context);
      
      // Complete AI task if it was an AI command
      if (this.aiCommands.has(commandName)) {
        this.aiTaskManager.completeTask(context.userId);
      }
    } catch (error: any) {
      // Complete AI task if it was an AI command (even on error)
      if (this.aiCommands.has(commandName)) {
        this.aiTaskManager.completeTask(context.userId);
      }
      
      this.logger.error('Command execution failed', {
        error: error?.message || 'Unknown error',
        command: commandName,
        userId: context.userId,
        args
      });

      await message.reply('⚠️ *Los espíritus de la máquina han fallado. El error ha sido reportado a los Adeptus Mechanicus.*');
    }
  }

  private createContext(message: Message) {
    const isInquisitor = this.inquisitorService.isInquisitor(message.author.id);
    
    return {
      isInquisitor,
      userId: message.author.id,
      username: message.author.username,
      channelId: message.channel.id,
      guildId: message.guild?.id
    };
  }

  getCommandList(): Array<{ name: string; description: string; aliases: string[]; requiresInquisitor: boolean }> {
    const uniqueCommands = new Map();
    
    for (const [name, command] of this.commands) {
      if (name === command.name) { // Only include primary names, not aliases
        uniqueCommands.set(name, {
          name: command.name,
          description: command.description,
          aliases: command.aliases,
          requiresInquisitor: command.requiresInquisitor
        });
      }
    }
    
    return Array.from(uniqueCommands.values());
  }

  getCommand(name: string): BaseCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  getAITaskManager(): AITaskManager {
    return this.aiTaskManager;
  }
}