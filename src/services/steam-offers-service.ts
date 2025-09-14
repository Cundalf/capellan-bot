import axios from 'axios';
import { Logger } from '@/utils/logger';
import { SteamApp, SteamOffer, TrackedOffer, BotConfig, SteamOffersData } from '@/types';
import { EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

enum CacheTimeout {
  OFFERS = 30 * 60 * 1000, // 30 minutes
}

enum TimeInterval {
  HOUR = 60 * 60 * 1000,
  DAY = 24 * 60 * 60 * 1000,
  RECENT_RESTART_THRESHOLD = 60 * 60 * 1000, // 1 hour
  MIN_NOTIFICATION_INTERVAL = 6 * 60 * 60 * 1000, // 6 hours
}

enum DiscountThreshold {
  SIGNIFICANT_INCREASE = 5,
  HIGH_DISCOUNT = 75,
  MEDIUM_DISCOUNT = 50,
  LOW_DISCOUNT = 25,
}

enum NotificationLimit {
  MAX_PER_OFFER = 2,
}

enum APIConfig {
  TIMEOUT = 10000,
  DETAILS_TIMEOUT = 5000,
  BATCH_SIZE = 15,
  BATCH_DELAY = 1000,
}

enum EmbedColor {
  GOLD = 0xFFD700,
  RED = 0xFF0000,
  ORANGE = 0xFF8C00,
  GREEN = 0x32CD32,
  BROWN = 0x8B4513,
}

enum SteamCategory {
  SPECIALS = 'specials',
  FEATURED_WIN = 'featured_win',
  GREAT_ON_DECK = 'great_on_deck',
  COMING_SOON = 'coming_soon',
  NEW_RELEASES = 'new_releases',
  TOP_SELLERS = 'top_sellers',
  POPULAR_UPCOMING = 'popular_upcoming',
  FEATURED_RECOMMENDED = 'featured_recommended',
}

export class SteamOffersService {
  private logger: Logger;
  private config: BotConfig;
  private lastFetchTime: number = 0;
  private lastCheckTime: string = '';
  private cachedOffers: SteamOffer[] = [];
  private trackedOffers: Map<number, TrackedOffer> = new Map();
  private trackedOffersFile: string;

  private static readonly WARHAMMER_KEYWORDS = [
    'warhammer 40k', 'warhammer40k', 'warhammer 40000', 'warhammer40000',
    'space marine', 'space marines', 'adeptus mechanicus', 'adeptus astartes',
    'adeptus custodes', 'imperial guard', 'astra militarum', 'chaos space marines',
    'death korps', 'blood angels', 'dark angels', 'ultramarines', 'iron hands',
    'salamanders', 'raven guard', 'imperial fists', 'white scars', 'iron warriors',
    'word bearers', 'night lords', 'world eaters', 'thousand sons', 'death guard',
    'emperor\'s children', 'alpha legion', 'black legion', 'dawn of war',
    'battlefleet gothic', 'mechanicus', 'inquisitor', 'vermintide', 'darktide',
    'total war: warhammer', 'age of sigmar'
  ];

  private static readonly KNOWN_WARHAMMER_GAMES = [
    553850, 1971640, 594570, 1142710, 217300, 15620, 286160, 312670,
    4000, 1295500, 4570, 1458140, 373110, 1361210, 2183900, 386070,
    375510, 298710
  ];

  private static readonly STEAM_CATEGORIES = [
    SteamCategory.SPECIALS, SteamCategory.FEATURED_WIN, SteamCategory.GREAT_ON_DECK,
    SteamCategory.COMING_SOON, SteamCategory.NEW_RELEASES, SteamCategory.TOP_SELLERS,
    SteamCategory.POPULAR_UPCOMING, SteamCategory.FEATURED_RECOMMENDED
  ];

  constructor(logger: Logger, config: BotConfig) {
    this.logger = logger;
    this.config = config;
    this.trackedOffersFile = path.join('./database', 'tracked-offers.json');
    this.loadTrackedOffers();
  }

  private loadTrackedOffers(): void {
    try {
      if (fs.existsSync(this.trackedOffersFile)) {
        const data = fs.readFileSync(this.trackedOffersFile, 'utf8');
        const parsed = JSON.parse(data);
        
        // Handle both old and new format
        if (parsed.lastCheck && parsed.trackedOffers) {
          // New format
          this.lastCheckTime = parsed.lastCheck;
          this.trackedOffers = new Map(Object.entries(parsed.trackedOffers).map(([key, value]) => [parseInt(key), value as TrackedOffer]));
        } else {
          this.trackedOffers = new Map(Object.entries(parsed).map(([key, value]) => [parseInt(key), value as TrackedOffer]));
          this.lastCheckTime = new Date(Date.now() - TimeInterval.DAY).toISOString();
        }
        
        this.logger.info(`Loaded ${this.trackedOffers.size} tracked offers`, {
          lastCheck: this.lastCheckTime
        });
      }
    } catch (error: any) {
      this.logger.error('Error loading tracked offers:', error?.message || 'Unknown error');
      this.trackedOffers = new Map();
      this.lastCheckTime = '';
    }
  }

  private saveTrackedOffers(): void {
    try {
      const data: SteamOffersData = {
        lastCheck: this.lastCheckTime,
        trackedOffers: Object.fromEntries(this.trackedOffers)
      };
      fs.writeFileSync(this.trackedOffersFile, JSON.stringify(data, null, 2));
    } catch (error: any) {
      this.logger.error('Error saving tracked offers:', error?.message || 'Unknown error');
    }
  }

  async checkForNewOffers(): Promise<SteamOffer[]> {
    try {
      this.logger.info('Checking for new Warhammer Steam offers...');
      
      const allOffers = await this.getWarhammerOffers(true);
      const newOffers: SteamOffer[] = [];
      const now = new Date().toISOString();
      const previousCheckTime = this.lastCheckTime;

      // Avoid duplicate notifications immediately after restart
      // If last check was less than 1 hour ago, be more conservative
      const timeSinceLastCheck = this.lastCheckTime ? Date.now() - new Date(this.lastCheckTime).getTime() : Infinity;
      const isRecentRestart = timeSinceLastCheck < TimeInterval.RECENT_RESTART_THRESHOLD;

      this.logger.debug('Check timing info', {
        previousCheck: previousCheckTime,
        timeSinceLastCheck: timeSinceLastCheck / (60 * 1000), // minutes
        isRecentRestart
      });

      for (const offer of allOffers) {
        // Skip if discount is below minimum threshold
        if (offer.discountPercent < this.config.minDiscountPercent) {
          continue;
        }

        const tracked = this.trackedOffers.get(offer.appid);
        
        if (!tracked) {
          // New offer - but be conservative if this is a recent restart
          if (isRecentRestart) {
            // Track it but don't notify - might be a restart scenario
            this.trackedOffers.set(offer.appid, {
              appid: offer.appid,
              name: offer.name,
              discountPercent: offer.discountPercent,
              finalPrice: offer.finalPrice,
              currency: offer.currency,
              firstSeen: now,
              lastNotified: now, // Mark as notified to prevent immediate notification
              notificationCount: 1
            });
            this.logger.info('New Warhammer offer detected but skipped due to recent restart', { 
              name: offer.name, 
              discount: offer.discountPercent 
            });
          } else {
            // Normal new offer
            this.trackedOffers.set(offer.appid, {
              appid: offer.appid,
              name: offer.name,
              discountPercent: offer.discountPercent,
              finalPrice: offer.finalPrice,
              currency: offer.currency,
              firstSeen: now,
              notificationCount: 0
            });
            newOffers.push(offer);
            this.logger.info('New Warhammer offer detected', { 
              name: offer.name, 
              discount: offer.discountPercent 
            });
          }
        } else {
          // Check if discount increased significantly (5% or more) and not recently notified
          const discountIncrease = offer.discountPercent - tracked.discountPercent;
          const lastNotified = tracked.lastNotified ? new Date(tracked.lastNotified).getTime() : 0;
          const timeSinceLastNotified = Date.now() - lastNotified;
          const hoursSinceNotified = timeSinceLastNotified / (60 * 60 * 1000);
          
          if (discountIncrease >= 5 && tracked.notificationCount < 2 && hoursSinceNotified > 6) {
            newOffers.push(offer);
            tracked.discountPercent = offer.discountPercent;
            tracked.finalPrice = offer.finalPrice;
            this.logger.info('Warhammer offer discount increased', { 
              name: offer.name, 
              oldDiscount: tracked.discountPercent,
              newDiscount: offer.discountPercent 
            });
          }
        }
      }

      // Clean up old tracked offers (remove those not found in current check)
      this.cleanupOldOffers(allOffers);
      
      // Update last check time
      this.lastCheckTime = now;
      
      // Always save to persist the lastCheckTime
      this.saveTrackedOffers();

      this.logger.info('Steam offers check completed', {
        totalOffers: allOffers.length,
        newOffers: newOffers.length,
        isRecentRestart,
        timeSinceLastCheck: timeSinceLastCheck / (60 * 1000) // minutes
      });

      return newOffers;

    } catch (error: any) {
      this.logger.error('Error checking for new offers:', error?.message || 'Unknown error');
      return [];
    }
  }

  private shouldNotifyDiscountIncrease(offer: SteamOffer, tracked: TrackedOffer): boolean {
    const discountIncrease = offer.discountPercent - tracked.discountPercent;
    const lastNotified = tracked.lastNotified ? new Date(tracked.lastNotified).getTime() : 0;
    const timeSinceLastNotified = Date.now() - lastNotified;

    return discountIncrease >= DiscountThreshold.SIGNIFICANT_INCREASE &&
           tracked.notificationCount < NotificationLimit.MAX_PER_OFFER &&
           timeSinceLastNotified > TimeInterval.MIN_NOTIFICATION_INTERVAL;
  }

  private cleanupOldOffers(currentOffers: SteamOffer[]): void {
    const currentAppIds = new Set(currentOffers.map(offer => offer.appid));
    const toRemove: number[] = [];

    for (const [appId, tracked] of this.trackedOffers) {
      if (!currentAppIds.has(appId)) {
        const timeSinceFirstSeen = Date.now() - new Date(tracked.firstSeen).getTime();
        if (timeSinceFirstSeen > TimeInterval.DAY) {
          toRemove.push(appId);
        }
      }
    }

    for (const appId of toRemove) {
      this.trackedOffers.delete(appId);
    }
  }

  async getWarhammerOffers(forceRefresh: boolean = false): Promise<SteamOffer[]> {
    const now = Date.now();
    
    if (!forceRefresh && this.cachedOffers.length > 0 && (now - this.lastFetchTime) < CacheTimeout.OFFERS) {
      this.logger.debug('Returning cached Warhammer offers', { 
        cachedCount: this.cachedOffers.length,
        cacheAge: Math.round((now - this.lastFetchTime) / 1000 / 60)
      });
      return this.cachedOffers;
    }

    try {
      this.logger.info('Fetching fresh Steam offers...');
      
      // Get featured games (which often include sales)
      const featuredResponse = await axios.get('https://store.steampowered.com/api/featuredcategories', {
        timeout: APIConfig.TIMEOUT
      });

      const featuredData = featuredResponse.data;
      const appIds = new Set<number>();

      const categories = SteamOffersService.STEAM_CATEGORIES;

      categories.forEach(category => {
        if (featuredData[category]?.items) {
          featuredData[category].items.forEach((item: any) => {
            if (item.id) appIds.add(item.id);
          });
        }
      });

      this.logger.debug('Apps found by category:', {
        specials: featuredData.specials?.items?.length || 0,
        featured_win: featuredData.featured_win?.items?.length || 0,
        great_on_deck: featuredData.great_on_deck?.items?.length || 0,
        coming_soon: featuredData.coming_soon?.items?.length || 0,
        new_releases: featuredData.new_releases?.items?.length || 0,
        top_sellers: featuredData.top_sellers?.items?.length || 0,
        popular_upcoming: featuredData.popular_upcoming?.items?.length || 0,
        featured_recommended: featuredData.featured_recommended?.items?.length || 0,
        totalUnique: appIds.size
      });


      SteamOffersService.KNOWN_WARHAMMER_GAMES.forEach(id => appIds.add(id));
      this.logger.debug(`Added ${SteamOffersService.KNOWN_WARHAMMER_GAMES.length} known Warhammer games to check`);

      this.logger.info(`Found ${appIds.size} total games, checking for Warhammer content...`);

      const offers: SteamOffer[] = [];
      const appIdArray = Array.from(appIds);

      for (let i = 0; i < appIdArray.length; i += APIConfig.BATCH_SIZE) {
        const batch = appIdArray.slice(i, i + APIConfig.BATCH_SIZE);
        const batchOffers = await this.processBatch(batch);
        offers.push(...batchOffers);

        this.logger.debug(`Processed batch ${Math.floor(i / APIConfig.BATCH_SIZE) + 1}/${Math.ceil(appIdArray.length / APIConfig.BATCH_SIZE)}`, {
          batchSize: batch.length,
          offersFound: batchOffers.length,
          totalOffersFound: offers.length
        });

        if (i + APIConfig.BATCH_SIZE < appIdArray.length) {
          await new Promise(resolve => setTimeout(resolve, APIConfig.BATCH_DELAY));
        }
      }

      this.cachedOffers = offers;
      this.lastFetchTime = now;

      this.logger.info(`Found ${offers.length} Warhammer-related offers`);
      return offers;

    } catch (error: any) {
      this.logger.error('Error fetching Steam offers:', error?.message || 'Unknown error');
      
      // Return cached offers if available
      if (this.cachedOffers.length > 0) {
        this.logger.warn('Returning cached offers due to fetch error');
        return this.cachedOffers;
      }
      
      return [];
    }
  }

  private async processBatch(appIds: number[]): Promise<SteamOffer[]> {
    const offers: SteamOffer[] = [];

    // Process apps in parallel within the batch for better performance
    const promises = appIds.map(async (appId) => {
      try {
        const appDetails = await this.getAppDetails(appId);
        if (appDetails) {
          const isWarhammer = this.isWarhammerRelated(appDetails);
          const hasDiscount = this.hasDiscount(appDetails);
          
          this.logger.debug(`Processing app ${appId}: ${appDetails.name}`, {
            appId,
            name: appDetails.name,
            isWarhammer,
            hasDiscount,
            discountPercent: appDetails.price_overview?.discount_percent || 0
          });
          
          if (isWarhammer && hasDiscount) {
            const offer = this.createOffer(appDetails);
            if (offer) {
              this.logger.info(`Found Warhammer offer: ${appDetails.name} (${offer.discountPercent}% off)`);
              return offer;
            }
          }
        } else {
          this.logger.debug(`Could not get details for app ${appId}`);
        }
      } catch (error: any) {
        this.logger.debug(`Error processing app ${appId}:`, error?.message || 'Unknown error');
      }
      return null;
    });

    const results = await Promise.all(promises);
    offers.push(...results.filter((offer): offer is SteamOffer => offer !== null));

    return offers;
  }

  private async getAppDetails(appId: number): Promise<SteamApp | null> {
    try {
      const response = await axios.get(`https://store.steampowered.com/api/appdetails`, {
        params: { appids: appId },
        timeout: APIConfig.DETAILS_TIMEOUT
      });

      const data = response.data;
      if (data && data[appId] && data[appId].success && data[appId].data) {
        const appData = data[appId].data;
        // Add the appid to the data since Steam API doesn't include it
        appData.appid = appId;
        return appData as SteamApp;
      }
      
      return null;
    } catch (error: any) {
      this.logger.debug(`Failed to get details for app ${appId}:`, error?.message || 'Unknown error');
      return null;
    }
  }

  private isWarhammerRelated(app: SteamApp): boolean {
    const searchText = [
      app.name,
      app.short_description || '',
      ...(app.developers || []),
      ...(app.publishers || []),
      ...(app.genres?.map(g => g.description) || []),
      ...(app.categories?.map(c => c.description) || [])
    ].join(' ').toLowerCase();

    const matches = SteamOffersService.WARHAMMER_KEYWORDS.filter(keyword =>
      searchText.includes(keyword.toLowerCase())
    );


    return matches.length > 0;
  }

  private hasDiscount(app: SteamApp): boolean {
    return (app.price_overview?.discount_percent ?? 0) > 0;
  }

  private createOffer(app: SteamApp): SteamOffer | null {
    if (!app.price_overview || !app.appid) {
      return null;
    }

    const offer = {
      appid: app.appid,
      name: app.name,
      discountPercent: app.price_overview.discount_percent,
      originalPrice: app.price_overview.initial_formatted,
      finalPrice: app.price_overview.final_formatted,
      currency: app.price_overview.currency,
      headerImage: app.header_image,
      releaseDate: app.release_date?.date,
      shortDescription: app.short_description,
      isWarhammerRelated: true,
      steamUrl: `https://store.steampowered.com/app/${app.appid}/`
    };


    return offer;
  }

  createOfferEmbeds(offers: SteamOffer[]): EmbedBuilder[] {
    const embeds: EmbedBuilder[] = [];

    if (offers.length === 0) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Vigilancia del Emperador')
        .setDescription('No se han detectado nuevas ofertas de Warhammer en este momento, hermano.\n\nMantén la vigilancia, pues las oportunidades pueden aparecer cuando menos las esperes.')
        .setColor(0x8B4513)
        .setTimestamp()
        .setFooter({ text: 'Por el Emperador' });
      
      embeds.push(embed);
      return embeds;
    }

    // Main announcement embed
    const mainEmbed = new EmbedBuilder()
      .setTitle('⚔️ ¡OFERTAS DEL EMPERADOR EN STEAM! ⚔️')
      .setDescription(`🔥 **${offers.length} ofertas de Warhammer detectadas**\n\n*El Emperador bendice a sus fieles con descuentos en su arsenal digital.*`)
      .setColor(0xFFD700)
      .setTimestamp()
      .setFooter({ text: 'Steam • Por la Gloria del Emperador' });

    embeds.push(mainEmbed);

    // Individual offer embeds (limit to 5 to avoid Discord limits)
    const maxEmbeds = Math.min(offers.length, 4); // 1 main + 4 offers = 5 total
    for (let i = 0; i < maxEmbeds; i++) {
      const offer = offers[i];
      
      const embed = new EmbedBuilder()
        .setTitle(offer.name)
        .setURL(offer.steamUrl)
        .setColor(offer.discountPercent >= 50 ? 0xFF0000 : offer.discountPercent >= 25 ? 0xFF8C00 : 0x32CD32)
        .addFields(
          { 
            name: '💰 Precio', 
            value: `~~${offer.originalPrice}~~ **${offer.finalPrice}**`, 
            inline: true 
          },
          { 
            name: '🔥 Descuento', 
            value: `**${offer.discountPercent}%**`, 
            inline: true 
          },
          { 
            name: '💱 Moneda', 
            value: offer.currency, 
            inline: true 
          }
        )
        .setTimestamp();

      if (offer.shortDescription) {
        embed.setDescription(offer.shortDescription.substring(0, 200) + (offer.shortDescription.length > 200 ? '...' : ''));
      }

      if (offer.headerImage) {
        embed.setThumbnail(offer.headerImage);
      }

      if (offer.releaseDate) {
        embed.addFields({ name: '📅 Fecha de lanzamiento', value: offer.releaseDate, inline: true });
      }

      // Add thematic footer based on discount
      let footerText = 'Por el Emperador';
      if (offer.discountPercent >= 75) {
        footerText = '🕊️ El Emperador sonríe sobre esta oferta';
      } else if (offer.discountPercent >= 50) {
        footerText = '⚔️ Una oportunidad digna de un Astartes';
      } else if (offer.discountPercent >= 25) {
        footerText = '🛡️ El Emperador bendice este descuento';
      }
      
      embed.setFooter({ text: footerText });
      embeds.push(embed);
    }

    // If there are more offers, add a summary embed
    if (offers.length > maxEmbeds) {
      const remainingCount = offers.length - maxEmbeds;
      const summaryEmbed = new EmbedBuilder()
        .setTitle(`📜 Y ${remainingCount} ofertas más...`)
        .setDescription(offers.slice(maxEmbeds).map(offer => 
          `• **${offer.name}** - ${offer.discountPercent}% (${offer.finalPrice})`
        ).join('\n'))
        .setColor(0x8B4513)
        .setFooter({ text: '🔍 Busca en Steam para ver todas las ofertas' });
      
      embeds.push(summaryEmbed);
    }

    return embeds;
  }

  markOffersAsNotified(offers: SteamOffer[]): void {
    const now = new Date().toISOString();
    
    for (const offer of offers) {
      const tracked = this.trackedOffers.get(offer.appid);
      if (tracked) {
        tracked.lastNotified = now;
        tracked.notificationCount += 1;
      }
    }
    
    this.saveTrackedOffers();
  }

  getStats() {
    const timeSinceLastCheck = this.lastCheckTime ? (Date.now() - new Date(this.lastCheckTime).getTime()) / (60 * 1000) : null;
    
    return {
      cachedOffers: this.cachedOffers.length,
      trackedOffers: this.trackedOffers.size,
      lastFetch: this.lastFetchTime ? new Date(this.lastFetchTime).toISOString() : null,
      lastCheck: this.lastCheckTime || null,
      minutesSinceLastCheck: timeSinceLastCheck ? Math.round(timeSinceLastCheck) : null,
      warhammerKeywords: SteamOffersService.WARHAMMER_KEYWORDS.length,
      config: {
        channelId: this.config.steamOffersChannelId,
        checkInterval: this.config.steamOffersCheckInterval,
        minDiscount: this.config.minDiscountPercent
      }
    };
  }
}