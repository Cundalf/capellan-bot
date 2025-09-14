import { expect, test, describe, beforeEach, spyOn } from 'bun:test';
import { AITaskManager, type AITask } from '@/services/ai-task-manager';
import { Logger } from '@/utils/logger';
import type { BotConfig } from '@/types';

describe('AITaskManager', () => {
  let aiTaskManager: AITaskManager;
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

  beforeEach(() => {
    mockLogger = new Logger(mockBotConfig);
    spyOn(mockLogger, 'info').mockImplementation(() => {});
    spyOn(mockLogger, 'warn').mockImplementation(() => {});

    aiTaskManager = new AITaskManager(mockLogger);
  });

  test('should start with no active tasks', () => {
    expect(aiTaskManager.hasAnyActiveTask()).toBe(false);
    expect(aiTaskManager.getActiveTaskCount()).toBe(0);
    expect(aiTaskManager.getActiveTasks()).toEqual([]);
  });

  test('should start a new AI task', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    const success = aiTaskManager.startTask(userId, username, command, channelId);

    expect(success).toBe(true);
    expect(aiTaskManager.hasActiveTask(userId)).toBe(true);
    expect(aiTaskManager.hasAnyActiveTask()).toBe(true);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);

    const task = aiTaskManager.getActiveTask(userId);
    expect(task).not.toBeUndefined();
    expect(task!.userId).toBe(userId);
    expect(task!.username).toBe(username);
    expect(task!.command).toBe(command);
    expect(task!.channelId).toBe(channelId);
    expect(task!.startTime).toBeGreaterThan(0);
  });

  test('should not allow duplicate tasks for same user', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    const success1 = aiTaskManager.startTask(userId, username, command, channelId);
    const success2 = aiTaskManager.startTask(userId, username, 'sermon', channelId);

    expect(success1).toBe(true);
    expect(success2).toBe(false);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);
  });

  test('should allow tasks for different users', () => {
    const user1 = { userId: 'user1', username: 'User1' };
    const user2 = { userId: 'user2', username: 'User2' };
    const command = 'heresy';
    const channelId = 'channel123';

    const success1 = aiTaskManager.startTask(user1.userId, user1.username, command, channelId);
    const success2 = aiTaskManager.startTask(user2.userId, user2.username, command, channelId);

    expect(success1).toBe(true);
    expect(success2).toBe(true);
    expect(aiTaskManager.getActiveTaskCount()).toBe(2);
    expect(aiTaskManager.hasActiveTask(user1.userId)).toBe(true);
    expect(aiTaskManager.hasActiveTask(user2.userId)).toBe(true);
  });

  test('should complete a task', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    aiTaskManager.startTask(userId, username, command, channelId);
    expect(aiTaskManager.hasActiveTask(userId)).toBe(true);

    aiTaskManager.completeTask(userId);

    expect(aiTaskManager.hasActiveTask(userId)).toBe(false);
    expect(aiTaskManager.hasAnyActiveTask()).toBe(false);
    expect(aiTaskManager.getActiveTaskCount()).toBe(0);
  });

  test('should handle completing non-existent task gracefully', () => {
    expect(() => {
      aiTaskManager.completeTask('nonexistent');
    }).not.toThrow();

    expect(aiTaskManager.getActiveTaskCount()).toBe(0);
  });

  test('should get all active tasks', () => {
    const tasks = [
      { userId: 'user1', username: 'User1', command: 'heresy', channelId: 'channel1' },
      { userId: 'user2', username: 'User2', command: 'sermon', channelId: 'channel2' },
      { userId: 'user3', username: 'User3', command: 'knowledge', channelId: 'channel3' },
    ];

    // Start all tasks
    for (const task of tasks) {
      aiTaskManager.startTask(task.userId, task.username, task.command, task.channelId);
    }

    const activeTasks = aiTaskManager.getActiveTasks();
    expect(activeTasks).toHaveLength(3);

    for (let i = 0; i < tasks.length; i++) {
      const activeTask = activeTasks.find(t => t.userId === tasks[i].userId);
      expect(activeTask).not.toBeUndefined();
      expect(activeTask!.username).toBe(tasks[i].username);
      expect(activeTask!.command).toBe(tasks[i].command);
      expect(activeTask!.channelId).toBe(tasks[i].channelId);
    }
  });

  test('should clean up stuck tasks', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    // Mock Date.now to control task age
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Start task
    aiTaskManager.startTask(userId, username, command, channelId);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);

    // Move time forward by 10 minutes
    currentTime += 10 * 60 * 1000;

    // Clean up tasks older than 5 minutes
    const cleaned = aiTaskManager.cleanupStuckTasks(5 * 60 * 1000);

    expect(cleaned).toBe(1);
    expect(aiTaskManager.getActiveTaskCount()).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Cleaned up stuck AI task',
      expect.objectContaining({
        userId,
        command,
        age: 10 * 60 * 1000
      })
    );

    Date.now = originalNow;
  });

  test('should not clean up recent tasks', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    // Mock Date.now
    const originalNow = Date.now;
    let currentTime = 1000000;
    spyOn(Date, 'now').mockImplementation(() => currentTime);

    // Start task
    aiTaskManager.startTask(userId, username, command, channelId);

    // Move time forward by 2 minutes (less than max age)
    currentTime += 2 * 60 * 1000;

    // Clean up tasks older than 5 minutes
    const cleaned = aiTaskManager.cleanupStuckTasks(5 * 60 * 1000);

    expect(cleaned).toBe(0);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);

    Date.now = originalNow;
  });

  test('should force complete a task', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    aiTaskManager.startTask(userId, username, command, channelId);
    expect(aiTaskManager.hasActiveTask(userId)).toBe(true);

    const success = aiTaskManager.forceCompleteTask(userId);

    expect(success).toBe(true);
    expect(aiTaskManager.hasActiveTask(userId)).toBe(false);
  });

  test('should return false when force completing non-existent task', () => {
    const success = aiTaskManager.forceCompleteTask('nonexistent');
    expect(success).toBe(false);
  });

  test('should log task start and completion', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    // Start task
    aiTaskManager.startTask(userId, username, command, channelId);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'AI task started',
      expect.objectContaining({
        userId,
        username,
        command,
        totalActiveTasks: 1
      })
    );

    // Complete task
    aiTaskManager.completeTask(userId);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'AI task completed',
      expect.objectContaining({
        userId,
        command,
        duration: expect.any(Number),
        totalActiveTasks: 0
      })
    );
  });

  test('should return undefined for non-existent active task', () => {
    const task = aiTaskManager.getActiveTask('nonexistent');
    expect(task).toBeUndefined();
  });

  test('should handle multiple cleanup runs correctly', () => {
    const userId = 'user123';
    const username = 'TestUser';
    const command = 'heresy';
    const channelId = 'channel123';

    aiTaskManager.startTask(userId, username, command, channelId);

    // First cleanup - task is recent
    let cleaned = aiTaskManager.cleanupStuckTasks(10 * 60 * 1000);
    expect(cleaned).toBe(0);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);

    // Second cleanup - still recent
    cleaned = aiTaskManager.cleanupStuckTasks(10 * 60 * 1000);
    expect(cleaned).toBe(0);
    expect(aiTaskManager.getActiveTaskCount()).toBe(1);
  });
});