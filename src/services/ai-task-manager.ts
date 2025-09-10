import { Logger } from '@/utils/logger';

export interface AITask {
  userId: string;
  username: string;
  command: string;
  startTime: number;
  channelId: string;
}

export class AITaskManager {
  private activeTasks: Map<string, AITask> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Check if user has an active AI task
   */
  hasActiveTask(userId: string): boolean {
    return this.activeTasks.has(userId);
  }

  /**
   * Check if there are any active AI tasks (global)
   */
  hasAnyActiveTask(): boolean {
    return this.activeTasks.size > 0;
  }

  /**
   * Start a new AI task for a user
   */
  startTask(userId: string, username: string, command: string, channelId: string): boolean {
    if (this.hasActiveTask(userId)) {
      return false;
    }

    const task: AITask = {
      userId,
      username,
      command,
      startTime: Date.now(),
      channelId
    };

    this.activeTasks.set(userId, task);
    this.logger.info('AI task started', {
      userId,
      username,
      command,
      totalActiveTasks: this.activeTasks.size
    });

    return true;
  }

  /**
   * Complete an AI task for a user
   */
  completeTask(userId: string): void {
    const task = this.activeTasks.get(userId);
    if (task) {
      const duration = Date.now() - task.startTime;
      this.activeTasks.delete(userId);
      this.logger.info('AI task completed', {
        userId,
        command: task.command,
        duration,
        totalActiveTasks: this.activeTasks.size
      });
    }
  }

  /**
   * Get active task for a user
   */
  getActiveTask(userId: string): AITask | undefined {
    return this.activeTasks.get(userId);
  }

  /**
   * Get all active tasks
   */
  getActiveTasks(): AITask[] {
    return Array.from(this.activeTasks.values());
  }

  /**
   * Get task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  /**
   * Clean up tasks older than specified time (in ms)
   */
  cleanupStuckTasks(maxAge: number = 300000): number { // 5 minutes default
    const now = Date.now();
    let cleaned = 0;

    for (const [userId, task] of this.activeTasks.entries()) {
      if (now - task.startTime > maxAge) {
        this.activeTasks.delete(userId);
        cleaned++;
        this.logger.warn('Cleaned up stuck AI task', {
          userId,
          command: task.command,
          age: now - task.startTime
        });
      }
    }

    return cleaned;
  }

  /**
   * Force complete a task (for admin use)
   */
  forceCompleteTask(userId: string): boolean {
    const task = this.activeTasks.get(userId);
    if (task) {
      this.completeTask(userId);
      return true;
    }
    return false;
  }
}