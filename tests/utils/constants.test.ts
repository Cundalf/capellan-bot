import { expect, test, describe } from 'bun:test';
import { WARHAMMER_CONSTANTS, DISCORD_COLORS } from '@/utils/constants';

describe('WARHAMMER_CONSTANTS', () => {
  test('should have allowed domains defined', () => {
    expect(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS).toBeDefined();
    expect(Array.isArray(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS)).toBe(true);
    expect(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS.length).toBeGreaterThan(0);
  });

  test('should contain expected domains', () => {
    expect(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS).toContain('wh40k.lexicanum.com');
    expect(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS).toContain('warhammer40k.fandom.com');
    expect(WARHAMMER_CONSTANTS.ALLOWED_DOMAINS).toContain('warhammer-community.com');
  });

  test('should have heretical keywords defined', () => {
    expect(WARHAMMER_CONSTANTS.HERETICAL_KEYWORDS).toBeDefined();
    expect(Array.isArray(WARHAMMER_CONSTANTS.HERETICAL_KEYWORDS)).toBe(true);
    expect(WARHAMMER_CONSTANTS.HERETICAL_KEYWORDS.length).toBeGreaterThan(0);
  });

  test('should contain chaos gods in heretical keywords', () => {
    const keywords = WARHAMMER_CONSTANTS.HERETICAL_KEYWORDS;
    expect(keywords).toContain('chaos');
    expect(keywords).toContain('khorne');
    expect(keywords).toContain('slaanesh');
    expect(keywords).toContain('nurgle');
    expect(keywords).toContain('tzeentch');
  });

  test('should have chaplain phrases defined', () => {
    expect(WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES).toBeDefined();
    expect(typeof WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES).toBe('object');
  });

  test('should contain expected chaplain phrases', () => {
    const phrases = WARHAMMER_CONSTANTS.CHAPLAIN_PHRASES;
    expect(phrases.PROTECTION).toBe('El Emperador Protege');
    expect(phrases.GREETING).toBe('Ave Imperator!');
    expect(phrases.BATTLE_CRY).toBe('Por el Trono Dorado!');
    expect(phrases.HERESY).toBe('¡HEREJÍA!');
  });

  test('should have heresy levels with correct structure', () => {
    expect(WARHAMMER_CONSTANTS.HERESY_LEVELS).toBeDefined();
    expect(typeof WARHAMMER_CONSTANTS.HERESY_LEVELS).toBe('object');

    const levels = Object.keys(WARHAMMER_CONSTANTS.HERESY_LEVELS);
    expect(levels).toContain('PURA_FE');
    expect(levels).toContain('SOSPECHOSO');
    expect(levels).toContain('HEREJIA_MENOR');
    expect(levels).toContain('HEREJIA_MAYOR');
    expect(levels).toContain('HEREJIA_EXTREMA');
  });

  test('should have heresy levels with color and description', () => {
    const heresyLevel = WARHAMMER_CONSTANTS.HERESY_LEVELS.PURA_FE;
    expect(heresyLevel.color).toBeDefined();
    expect(heresyLevel.description).toBeDefined();
    expect(typeof heresyLevel.color).toBe('string');
    expect(typeof heresyLevel.description).toBe('string');
  });

  test('should have RAG config with valid values', () => {
    expect(WARHAMMER_CONSTANTS.RAG_CONFIG).toBeDefined();
    expect(typeof WARHAMMER_CONSTANTS.RAG_CONFIG).toBe('object');

    const config = WARHAMMER_CONSTANTS.RAG_CONFIG;
    expect(config.CHUNK_SIZE).toBeGreaterThan(0);
    expect(config.CHUNK_OVERLAP).toBeGreaterThan(0);
    expect(config.MAX_CONTEXT_LENGTH).toBeGreaterThan(0);
    expect(config.SIMILARITY_THRESHOLD).toBeGreaterThan(0);
    expect(config.SIMILARITY_THRESHOLD).toBeLessThanOrEqual(1);
    expect(config.MAX_RESULTS).toBeGreaterThan(0);
  });

  test('should have valid embedding and chat models', () => {
    const config = WARHAMMER_CONSTANTS.RAG_CONFIG;
    expect(config.EMBEDDING_MODEL).toBeDefined();
    expect(config.CHAT_MODEL).toBeDefined();
    expect(typeof config.EMBEDDING_MODEL).toBe('string');
    expect(typeof config.CHAT_MODEL).toBe('string');
  });
});

describe('DISCORD_COLORS', () => {
  test('should have color constants defined', () => {
    expect(DISCORD_COLORS).toBeDefined();
    expect(typeof DISCORD_COLORS).toBe('object');
  });

  test('should have expected color properties', () => {
    expect(DISCORD_COLORS.GOLD).toBeDefined();
    expect(DISCORD_COLORS.RED).toBeDefined();
    expect(DISCORD_COLORS.GREEN).toBeDefined();
    expect(DISCORD_COLORS.BLUE).toBeDefined();
    expect(DISCORD_COLORS.ORANGE).toBeDefined();
    expect(DISCORD_COLORS.DARK_RED).toBeDefined();
    expect(DISCORD_COLORS.YELLOW).toBeDefined();
    expect(DISCORD_COLORS.PURPLE).toBeDefined();
  });

  test('should have valid hex color values', () => {
    expect(typeof DISCORD_COLORS.GOLD).toBe('number');
    expect(DISCORD_COLORS.GOLD).toBe(0xffd700);
    expect(DISCORD_COLORS.RED).toBe(0xff0000);
    expect(DISCORD_COLORS.GREEN).toBe(0x00ff00);
    expect(DISCORD_COLORS.BLUE).toBe(0x0099ff);
  });

  test('should have colors in valid range', () => {
    const colors = Object.values(DISCORD_COLORS);
    for (const color of colors) {
      expect(color).toBeGreaterThanOrEqual(0);
      expect(color).toBeLessThanOrEqual(0xffffff);
    }
  });
});