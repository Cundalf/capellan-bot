import type { Client } from 'discord.js';
import type { BotConfig } from '@/types/index';
import type { Logger } from '@/utils/logger';
import type { SermonService } from '../sermon-service';
import type { SteamOffersService } from '../steam-offers-service';

export class NotificationHandler {
  constructor(
    private client: Client,
    private logger: Logger,
    private config: BotConfig,
    private steamOffersService: SteamOffersService,
    private sermonService: SermonService
  ) {}

  async checkAndNotifyOffers(): Promise<void> {
    if (!this.config.steamOffersChannelId) {
      this.logger.debug('Steam offers channel not configured, skipping check');
      return;
    }

    try {
      this.logger.info('Checking for new Steam Warhammer offers...');
      const newOffers = await this.steamOffersService.checkForNewOffers();

      if (newOffers.length === 0) {
        this.logger.info('No new Warhammer offers found');
        return;
      }

      await this.sendOffersNotification(newOffers);
    } catch (error: any) {
      this.logger.error('Error in Steam offers notification', {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      });
    }
  }

  async sendDailySermon(): Promise<void> {
    if (!this.config.sermonChannelId) {
      this.logger.debug('Sermon channel not configured, skipping daily sermon');
      return;
    }

    if (this.sermonService.hasSermonBeenSentToday()) {
      this.logger.info('Daily sermon already sent today, skipping to prevent duplicate');
      return;
    }

    try {
      this.logger.info('Generating and sending daily sermon...');
      const sermonResult = await this.sermonService.generateDailySermon();
      await this.sendSermonToChannel(sermonResult);
    } catch (error: any) {
      this.logger.error('Error sending daily sermon', {
        error: error?.message || 'Unknown error',
        stack: error?.stack,
      });
    }
  }

  async checkMissedSermon(): Promise<void> {
    if (!this.config.sermonChannelId || this.sermonService.hasSermonBeenSentToday()) {
      return;
    }

    const now = new Date();
    const sermonTime = 19 * 60 + 40; // 19:40 in minutes
    const currentTime = now.getHours() * 60 + now.getMinutes();

    if (currentTime >= sermonTime) {
      this.logger.info('Bot startup detected missed sermon for today, sending now...');
      await this.sendDailySermon();
    }
  }

  private async sendOffersNotification(newOffers: any[]): Promise<void> {
    this.logger.info(`Found ${newOffers.length} new Warhammer offers, sending notification`);

    const channel = await this.getTextChannel(this.config.steamOffersChannelId!);
    if (!channel) return;

    const embeds = this.steamOffersService.createOfferEmbeds(newOffers);
    await this.sendEmbedsInChunks(channel, embeds);

    this.steamOffersService.markOffersAsNotified(newOffers);

    this.logger.info('Steam offers notification sent successfully', {
      offersCount: newOffers.length,
      embedsCount: embeds.length,
      channelId: this.config.steamOffersChannelId,
    });
  }

  private async sendSermonToChannel(sermonResult: any): Promise<void> {
    const channel = await this.getTextChannel(this.config.sermonChannelId!);
    if (!channel) return;

    await channel.send(sermonResult.sermon);
    this.sermonService.markSermonAsSent(sermonResult.topic);

    this.logger.info('Daily sermon sent successfully', {
      channelId: this.config.sermonChannelId,
      sermonLength: sermonResult.sermon.length,
      topic: sermonResult.topic,
    });
  }

  private async getTextChannel(channelId: string): Promise<any> {
    const channel = await this.client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      this.logger.error('Channel not found or not text-based', { channelId });
      return null;
    }

    return channel;
  }

  private async sendEmbedsInChunks(channel: any, embeds: any[]): Promise<void> {
    const maxEmbedsPerMessage = 10;

    for (let i = 0; i < embeds.length; i += maxEmbedsPerMessage) {
      const chunk = embeds.slice(i, i + maxEmbedsPerMessage);
      await channel.send({ embeds: chunk });

      if (i + maxEmbedsPerMessage < embeds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}
