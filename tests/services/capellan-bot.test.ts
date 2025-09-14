import { expect, test, describe, beforeEach, spyOn } from 'bun:test';

describe('CapellanBot (Simple)', () => {
  beforeEach(() => {
    // Mock environment variables for testing
    process.env.DISCORD_TOKEN = 'test-token';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.STEAM_API_KEY = 'test-steam-key';
  });

  test('should be importable', () => {
    const { CapellanBot } = require('@/services/capellan-bot');
    expect(CapellanBot).toBeDefined();
    expect(typeof CapellanBot).toBe('function');
  });

  test('should have basic structure', () => {
    const { CapellanBot } = require('@/services/capellan-bot');

    // Test that the class is correctly structured
    expect(CapellanBot.name).toBe('CapellanBot');
    expect(typeof CapellanBot).toBe('function');
  });
});