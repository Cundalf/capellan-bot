import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { CommandManager } from '@/services/command-manager';
import { Logger } from '@/utils/logger';
import type { BotConfig } from '@/types';

// Mock Discord.js Message
class MockMessage {
  constructor(
    public content: string,
    public author = { id: 'user123', username: 'testuser' },
    public channel = { id: 'channel123' },
    public guild = { id: 'guild123' }
  ) {}

  reply = spyOn({}, 'reply').mockResolvedValue(undefined);
}

describe('CommandManager', () => {
  let mockLogger: Logger;
  let mockInquisitorService: any;
  let mockRAGSystem: any;
  let mockDocumentProcessor: any;
  let mockGamificationService: any;
  let commandManager: CommandManager;

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: ':memory:',
    documentsPath: './test-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'error').mockImplementation(() => {});
    spyOn(mockLogger, 'warn').mockImplementation(() => {});
    spyOn(mockLogger, 'debug').mockImplementation(() => {});

    mockInquisitorService = {
      isInquisitor: spyOn({}, 'isInquisitor').mockReturnValue(false),
    };

    mockRAGSystem = {
      addDocument: spyOn({}, 'addDocument').mockResolvedValue(undefined),
      generateCapellanResponse: spyOn({}, 'generateCapellanResponse').mockResolvedValue({
        response: 'Test response',
        sources: [],
        tokensUsed: 100,
      }),
      getStats: () => ({ documents: 0, embeddings: 0, sources: [], types: {} }),
    };

    mockDocumentProcessor = {
      processTextDocument: spyOn({}, 'processTextDocument').mockResolvedValue(undefined),
    };

    mockGamificationService = {
      getOrCreateProfile: spyOn({}, 'getOrCreateProfile').mockResolvedValue({
        userId: 'test',
        username: 'test',
        purityPoints: 100,
        corruptionPoints: 0,
        totalMessages: 0,
        heresiesDetected: 0,
        sermonsReceived: 0,
        rank: 'Ciudadano',
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        achievements: [],
        penitencias: [],
      }),
      addPurityPoints: spyOn({}, 'addPurityPoints').mockResolvedValue(),
      getLeaderboard: spyOn({}, 'getLeaderboard').mockReturnValue([]),
    };

    commandManager = new CommandManager(
      mockLogger,
      mockInquisitorService,
      mockRAGSystem,
      mockDocumentProcessor,
      mockGamificationService
    );
  });

  test('should create CommandManager instance', () => {
    expect(commandManager).toBeDefined();
    expect(commandManager).toBeInstanceOf(CommandManager);
  });

  test('should initialize commands properly', () => {
    const commandList = commandManager.getCommandList();
    expect(commandList).toBeInstanceOf(Array);
    expect(commandList.length).toBeGreaterThan(0);

    // Should have common commands
    const commandNames = commandList.map(cmd => cmd.name);
    expect(commandNames).toContain('help');
    expect(commandNames).toContain('herejia');
    expect(commandNames).toContain('sermon');
    expect(commandNames).toContain('credo');
  });

  test('should get commands by name', () => {
    // Test getting existing command
    const helpCommand = commandManager.getCommand('help');
    expect(helpCommand).toBeDefined();

    // Test getting non-existing command
    const invalidCommand = commandManager.getCommand('nonexistent');
    expect(invalidCommand).toBeUndefined();

    // Test case insensitive
    const helpCommandUpper = commandManager.getCommand('HELP');
    expect(helpCommandUpper).toBeDefined();
  });

  test('should handle commands with correct prefix', async () => {
    const message = new MockMessage('!capellan help');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalled();
  });

  test('should handle commands with short prefix', async () => {
    const message = new MockMessage('!c help');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalled();
  });

  test('should ignore messages without prefix', async () => {
    const message = new MockMessage('hello world');

    await commandManager.handleCommand(message as any);

    expect(message.reply).not.toHaveBeenCalled();
  });

  test('should show help when no command specified', async () => {
    const message = new MockMessage('!capellan');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalled();
  });

  test('should handle unknown commands', async () => {
    const message = new MockMessage('!capellan unknowncommand');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalledWith(
      '*Comando no reconocido, hermano. Usa `!capellan help` para ver los comandos disponibles.*'
    );
  });

  test('should handle inquisitor commands', async () => {
    const message = new MockMessage('!capellan inquisidor list');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalled();
    // Should get some response (either error or privileges check)
  });

  test('should have rate limiter and AI task manager', () => {
    const rateLimiter = commandManager.getRateLimiter();
    expect(rateLimiter).toBeDefined();

    const aiTaskManager = commandManager.getAITaskManager();
    expect(aiTaskManager).toBeDefined();
  });

  test('should handle command execution errors', async () => {
    // Mock a command that throws an error
    const helpCommand = commandManager.getCommand('help');
    if (helpCommand) {
      spyOn(helpCommand, 'execute').mockRejectedValue(new Error('Test error'));
    }

    const message = new MockMessage('!capellan help');

    await commandManager.handleCommand(message as any);

    expect(mockLogger.error).toHaveBeenCalled();
    expect(message.reply).toHaveBeenCalledWith(
      '⚠️ *Los espíritus de la máquina han fallado. El error ha sido reportado a los Adeptus Mechanicus.*'
    );
  });

  test('should handle AI command rate limiting', async () => {
    // Get the rate limiter and make it return false
    const rateLimiter = commandManager.getRateLimiter();
    spyOn(rateLimiter, 'isAllowed').mockReturnValue(false);
    spyOn(rateLimiter, 'getRemainingTime').mockReturnValue(30);

    const message = new MockMessage('!capellan herejia test message');

    await commandManager.handleCommand(message as any);

    expect(message.reply).toHaveBeenCalledWith(
      expect.stringContaining('Debes esperar 30 segundos')
    );
  });
});