import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { HelpCommand } from '@/commands/help-command';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext } from '@/types';

// Mock Discord.js Message
class MockMessage {
  public reply = spyOn({}, 'reply').mockResolvedValue(undefined);

  constructor(
    public channel = { id: 'channel123' },
    public guild = { id: 'guild123' },
    public author = { id: 'user123', send: spyOn({}, 'send').mockResolvedValue(undefined) }
  ) {}
}

// Mock InquisitorService
class MockInquisitorService {
  isInquisitor(userId: string): boolean {
    return userId === 'inquisitor123';
  }
}

describe('HelpCommand', () => {
  let helpCommand: HelpCommand;
  let mockLogger: Logger;
  let mockInquisitorService: MockInquisitorService;

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: './database/test-vector-store.sqlite',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  const mockContext: CommandContext = {
    isInquisitor: false,
    userId: 'user123',
    username: 'TestUser',
    channelId: 'channel123',
    guildId: 'guild123',
  };

  const mockInquisitorContext: CommandContext = {
    isInquisitor: true,
    userId: 'inquisitor123',
    username: 'TestInquisitor',
    channelId: 'channel123',
    guildId: 'guild123',
  };

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});

    mockInquisitorService = new MockInquisitorService();
    helpCommand = new HelpCommand(mockLogger, mockInquisitorService as any);
  });

  test('should have correct command properties', () => {
    expect(helpCommand.name).toBe('help');
    expect(helpCommand.description).toBe('Muestra ayuda sobre los comandos disponibles');
    expect(helpCommand.aliases).toEqual(['ayuda', 'comandos']);
    expect(helpCommand.requiresInquisitor).toBe(false);
  });

  test('should show regular help for normal users', async () => {
    const mockMessage = new MockMessage();

    await helpCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalled();
    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds[0].data.title).toContain('Comandos del Capellán');
  });

  test('should show special response for inquisitors', async () => {
    const mockMessage = new MockMessage();

    await helpCommand.execute(mockMessage as any, [], mockInquisitorContext);

    expect(mockMessage.reply).toHaveBeenCalled();
    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds[0].data.title).toContain('Secretos del Capellán');
  });

  test('should send DM to inquisitors', async () => {
    const mockMessage = new MockMessage();

    await helpCommand.execute(mockMessage as any, [], mockInquisitorContext);

    expect(mockMessage.author.send).toHaveBeenCalled();
  });

  test('should handle DM failure for inquisitors', async () => {
    const mockMessage = new MockMessage();
    mockMessage.author.send.mockRejectedValue(new Error('Cannot send DM'));

    await helpCommand.execute(mockMessage as any, [], mockInquisitorContext);

    expect(mockMessage.reply).toHaveBeenCalledTimes(2); // Initial response + follow-up
  });

  test('should log command execution', async () => {
    const mockMessage = new MockMessage();

    await helpCommand.execute(mockMessage as any, [], mockContext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Command executed: help',
      expect.objectContaining({
        userId: 'user123',
        username: 'TestUser',
      })
    );
  });
});