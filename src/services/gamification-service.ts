import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Achievement, PenitenceStatus, UserProfile, UserProfiles, UserRank } from '@/types';
import type { Logger } from '@/utils/logger';

export class GamificationService {
  private profiles: UserProfiles = {};
  private logger: Logger;
  private filePath: string;
  private achievements: Achievement[];

  constructor(logger: Logger, dataPath: string = './database') {
    this.logger = logger;
    this.filePath = join(dataPath, 'user-profiles.json');
    this.achievements = this.initializeAchievements();
    this.ensureDataDirectory(dataPath);
    this.loadProfiles();
  }

  private async ensureDataDirectory(dataPath: string) {
    if (!existsSync(dataPath)) {
      await mkdir(dataPath, { recursive: true });
    }
  }

  private async loadProfiles() {
    try {
      if (existsSync(this.filePath)) {
        const data = await readFile(this.filePath, 'utf8');
        this.profiles = JSON.parse(data);
        this.logger.info('User profiles loaded', { count: Object.keys(this.profiles).length });
      }
    } catch (error: any) {
      this.logger.error('Failed to load user profiles', { error: error.message });
      this.profiles = {};
    }
  }

  private async saveProfiles() {
    try {
      await writeFile(this.filePath, JSON.stringify(this.profiles, null, 2));
    } catch (error: any) {
      this.logger.error('Failed to save user profiles', { error: error.message });
    }
  }

  async getOrCreateProfile(userId: string, username: string): Promise<UserProfile> {
    if (!this.profiles[userId]) {
      this.profiles[userId] = {
        userId,
        username,
        purityPoints: 100,
        corruptionPoints: 0,
        totalMessages: 0,
        heresiesDetected: 0,
        sermonsReceived: 0,
        rank: 'Ciudadano',
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        achievements: [],
        penitencias: [],
      };
      await this.saveProfiles();
      this.logger.info('New user profile created', { userId, username });
    } else {
      this.profiles[userId].username = username;
      this.profiles[userId].lastActivity = new Date().toISOString();

      // Migration: Ensure penitencias array exists
      if (!this.profiles[userId].penitencias) {
        this.profiles[userId].penitencias = [];
      }
    }
    return this.profiles[userId];
  }

  async addPurityPoints(
    userId: string,
    points: number,
    reason: string
  ): Promise<UserProfile | null> {
    const profile = this.profiles[userId];
    if (!profile) return null;

    profile.purityPoints += points;
    profile.lastActivity = new Date().toISOString();

    const oldRank = profile.rank;
    profile.rank = this.calculateRank(profile);

    await this.checkAchievements(profile);
    await this.saveProfiles();

    this.logger.info('Purity points added', {
      userId,
      points,
      reason,
      newTotal: profile.purityPoints,
    });

    if (oldRank !== profile.rank) {
      this.logger.info('User rank changed', { userId, oldRank, newRank: profile.rank });
    }

    return profile;
  }

  async addCorruptionPoints(
    userId: string,
    points: number,
    reason: string
  ): Promise<UserProfile | null> {
    const profile = this.profiles[userId];
    if (!profile) return null;

    profile.corruptionPoints += points;
    profile.lastActivity = new Date().toISOString();

    const oldRank = profile.rank;
    profile.rank = this.calculateRank(profile);

    await this.checkAchievements(profile);
    await this.saveProfiles();

    this.logger.warn('Corruption points added', {
      userId,
      points,
      reason,
      newTotal: profile.corruptionPoints,
    });

    if (oldRank !== profile.rank) {
      this.logger.warn('User rank degraded', { userId, oldRank, newRank: profile.rank });
    }

    return profile;
  }

  async assignPenitence(
    userId: string,
    reason: string,
    assignedBy: string,
    durationHours: number
  ): Promise<string | null> {
    const profile = this.profiles[userId];
    if (!profile) return null;

    // Ensure penitencias array exists
    if (!profile.penitencias) {
      profile.penitencias = [];
    }

    const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const penitenceId = `pen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newPenitence: PenitenceStatus = {
      id: penitenceId,
      active: true,
      reason,
      assignedBy,
      assignedAt: new Date().toISOString(),
      duration: durationHours,
      endsAt,
    };

    profile.penitencias.push(newPenitence);

    // Keep backward compatibility: update penitenceStatus with latest penitence
    profile.penitenceStatus = newPenitence;

    await this.saveProfiles();
    this.logger.inquisitor('Penitence assigned', {
      userId,
      reason,
      assignedBy,
      durationHours,
      penitenceId,
    });
    return penitenceId;
  }

  async removePenitence(userId: string, penitenceId?: string): Promise<boolean> {
    const profile = this.profiles[userId];
    if (!profile) return false;

    // Ensure penitencias array exists
    if (!profile.penitencias) {
      profile.penitencias = [];
    }

    if (penitenceId) {
      // Remove specific penitence by ID
      const index = profile.penitencias.findIndex((p) => p.id === penitenceId);
      if (index === -1) return false;

      profile.penitencias.splice(index, 1);

      // Update penitenceStatus to the most recent active penitence, or undefined
      const activePenitencias = profile.penitencias.filter((p) => p.active);
      profile.penitenceStatus =
        activePenitencias.length > 0 ? activePenitencias[activePenitencias.length - 1] : undefined;
    } else {
      // Remove all active penitencias (backward compatibility)
      profile.penitencias = profile.penitencias.map((p) => ({ ...p, active: false }));
      profile.penitenceStatus = undefined;
    }

    await this.saveProfiles();
    this.logger.info('Penitence removed', { userId, penitenceId: penitenceId || 'all' });
    return true;
  }

  async removePenitenceById(userId: string, penitenceId: string): Promise<boolean> {
    return this.removePenitence(userId, penitenceId);
  }

  getActivePenitencias(userId: string): PenitenceStatus[] {
    const profile = this.profiles[userId];
    if (!profile || !profile.penitencias) return [];

    const now = Date.now();
    return profile.penitencias.filter((p) => p.active && new Date(p.endsAt).getTime() > now);
  }

  getAllPenitencias(userId: string): PenitenceStatus[] {
    const profile = this.profiles[userId];
    if (!profile || !profile.penitencias) return [];

    return [...profile.penitencias];
  }

  async recordMessage(userId: string): Promise<void> {
    const profile = this.profiles[userId];
    if (!profile) return;

    profile.totalMessages++;
    profile.lastActivity = new Date().toISOString();

    if (profile.totalMessages % 100 === 0) {
      await this.addPurityPoints(userId, 10, 'Participación activa (100 mensajes)');
    }
  }

  async recordHeresyDetection(userId: string, level: string): Promise<void> {
    const profile = this.profiles[userId];
    if (!profile) return;

    profile.heresiesDetected++;

    const points: Record<string, number> = {
      PURA_FE: 5,
      SOSPECHOSO: 2,
      HEREJIA_MENOR: -5,
      HEREJIA_MAYOR: -15,
      HEREJIA_EXTREMA: -30,
    };

    const pointChange = points[level] || 0;
    if (pointChange > 0) {
      await this.addPurityPoints(userId, pointChange, `Fe demostrada (${level})`);
    } else if (pointChange < 0) {
      await this.addCorruptionPoints(userId, Math.abs(pointChange), `Herejía detectada (${level})`);
    }
  }

  async recordSermon(userId: string): Promise<void> {
    const profile = this.profiles[userId];
    if (!profile) return;

    profile.sermonsReceived++;
    await this.addPurityPoints(userId, 3, 'Sermón recibido');
  }

  private calculateRank(profile: UserProfile): UserRank {
    const netPurity = profile.purityPoints - profile.corruptionPoints;

    if (netPurity < -100) return 'Herético';
    if (netPurity < -50) return 'Sospechoso';
    if (netPurity < 50) return 'Ciudadano';
    if (netPurity < 150) return 'Fiel';
    if (netPurity < 300) return 'Devoto';
    if (netPurity < 500) return 'Piadoso';
    if (netPurity < 750) return 'Santo';
    if (netPurity < 1000) return 'Mártir';
    return 'Servo del Emperador';
  }

  private async checkAchievements(profile: UserProfile): Promise<void> {
    for (const achievement of this.achievements) {
      if (!profile.achievements.includes(achievement.id) && achievement.condition(profile)) {
        profile.achievements.push(achievement.id);
        await this.addPurityPoints(profile.userId, 25, `Logro desbloqueado: ${achievement.name}`);
        this.logger.info('Achievement unlocked', {
          userId: profile.userId,
          achievement: achievement.name,
        });
      }
    }
  }

  private initializeAchievements(): Achievement[] {
    return [
      {
        id: 'first_steps',
        name: 'Primeros Pasos',
        description: 'Envía tu primer mensaje',
        icon: '👶',
        condition: (profile) => profile.totalMessages >= 1,
      },
      {
        id: 'faithful_servant',
        name: 'Servo Fiel',
        description: 'Alcanza 100 puntos de pureza',
        icon: '🕊️',
        condition: (profile) => profile.purityPoints >= 100,
      },
      {
        id: 'heresy_hunter',
        name: 'Cazador de Herejías',
        description: 'Detecta 10 herejías',
        icon: '🔍',
        condition: (profile) => profile.heresiesDetected >= 10,
      },
      {
        id: 'sermon_listener',
        name: 'Oyente Devoto',
        description: 'Recibe 25 sermones',
        icon: '📖',
        condition: (profile) => profile.sermonsReceived >= 25,
      },
      {
        id: 'active_member',
        name: 'Miembro Activo',
        description: 'Envía 1000 mensajes',
        icon: '💬',
        condition: (profile) => profile.totalMessages >= 1000,
      },
      {
        id: 'pure_soul',
        name: 'Alma Pura',
        description: 'Alcanza 500 puntos de pureza',
        icon: '✨',
        condition: (profile) => profile.purityPoints >= 500,
      },
      {
        id: 'emperor_blessed',
        name: 'Bendecido por el Emperador',
        description: 'Alcanza el rango de Santo',
        icon: '👑',
        condition: (profile) =>
          profile.rank === 'Santo' ||
          profile.rank === 'Mártir' ||
          profile.rank === 'Servo del Emperador',
      },
    ];
  }

  getLeaderboard(limit: number = 10): Array<{ rank: number; profile: UserProfile }> {
    const sorted = Object.values(this.profiles)
      .sort((a, b) => b.purityPoints - b.corruptionPoints - (a.purityPoints - a.corruptionPoints))
      .slice(0, limit);

    return sorted.map((profile, index) => ({
      rank: index + 1,
      profile,
    }));
  }

  getRankDistribution(): Record<UserRank, number> {
    const distribution = {} as Record<UserRank, number>;
    const ranks: UserRank[] = [
      'Herético',
      'Sospechoso',
      'Ciudadano',
      'Fiel',
      'Devoto',
      'Piadoso',
      'Santo',
      'Mártir',
      'Servo del Emperador',
    ];

    ranks.forEach((rank) => (distribution[rank] = 0));

    Object.values(this.profiles).forEach((profile) => {
      distribution[profile.rank]++;
    });

    return distribution;
  }

  getAchievementById(id: string): Achievement | undefined {
    return this.achievements.find((achievement) => achievement.id === id);
  }

  getUserStats(userId: string): UserProfile | null {
    return this.profiles[userId] || null;
  }

  getTotalUsers(): number {
    return Object.keys(this.profiles).length;
  }

  async cleanupExpiredPenitence(): Promise<void> {
    const now = new Date();
    let cleaned = 0;

    for (const profile of Object.values(this.profiles)) {
      // Ensure penitencias array exists
      if (!profile.penitencias) {
        profile.penitencias = [];
      }

      // Clean up expired penitencias in the array
      let hasExpiredPenitencias = false;
      for (const penitence of profile.penitencias) {
        if (penitence.active && new Date(penitence.endsAt) <= now) {
          penitence.active = false;
          cleaned++;
          hasExpiredPenitencias = true;
        }
      }

      // Update penitenceStatus to the most recent active penitence, or undefined
      if (hasExpiredPenitencias || profile.penitenceStatus?.active) {
        const activePenitencias = profile.penitencias.filter((p) => p.active);
        profile.penitenceStatus =
          activePenitencias.length > 0
            ? activePenitencias[activePenitencias.length - 1]
            : undefined;
      }
    }

    if (cleaned > 0) {
      await this.saveProfiles();
      this.logger.info('Expired penitence cleaned up', { count: cleaned });
    }
  }
}
