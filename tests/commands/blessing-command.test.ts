import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { BlessingCommand } from '@/commands/blessing-command';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext, UserProfile } from '@/types';

// Mock Discord.js Message and User
class MockUser {
  constructor(public id: string, public username: string) {}
}

class MockClient {
  users = {
    fetch: spyOn({}, 'fetch').mockImplementation(async (id: string) => {
      return new MockUser(id, `User${id}`);
    })
  };
}

class MockMessage {
  public reply = spyOn({}, 'reply').mockResolvedValue(undefined);
  public client = new MockClient();

  constructor(public channel = { id: 'channel123' }, public guild = { id: 'guild123' }) {}
}

// Mock GamificationService
class MockGamificationService {
  private profiles: Map<string, UserProfile> = new Map();

  async getOrCreateProfile(userId: string, username: string): Promise<UserProfile> {
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, {
        userId,
        username,
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
    }
    return this.profiles.get(userId)!;
  }

  async addPurityPoints(userId: string, points: number, reason: string): Promise<UserProfile | null> {
    const profile = this.profiles.get(userId);
    if (profile) {
      profile.purityPoints += points;
      return profile;
    }
    return null;
  }
}

describe('BlessingCommand', () => {
  let blessingCommand: BlessingCommand;
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
    blessingCommand = new BlessingCommand(mockLogger, mockGamificationService as any);
  });

  test('should have correct command properties', () => {
    expect(blessingCommand.name).toBe('bendicion');
    expect(blessingCommand.description).toBe('Otorga una bendición imperial a un usuario');
    expect(blessingCommand.aliases).toEqual(['blessing', 'bless']);
    expect(blessingCommand.requiresInquisitor).toBe(false);
  });

  test('should show self blessing when no arguments provided', async () => {
    const mockMessage = new MockMessage();

    await blessingCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          title: '🕊️ Bendición Personal',
          description: expect.stringContaining(mockContext.username),
          color: 0xffd700 // DISCORD_COLORS.GOLD
        })
      })]
    });
  });

  test('should enforce cooldown period', async () => {
    const mockMessage = new MockMessage();

    // Mock Date.now to control time
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // First blessing
    await blessingCommand.execute(mockMessage as any, ['<@456>'], mockContext);

    // Try to bless again immediately (should be blocked by cooldown)
    currentTime += 10 * 60 * 1000; // 10 minutes later (less than 30 min cooldown)
    mockMessage.reply.mockClear();

    await blessingCommand.execute(mockMessage as any, ['<@456>'], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith(
      expect.stringContaining('Debes esperar') && expect.stringContaining('minutos antes de bendecir')
    );

    Date.now = originalNow;
  });

  test('should allow blessing after cooldown expires', async () => {
    const mockMessage = new MockMessage();

    // Mock Date.now
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // First blessing
    await blessingCommand.execute(mockMessage as any, ['<@456>'], mockContext);

    // Wait for cooldown to expire
    currentTime += 31 * 60 * 1000; // 31 minutes later
    mockMessage.reply.mockClear();

    await blessingCommand.execute(mockMessage as any, ['<@789>'], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          title: '🕊️ Bendición Imperial'
        })
      })]
    });

    Date.now = originalNow;
  });

  test('should prevent self blessing via mention', async () => {
    const mockMessage = new MockMessage();

    // Try to bless yourself
    await blessingCommand.execute(mockMessage as any, [`<@${mockContext.userId}>`], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith(
      '*No puedes bendecirte a ti mismo, hermano. La humildad es una virtud imperial.*'
    );
  });

  test('should successfully bless another user', async () => {
    const mockMessage = new MockMessage();
    const targetUserId = '456';

    await blessingCommand.execute(mockMessage as any, [`<@${targetUserId}>`], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({
        data: expect.objectContaining({
          title: '🕊️ Bendición Imperial',
          description: expect.stringContaining('User456'),
          fields: [
            expect.objectContaining({
              name: '🙏 Bendecido por',
              value: mockContext.username,
              inline: true
            }),
            expect.objectContaining({
              name: '✨ Puntos de Pureza',
              value: '+15 puntos',
              inline: true
            }),
            expect.objectContaining({
              name: '👁️ Nuevo Rango',
              value: expect.stringMatching(/Ciudadano/),
              inline: true
            })
          ]
        })
      })]
    });
  });

  test('should award points to both users', async () => {
    const mockMessage = new MockMessage();
    const targetUserId = '456';

    const addPurityPointsSpy = spyOn(mockGamificationService, 'addPurityPoints').mockResolvedValue({
      userId: 'test',
      username: 'test',
      purityPoints: 115,
      corruptionPoints: 0,
      totalMessages: 0,
      heresiesDetected: 0,
      sermonsReceived: 0,
      rank: 'Ciudadano',
      joinedAt: '',
      lastActivity: '',
      achievements: [],
      penitencias: [],
    });

    await blessingCommand.execute(mockMessage as any, [`<@${targetUserId}>`], mockContext);

    // Should award 15 points to target
    expect(addPurityPointsSpy).toHaveBeenCalledWith(
      targetUserId,
      15,
      `Bendición de ${mockContext.username}`
    );

    // Should award 5 points to blesser
    expect(addPurityPointsSpy).toHaveBeenCalledWith(
      mockContext.userId,
      5,
      'Otorgar bendición'
    );
  });

  test('should handle user not found gracefully', async () => {
    const mockMessage = new MockMessage();

    // Mock client.users.fetch to throw error
    mockMessage.client.users.fetch.mockRejectedValue(new Error('User not found'));

    await blessingCommand.execute(mockMessage as any, ['<@nonexistent>'], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith(
      '*No puedo encontrar a ese usuario, hermano.*'
    );
  });

  test('should log blessing activity', async () => {
    const mockMessage = new MockMessage();
    const targetUserId = '456';

    await blessingCommand.execute(mockMessage as any, [`<@${targetUserId}>`], mockContext);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Blessing given',
      expect.objectContaining({
        blesser: mockContext.userId,
        target: targetUserId,
        targetRank: 'Ciudadano'
      })
    );
  });

  test('should contain Warhammer 40k themed blessings', async () => {
    const mockMessage = new MockMessage();
    const targetUserId = '456';

    await blessingCommand.execute(mockMessage as any, [`<@${targetUserId}>`], mockContext);

    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    const embed = replyCall.embeds[0];

    // Should contain Warhammer 40k references
    const description = embed.data.description.toLowerCase();
    expect(description).toMatch(/emperador|ave imperator|warp|fe|bendición|luz dorada/);
  });

  test('should use different blessing messages randomly', async () => {
    const mockMessage = new MockMessage();
    const blessings = new Set();

    // Execute multiple times to test randomness
    for (let i = 0; i < 10; i++) {
      mockMessage.reply.mockClear();
      await blessingCommand.execute(mockMessage as any, [`<@user${i}>`], mockContext);

      if (mockMessage.reply.mock.calls.length > 0) {
        const replyCall = mockMessage.reply.mock.calls[0][0] as any;
        if (replyCall.embeds && replyCall.embeds[0]) {
          blessings.add(replyCall.embeds[0].data.description);
        }
      }

      // Reset cooldown by manipulating internal state
      const cooldownMap = (blessingCommand as any).lastBlessings;
      cooldownMap.clear();
    }

    // Should have at least 2 different blessings in 10 tries
    expect(blessings.size).toBeGreaterThan(1);
  });

  test('should extract user ID from mention correctly', async () => {
    const mockMessage = new MockMessage();

    // Test different mention formats
    const mentionFormats = ['<@123>', '<@!123>', '<@&123>'];

    for (const mention of mentionFormats) {
      mockMessage.reply.mockClear();
      await blessingCommand.execute(mockMessage as any, [mention], mockContext);

      // Should attempt to fetch the user (will either succeed or fail gracefully)
      expect(mockMessage.client.users.fetch).toHaveBeenCalled();
    }
  });
});