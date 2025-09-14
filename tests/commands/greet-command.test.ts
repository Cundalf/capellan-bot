import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { GreetCommand } from '@/commands/greet-command';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext } from '@/types';

// Mock Discord.js Message
class MockMessage {
  public reply = spyOn({}, 'reply').mockResolvedValue(undefined);

  constructor(public channel = { id: 'channel123' }, public guild = { id: 'guild123' }) {}
}

describe('GreetCommand', () => {
  let greetCommand: GreetCommand;
  let mockLogger: Logger;

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

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});

    greetCommand = new GreetCommand(mockLogger);
  });

  test('should have correct command properties', () => {
    expect(greetCommand.name).toBe('saludar');
    expect(greetCommand.description).toBe('El Capellán saluda como un verdadero servidor del Emperador');
    expect(greetCommand.aliases).toEqual(['saludo', 'greet', 'greeting']);
    expect(greetCommand.requiresInquisitor).toBe(false);
  });

  test('should execute greeting command', async () => {
    const mockMessage = new MockMessage();

    await greetCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          color: 0xffd700, // DISCORD_COLORS.GOLD
          title: expect.stringMatching(/🕊️|⚔️|👑|✨|🔥|⚡/),
          description: expect.stringContaining(mockContext.username),
          timestamp: expect.any(String),
          footer: expect.objectContaining({
            text: expect.any(String)
          })
        })
      })]
    });
  });

  test('should log command execution', async () => {
    const mockMessage = new MockMessage();

    await greetCommand.execute(mockMessage as any, [], mockContext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Greeting command executed',
      expect.objectContaining({
        userId: mockContext.userId,
        username: mockContext.username,
        greetingTitle: expect.any(String)
      })
    );
  });

  test('should include username in greeting description', async () => {
    const mockMessage = new MockMessage();

    await greetCommand.execute(mockMessage as any, [], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    expect(embed.data.description).toContain(mockContext.username);
  });

  test('should use different greetings randomly', async () => {
    const mockMessage = new MockMessage();
    const greetings = new Set();

    // Execute multiple times to test randomness
    for (let i = 0; i < 10; i++) {
      mockMessage.reply.mockClear();
      await greetCommand.execute(mockMessage as any, [], mockContext);

      const replyCall = mockMessage.reply.mock.calls[0][0] as any;
      const embed = replyCall.embeds[0];
      greetings.add(embed.data.title);
    }

    // Should have at least 2 different greetings in 10 tries (statistically very likely)
    expect(greetings.size).toBeGreaterThan(1);
  });

  test('should contain Warhammer 40k themed content', async () => {
    const mockMessage = new MockMessage();

    await greetCommand.execute(mockMessage as any, [], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    const fullContent = embed.data.description + embed.data.footer.text;

    // Should contain Warhammer 40k references
    expect(fullContent.toLowerCase()).toMatch(/emperador|imperio|fe|trono|warp|alma|devoción|bendición/);
  });

  test('should handle different usernames correctly', async () => {
    const mockMessage = new MockMessage();
    const differentContext = {
      ...mockContext,
      username: 'DifferentUser123'
    };

    await greetCommand.execute(mockMessage as any, [], differentContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    expect(embed.data.description).toContain('DifferentUser123');
    expect(embed.data.description).not.toContain('TestUser');
  });

  test('should work with empty args array', async () => {
    const mockMessage = new MockMessage();

    // Should not throw with empty args
    await expect(greetCommand.execute(mockMessage as any, [], mockContext)).resolves.toBeUndefined();

    expect(mockMessage.reply).toHaveBeenCalled();
  });

  test('should work with args provided', async () => {
    const mockMessage = new MockMessage();

    // Should ignore args and work normally
    await expect(greetCommand.execute(mockMessage as any, ['ignored', 'args'], mockContext)).resolves.toBeUndefined();

    expect(mockMessage.reply).toHaveBeenCalled();
  });
});