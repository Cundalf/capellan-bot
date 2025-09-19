import cron from 'node-cron';
import type { BotConfig } from '@/types/index';
import type { Logger } from '@/utils/logger';
import type { GamificationService } from '../gamification-service';
import type { InquisitorService } from '../inquisitor-service';

export class CronJobHandler {
  constructor(
    private logger: Logger,
    private config: BotConfig,
    private gamificationService: GamificationService,
    private inquisitorService: InquisitorService,
    private onDailySermon: () => Promise<void>,
    private onSteamOffersCheck: () => Promise<void>
  ) {}

  setupCronJobs(): void {
    this.setupDailySermon();
    this.setupDatabaseMaintenance();
    this.setupWeeklyBackup();
    this.setupSteamOffersCheck();
    this.logCronConfiguration();
  }

  private setupDailySermon(): void {
    cron.schedule('40 19 * * *', async () => {
      this.logger.info('Daily sermon cron triggered at Imperial Hour');
      await this.onDailySermon();
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });
  }

  private setupDatabaseMaintenance(): void {
    cron.schedule('0 3 * * *', async () => {
      this.logger.info('Running database maintenance');
      await this.gamificationService.cleanupExpiredPenitence();
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });
  }

  private setupWeeklyBackup(): void {
    cron.schedule('0 2 * * 0', async () => {
      this.logger.info('Creating weekly backup');
      try {
        await this.inquisitorService.createBackup();
      } catch (error: any) {
        this.logger.error('Weekly backup failed', {
          error: error?.message || 'Unknown error',
        });
      }
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });
  }

  private setupSteamOffersCheck(): void {
    const checkInterval = this.config.steamOffersCheckInterval;
    const cronExpression = `0 */${checkInterval} * * *`;

    cron.schedule(cronExpression, async () => {
      this.logger.info('Steam offers check triggered');
      await this.onSteamOffersCheck();
    }, {
      timezone: 'America/Argentina/Buenos_Aires'
    });
  }

  private logCronConfiguration(): void {
    this.logger.info('Cron jobs configured', {
      dailySermon: '19:40 daily',
      sermonChannel: this.config.sermonChannelId || 'NOT CONFIGURED',
      steamOffersInterval: `Every ${this.config.steamOffersCheckInterval} hours`,
      steamOffersChannel: this.config.steamOffersChannelId || 'NOT CONFIGURED',
    });
  }
}
