import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext } from '@/types';

// Mock services for all commands
const createMockServices = () => ({
  logger: (() => {
    const mockBotConfig: BotConfig = {
      autoHeresyDetectionChance: 0.2,
      maxDailyEmbeddings: 1000,
      sqlitePath: ':memory:',
      documentsPath: './test-documents',
      logLevel: 'info',
      steamOffersCheckInterval: 3,
      minDiscountPercent: 10,
    };
    const logger = new Logger(mockBotConfig);
    spyOn(logger, 'info').mockImplementation(() => {});
    spyOn(logger, 'error').mockImplementation(() => {});
    spyOn(logger, 'warn').mockImplementation(() => {});
    spyOn(logger, 'debug').mockImplementation(() => {});
    return logger;
  })(),
  ragSystem: {
    generateCapellanResponse: () => Promise.resolve({
      response: 'Test response',
      sources: [],
      tokensUsed: 100,
    }),
    getStats: () => ({
      documents: 10,
      embeddings: 10,
      sources: ['test.pdf'],
      types: { pdf: 10 },
    }),
  },
  gamificationService: {
    getOrCreateProfile: () => Promise.resolve({
      userId: 'test',
      username: 'test',
      purityPoints: 100,
      corruptionPoints: 0,
      totalMessages: 5,
      heresiesDetected: 0,
      sermonsReceived: 1,
      rank: 'Fiel',
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      achievements: [],
      penitencias: [],
    }),
    addPurityPoints: () => Promise.resolve(),
    getLeaderboard: () => [],
    getTopUsers: () => Promise.resolve([]),
    getUserStats: () => Promise.resolve({
      totalUsers: 10,
      averagePurity: 100,
      totalMessages: 50,
      totalHeresies: 1,
      activeUsers: 5,
    }),
  },
  inquisitorService: {
    isInquisitor: () => false,
    addInquisitor: () => Promise.resolve(),
    removeInquisitor: () => Promise.resolve(),
    getInquisitors: () => [],
  },
  documentProcessor: {
    downloadAndProcessUrl: () => Promise.resolve(),
    processTextDocument: () => Promise.resolve(),
  },
});

// Mock Message
class MockMessage {
  reply = spyOn({}, 'reply').mockResolvedValue({
    edit: spyOn({}, 'edit').mockResolvedValue(undefined),
  });
  constructor(public channel = { id: 'test' }, public guild = { id: 'test' }) {}
}

const mockContext: CommandContext = {
  isInquisitor: false,
  userId: 'test',
  username: 'test',
  channelId: 'test',
  guildId: 'test',
};

describe('Remaining Commands (Functional Tests)', () => {
  test('should have all commands importable', () => {
    // Test that all command modules can be imported without errors
    const commands = [
      '@/commands/ask-command',
      '@/commands/base-command',
      '@/commands/imperio-command',
      '@/commands/inquisitor-command',
      '@/commands/knowledge-command',
      '@/commands/penitence-command',
      '@/commands/ranking-command',
      '@/commands/search-command',
      '@/commands/sermon-command',
      '@/commands/sources-command',
    ];

    for (const commandModule of commands) {
      const command = require(commandModule);
      expect(command).toBeDefined();
      expect(typeof command).toBe('object');
    }
  });

  test('should execute AskCommand without errors', async () => {
    const services = createMockServices();
    const { AskCommand } = require('@/commands/ask-command');
    const command = new AskCommand(services.logger, services.ragSystem);
    const message = new MockMessage();

    await command.execute(message, ['test', 'question'], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute SourcesCommand without errors', async () => {
    const services = createMockServices();
    const { SourcesCommand } = require('@/commands/sources-command');
    const command = new SourcesCommand(services.logger, services.ragSystem);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute SearchCommand without errors', async () => {
    const services = createMockServices();
    const { SearchCommand } = require('@/commands/search-command');
    const command = new SearchCommand(services.logger, services.ragSystem);
    const message = new MockMessage();

    await command.execute(message, ['test'], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute SermonCommand without errors', async () => {
    const services = createMockServices();
    const { SermonCommand } = require('@/commands/sermon-command');
    const command = new SermonCommand(services.logger, services.ragSystem, services.gamificationService);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute RankingCommand without errors', async () => {
    const services = createMockServices();
    const { RankingCommand } = require('@/commands/ranking-command');
    const command = new RankingCommand(services.logger, services.gamificationService);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute ImperioCommand without errors', async () => {
    const services = createMockServices();
    const { ImperioCommand } = require('@/commands/imperio-command');
    const command = new ImperioCommand(services.logger, services.gamificationService);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute PenitenceCommand without errors', async () => {
    const services = createMockServices();
    const { PenitenceCommand } = require('@/commands/penitence-command');
    const command = new PenitenceCommand(services.logger, services.gamificationService, services.inquisitorService);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute KnowledgeCommand without errors', async () => {
    const services = createMockServices();
    const { KnowledgeCommand } = require('@/commands/knowledge-command');
    const command = new KnowledgeCommand(services.logger, services.documentProcessor, services.ragSystem);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });

  test('should execute InquisitorCommand without errors', async () => {
    const services = createMockServices();
    const { InquisitorCommand } = require('@/commands/inquisitor-command');
    const command = new InquisitorCommand(services.logger, services.inquisitorService);
    const message = new MockMessage();

    await command.execute(message, [], mockContext);
    expect(message.reply).toHaveBeenCalled();
  });
});