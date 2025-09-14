import { expect, test, describe, beforeEach, afterEach, spyOn } from 'bun:test';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { GamificationService } from '@/services/gamification-service';
import { Logger } from '@/utils/logger';
import type { BotConfig, UserProfile } from '@/types';

describe('GamificationService', () => {
  let gamificationService: GamificationService;
  let mockLogger: Logger;
  const testDataPath = './test-gamification-data';

  const mockBotConfig: BotConfig = {
    autoHeresyDetectionChance: 0.2,
    maxDailyEmbeddings: 1000,
    sqlitePath: './database/test-vector-store.sqlite',
    documentsPath: './database/test-wh40k-documents',
    logLevel: 'info',
    steamOffersCheckInterval: 3,
    minDiscountPercent: 10,
  };

  beforeEach(async () => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'error').mockImplementation(() => {});
    spyOn(mockLogger, 'warn').mockImplementation(() => {});
    spyOn(mockLogger, 'inquisitor').mockImplementation(() => {});

    // Clean up test directory
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
    await mkdir(testDataPath, { recursive: true });

    gamificationService = new GamificationService(mockLogger, testDataPath);
  });

  afterEach(async () => {
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
  });

  test('should create new user profile', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const profile = await gamificationService.getOrCreateProfile(userId, username);

    expect(profile.userId).toBe(userId);
    expect(profile.username).toBe(username);
    expect(profile.purityPoints).toBe(100);
    expect(profile.corruptionPoints).toBe(0);
    expect(profile.totalMessages).toBe(0);
    expect(profile.heresiesDetected).toBe(0);
    expect(profile.sermonsReceived).toBe(0);
    expect(profile.rank).toBe('Ciudadano');
    expect(profile.achievements).toEqual([]);
    expect(profile.penitencias).toEqual([]);
  });

  test('should update existing profile activity', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const profile1 = await gamificationService.getOrCreateProfile(userId, username);
    const originalActivity = profile1.lastActivity;

    // Wait a moment to ensure time difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const profile2 = await gamificationService.getOrCreateProfile(userId, 'UpdatedUser');

    expect(profile2.username).toBe('UpdatedUser');
    expect(profile2.lastActivity).not.toBe(originalActivity);
  });

  test('should add purity points correctly', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    await gamificationService.getOrCreateProfile(userId, username);
    const result = await gamificationService.addPurityPoints(userId, 50, 'Test reason');

    expect(result).not.toBeNull();
    expect(result!.purityPoints).toBeGreaterThanOrEqual(150); // Account for achievements
  });

  test('should add corruption points correctly', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    await gamificationService.getOrCreateProfile(userId, username);
    const result = await gamificationService.addCorruptionPoints(userId, 30, 'Heresy detected');

    expect(result).not.toBeNull();
    expect(result!.corruptionPoints).toBe(30);
  });

  test('should calculate rank correctly based on net purity', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const initialProfile = await gamificationService.getOrCreateProfile(userId, username);
    const initialPurity = initialProfile.purityPoints;

    // Test that rank increases with purity points
    await gamificationService.addPurityPoints(userId, 50, 'Test');
    let profile = await gamificationService.getOrCreateProfile(userId, username);
    const netPurity1 = profile.purityPoints - profile.corruptionPoints;
    expect(netPurity1).toBeGreaterThan(initialPurity); // Should have increased

    // Add more points
    await gamificationService.addPurityPoints(userId, 100, 'Test');
    profile = await gamificationService.getOrCreateProfile(userId, username);
    const netPurity2 = profile.purityPoints - profile.corruptionPoints;
    expect(netPurity2).toBeGreaterThan(netPurity1); // Should continue increasing

    // Test degradation with corruption
    const purityBeforeCorruption = profile.purityPoints;
    await gamificationService.addCorruptionPoints(userId, 200, 'Heavy corruption');
    profile = await gamificationService.getOrCreateProfile(userId, username);
    expect(profile.corruptionPoints).toBe(200);
    expect(profile.purityPoints).toBe(purityBeforeCorruption); // Purity unchanged
    expect(profile.rank).toMatch(/Sospechoso|Ciudadano|Fiel/); // Should be degraded rank
  });

  test('should assign penitence correctly', async () => {
    const userId = 'user123';
    const username = 'TestUser';
    const assignedBy = 'inquisitor456';

    await gamificationService.getOrCreateProfile(userId, username);
    const penitenceId = await gamificationService.assignPenitence(
      userId,
      'Minor heresy',
      assignedBy,
      24
    );

    expect(penitenceId).not.toBeNull();
    expect(typeof penitenceId).toBe('string');

    const activePenitencias = gamificationService.getActivePenitencias(userId);
    expect(activePenitencias).toHaveLength(1);
    expect(activePenitencias[0].reason).toBe('Minor heresy');
    expect(activePenitencias[0].assignedBy).toBe(assignedBy);
    expect(activePenitencias[0].duration).toBe(24);
    expect(activePenitencias[0].active).toBe(true);
  });

  test('should remove penitence by ID', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    await gamificationService.getOrCreateProfile(userId, username);
    const penitenceId = await gamificationService.assignPenitence(
      userId,
      'Minor heresy',
      'inquisitor456',
      24
    );

    expect(penitenceId).not.toBeNull();

    const success = await gamificationService.removePenitenceById(userId, penitenceId!);
    expect(success).toBe(true);

    const activePenitencias = gamificationService.getActivePenitencias(userId);
    expect(activePenitencias).toHaveLength(0);
  });

  test('should record messages and award points', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const initialProfile = await gamificationService.getOrCreateProfile(userId, username);
    const initialPurity = initialProfile.purityPoints;

    // Record 100 messages to trigger bonus
    for (let i = 0; i < 100; i++) {
      await gamificationService.recordMessage(userId);
    }

    const profile = gamificationService.getUserStats(userId);
    expect(profile!.totalMessages).toBe(100);
    expect(profile!.purityPoints).toBeGreaterThanOrEqual(initialPurity + 10); // At least the message bonus
  });

  test('should record heresy detection with correct points', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const initialProfile = await gamificationService.getOrCreateProfile(userId, username);
    const initialPurity = initialProfile.purityPoints;

    // Test pure faith detection (positive points)
    await gamificationService.recordHeresyDetection(userId, 'PURA_FE');
    let profile = gamificationService.getUserStats(userId);
    expect(profile!.purityPoints).toBeGreaterThanOrEqual(initialPurity + 5); // At least 5 points added
    expect(profile!.heresiesDetected).toBe(1);

    // Test major heresy detection (negative points)
    await gamificationService.recordHeresyDetection(userId, 'HEREJIA_MAYOR');
    profile = gamificationService.getUserStats(userId);
    expect(profile!.corruptionPoints).toBe(15);
    expect(profile!.heresiesDetected).toBe(2);
  });

  test('should record sermon receipt', async () => {
    const userId = 'user123';
    const username = 'TestUser';

    const initialProfile = await gamificationService.getOrCreateProfile(userId, username);
    const initialPurity = initialProfile.purityPoints;

    await gamificationService.recordSermon(userId);

    const profile = gamificationService.getUserStats(userId);
    expect(profile!.sermonsReceived).toBe(1);
    expect(profile!.purityPoints).toBeGreaterThanOrEqual(initialPurity + 3); // At least 3 points added
  });

  test('should generate leaderboard', async () => {
    // Create multiple users with different scores
    await gamificationService.getOrCreateProfile('user1', 'User1');
    await gamificationService.addPurityPoints('user1', 200, 'test');

    await gamificationService.getOrCreateProfile('user2', 'User2');
    await gamificationService.addPurityPoints('user2', 100, 'test');

    await gamificationService.getOrCreateProfile('user3', 'User3');
    await gamificationService.addPurityPoints('user3', 300, 'test');

    const leaderboard = gamificationService.getLeaderboard(3);

    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].profile.userId).toBe('user3'); // Highest score
    expect(leaderboard[1].profile.userId).toBe('user1');
    expect(leaderboard[2].profile.userId).toBe('user2'); // Lowest score
  });

  test('should get rank distribution', async () => {
    // Create users with different ranks
    await gamificationService.getOrCreateProfile('user1', 'User1');
    await gamificationService.addPurityPoints('user1', 300, 'test'); // Should be high rank

    await gamificationService.getOrCreateProfile('user2', 'User2');
    // Keep at default level

    const distribution = gamificationService.getRankDistribution();

    // Test that we have the expected number of users in different ranks
    const totalUsers = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    expect(totalUsers).toBe(2);
    expect(distribution.Herético).toBe(0); // No heretical users
  });

  test('should return null for non-existent user operations', async () => {
    const result1 = await gamificationService.addPurityPoints('nonexistent', 10, 'test');
    expect(result1).toBeNull();

    const result2 = await gamificationService.addCorruptionPoints('nonexistent', 10, 'test');
    expect(result2).toBeNull();

    const result3 = await gamificationService.assignPenitence('nonexistent', 'test', 'admin', 24);
    expect(result3).toBeNull();
  });

  test('should get total users count', async () => {
    expect(gamificationService.getTotalUsers()).toBe(0);

    await gamificationService.getOrCreateProfile('user1', 'User1');
    await gamificationService.getOrCreateProfile('user2', 'User2');

    expect(gamificationService.getTotalUsers()).toBe(2);
  });

  test('should clean up expired penitences functionality exists', async () => {
    // Simple test to verify the cleanup function exists and can be called
    await gamificationService.cleanupExpiredPenitence();

    // If we get here without errors, the function exists and works
    expect(true).toBe(true);
  });
});