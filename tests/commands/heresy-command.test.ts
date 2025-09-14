import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { HeresyCommand } from '@/commands/heresy-command';
import { Logger } from '@/utils/logger';
import type { BotConfig, CommandContext } from '@/types';

// Mock Discord.js Message
class MockMessage {
  public reply = spyOn({}, 'reply').mockResolvedValue({
    edit: spyOn({}, 'edit').mockResolvedValue(undefined),
  });
  public edit = spyOn({}, 'edit').mockResolvedValue(undefined);

  constructor(
    public channel = { id: 'channel123', messages: { fetch: spyOn({}, 'fetch').mockResolvedValue({ content: 'Referenced message content' }) } },
    public guild = { id: 'guild123' },
    public reference?: { messageId: string }
  ) {}
}

// Mock GamificationService
class MockGamificationService {
  async getOrCreateProfile(userId: string, username: string) {
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

  async recordHeresyDetection(userId: string, level: string) {
    // Mock implementation
  }
}

// Mock RAGSystem
class MockRAGSystem {
  async generateCapellanResponse(text: string, type: string) {
    return {
      response: 'SOSPECHOSO - El mensaje contiene elementos que requieren vigilancia imperial.',
      sources: [
        {
          source: 'test-source',
          similarity: 0.8,
        },
      ],
      tokensUsed: 150,
    };
  }
}

describe('HeresyCommand', () => {
  let heresyCommand: HeresyCommand;
  let mockLogger: Logger;
  let mockRAGSystem: MockRAGSystem;
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
    spyOn(mockLogger, 'error').mockImplementation(() => {});
    spyOn(mockLogger, 'heresy').mockImplementation(() => {});

    mockRAGSystem = new MockRAGSystem();
    mockGamificationService = new MockGamificationService();
    heresyCommand = new HeresyCommand(mockLogger, mockRAGSystem as any, mockGamificationService as any);
  });

  test('should have correct command properties', () => {
    expect(heresyCommand.name).toBe('herejia');
    expect(heresyCommand.description).toBe('Analiza un mensaje en busca de herejía usando conocimiento del lore');
    expect(heresyCommand.aliases).toEqual(['heresy', 'h']);
    expect(heresyCommand.requiresInquisitor).toBe(false);
  });

  test('should show help when no text provided', async () => {
    const mockMessage = new MockMessage();

    await heresyCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalled();
    const replyCall = mockMessage.reply.mock.calls[0][0] as any;
    expect(replyCall.embeds).toBeDefined();
    expect(replyCall.embeds[0].data.title).toContain('Uso del Comando');
  });

  test('should analyze heresy in provided text', async () => {
    const mockMessage = new MockMessage();
    spyOn(mockRAGSystem, 'generateCapellanResponse').mockResolvedValue({
      response: 'SOSPECHOSO - El mensaje requiere vigilancia.',
      sources: [],
      tokensUsed: 100,
    });

    await heresyCommand.execute(mockMessage as any, ['test', 'message'], mockContext);

    expect(mockRAGSystem.generateCapellanResponse).toHaveBeenCalledWith(
      'test message',
      'heresy_analysis'
    );
    expect(mockMessage.reply).toHaveBeenCalled();
  });

  test('should analyze referenced message when no args provided', async () => {
    const fetchSpy = spyOn({}, 'fetch').mockResolvedValue({ content: 'Referenced content' });
    const mockMessage = new MockMessage(
      { id: 'channel123', messages: { fetch: fetchSpy } },
      { id: 'guild123' },
      { messageId: 'ref123' }
    );

    spyOn(mockRAGSystem, 'generateCapellanResponse').mockResolvedValue({
      response: 'SOSPECHOSO - Analysis complete.',
      sources: [],
      tokensUsed: 100,
    });

    await heresyCommand.execute(mockMessage as any, [], mockContext);

    expect(fetchSpy).toHaveBeenCalledWith('ref123');
    expect(mockRAGSystem.generateCapellanResponse).toHaveBeenCalledWith(
      'Referenced content',
      'heresy_analysis'
    );
  });

  test('should handle error when fetching referenced message', async () => {
    const mockMessage = new MockMessage(
      {
        id: 'channel123',
        messages: {
          fetch: spyOn({}, 'fetch').mockRejectedValue(new Error('Message not found'))
        }
      },
      { id: 'guild123' },
      { messageId: 'ref123' }
    );

    await heresyCommand.execute(mockMessage as any, [], mockContext);

    expect(mockMessage.reply).toHaveBeenCalledWith(
      '*No puedo acceder al mensaje referenciado, hermano.*'
    );
  });

  test('should extract heresy level correctly', () => {
    const extractHeresyLevel = (heresyCommand as any).extractHeresyLevel.bind(heresyCommand);

    expect(extractHeresyLevel('HEREJIA_EXTREMA detected')).toBe('HEREJIA_EXTREMA');
    expect(extractHeresyLevel('HEREJIA_MAYOR found')).toBe('HEREJIA_MAYOR');
    expect(extractHeresyLevel('SOSPECHOSO behavior')).toBe('SOSPECHOSO');
    expect(extractHeresyLevel('PURA_FE shown')).toBe('PURA_FE');
    expect(extractHeresyLevel('Unknown level')).toBe('SOSPECHOSO'); // Default fallback
  });

  test('should record heresy detection in gamification service', async () => {
    const mockMessage = new MockMessage();
    const recordSpy = spyOn(mockGamificationService, 'recordHeresyDetection').mockResolvedValue(undefined);

    await heresyCommand.execute(mockMessage as any, ['test', 'message'], mockContext);

    expect(recordSpy).toHaveBeenCalledWith('user123', 'SOSPECHOSO');
  });

  test('should handle RAG system errors gracefully', async () => {
    const mockMessage = new MockMessage();
    spyOn(mockRAGSystem, 'generateCapellanResponse').mockRejectedValue(new Error('API Error'));

    await heresyCommand.execute(mockMessage as any, ['test', 'message'], mockContext);

    expect(mockMessage.reply).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  test('should include sources in response when available', async () => {
    const mockMessage = new MockMessage();
    spyOn(mockRAGSystem, 'generateCapellanResponse').mockResolvedValue({
      response: 'SOSPECHOSO - Analysis complete.',
      sources: [
        { source: 'codex-astartes', similarity: 0.9 },
        { source: 'imperial-truth', similarity: 0.7 },
      ],
      tokensUsed: 200,
    });

    await heresyCommand.execute(mockMessage as any, ['test', 'message'], mockContext);

    expect(mockMessage.reply).toHaveBeenCalled();
    expect(mockRAGSystem.generateCapellanResponse).toHaveBeenCalled();
  });
});