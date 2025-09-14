import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { CredoCommand } from '@/commands/credo-command';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext, UserProfile } from '@/types';

// Mock Discord.js Message
class MockMessage {
  public reply = spyOn({}, 'reply').mockResolvedValue(undefined);

  constructor(public channel = { id: 'channel123' }, public guild = { id: 'guild123' }) {}
}

// Mock GamificationService
class MockGamificationService {
  async getOrCreateProfile(userId: string, username: string): Promise<UserProfile> {
    return {
      userId,
      username,
      purityPoints: 150,
      corruptionPoints: 0,
      totalMessages: 10,
      heresiesDetected: 0,
      sermonsReceived: 1,
      rank: 'Fiel',
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      achievements: [],
      penitencias: [],
    };
  }

  async recordMessage(userId: string): Promise<void> {
    // Mock implementation
  }

  async addPurityPoints(userId: string, points: number, reason: string): Promise<UserProfile | null> {
    return {
      userId,
      username: 'test',
      purityPoints: 155,
      corruptionPoints: 0,
      totalMessages: 11,
      heresiesDetected: 0,
      sermonsReceived: 1,
      rank: 'Fiel',
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      achievements: [],
      penitencias: [],
    };
  }
}

describe('CredoCommand', () => {
  let credoCommand: CredoCommand;
  let mockLogger: Logger;
  let mockGamificationService: MockGamificationService;

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

    mockGamificationService = new MockGamificationService();
    credoCommand = new CredoCommand(mockLogger, mockGamificationService as any);
  });

  test('should have correct command properties', () => {
    expect(credoCommand.name).toBe('credo');
    expect(credoCommand.description).toBe('Recita el Credo Imperial');
    expect(credoCommand.aliases).toEqual(['creed', 'prayer']);
    expect(credoCommand.requiresInquisitor).toBe(false);
  });

  test('should execute credo command successfully', async () => {
    const mockMessage = new MockMessage();

    await credoCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalled();

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds.length).toBe(1);

    const embed = replyCall.embeds[0];
    expect(embed.data.title).toContain('📜');
    expect(embed.data.description).toContain('Emperador');
    expect(embed.data.color).toBe(0xffd700);
  });

  test('should award purity points', async () => {
    const mockMessage = new MockMessage();
    const addPuritySpy = spyOn(mockGamificationService, 'addPurityPoints').mockResolvedValue({
      userId: 'user123',
      username: 'TestUser',
      purityPoints: 155,
      corruptionPoints: 0,
      totalMessages: 11,
      heresiesDetected: 0,
      sermonsReceived: 1,
      rank: 'Fiel',
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      achievements: [],
      penitencias: [],
    });

    await credoCommand.execute(mockMessage as any, [], mockContext);

    expect(addPuritySpy).toHaveBeenCalledWith(
      mockContext.userId,
      8,
      'Recitación del Credo Imperial'
    );
  });

  test('should have cooldown functionality', async () => {
    const mockMessage = new MockMessage();

    // Mock Date.now to control cooldown
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // First execution should work
    await credoCommand.execute(mockMessage as any, [], mockContext);
    expect(mockMessage.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          title: expect.stringMatching(/📜/)
        })
      })]
    });

    // Second execution immediately should be blocked
    mockMessage.reply.mockClear();
    await credoCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith(
      expect.stringContaining('Has recitado el Credo recientemente')
    );

    Date.now = originalNow;
  });

  test('should contain Warhammer 40k themed content', async () => {
    const mockMessage = new MockMessage();

    await credoCommand.execute(mockMessage as any, [], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    const fullContent = embed.data.description + ' ' + embed.data.footer.text;

    // Should contain Imperial themes
    expect(fullContent.toLowerCase()).toMatch(/emperador|imperial|fe|trono|protege/);
  });

  test('should display user statistics correctly', async () => {
    const mockMessage = new MockMessage();

    await credoCommand.execute(mockMessage as any, [], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    // Should contain user stats in fields
    const fieldsText = embed.data.fields.map((f: any) => f.name + ' ' + f.value).join(' ');
    expect(fieldsText).toContain('+8 Pureza'); // points gained
    expect(fieldsText).toContain('🙏 Fiel'); // rank with emoji
    expect(fieldsText).toContain('TestUser'); // username
  });

  test('should handle profile creation for new users', async () => {
    const mockMessage = new MockMessage();
    const getOrCreateSpy = spyOn(mockGamificationService, 'getOrCreateProfile').mockResolvedValue({
      userId: 'newuser',
      username: 'NewUser',
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
    });

    const newUserContext = { ...mockContext, userId: 'newuser', username: 'NewUser' };

    await credoCommand.execute(mockMessage as any, [], newUserContext);

    expect(getOrCreateSpy).toHaveBeenCalledWith('newuser', 'NewUser');
  });

  test('should work with different user ranks', async () => {
    const mockMessage = new MockMessage();

    // Mock high-rank user
    spyOn(mockGamificationService, 'getOrCreateProfile').mockResolvedValue({
      userId: 'user123',
      username: 'TestUser',
      purityPoints: 800,
      corruptionPoints: 0,
      totalMessages: 100,
      heresiesDetected: 5,
      sermonsReceived: 20,
      rank: 'Santo',
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      achievements: ['faithful_servant', 'heresy_hunter'],
      penitencias: [],
    });

    await credoCommand.execute(mockMessage as any, [], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];
    const fieldsText = embed.data.fields.map((f: any) => f.name + ' ' + f.value).join(' ');

    expect(fieldsText).toContain('😇 Santo');
    expect(fieldsText).toContain('+8 Pureza');
  });
});