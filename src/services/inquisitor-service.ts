import { existsSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Inquisitor, InquisitorStore } from '@/types';
import type { Logger } from '@/utils/logger';

export class InquisitorService {
  private inquisitors: InquisitorStore = {};
  private logger: Logger;
  private filePath: string;

  constructor(logger: Logger, dataPath: string = './database') {
    this.logger = logger;
    this.filePath = join(dataPath, 'inquisidores.json');
    this.ensureDataDirectory(dataPath);
    this.loadInquisitors();
  }

  private async ensureDataDirectory(dataPath: string) {
    if (!existsSync(dataPath)) {
      await mkdir(dataPath, { recursive: true });
      this.logger.info('Created data directory', { path: dataPath });
    }
  }

  private async loadInquisitors() {
    try {
      if (existsSync(this.filePath)) {
        const data = await readFile(this.filePath, 'utf8');
        this.inquisitors = JSON.parse(data);
        this.logger.info('Inquisitors loaded', {
          count: Object.keys(this.inquisitors).length,
          inquisitors: Object.values(this.inquisitors).map((i) => i.username),
        });
      } else {
        this.logger.info('No existing inquisitors file found, starting fresh');
        this.inquisitors = {};
      }
    } catch (error: any) {
      this.logger.error('Failed to load inquisitors', { error: error.message });
      this.inquisitors = {};
    }
  }

  private async saveInquisitors() {
    try {
      await writeFile(this.filePath, JSON.stringify(this.inquisitors, null, 2));
      this.logger.info('Inquisitors saved', {
        count: Object.keys(this.inquisitors).length,
      });
    } catch (error: any) {
      this.logger.error('Failed to save inquisitors', { error: error.message });
      throw error;
    }
  }

  isInquisitor(userId: string): boolean {
    return userId in this.inquisitors;
  }

  getInquisitor(userId: string): Inquisitor | null {
    return this.inquisitors[userId] || null;
  }

  getAllInquisitors(): InquisitorStore {
    return { ...this.inquisitors };
  }

  getInquisitorCount(): number {
    return Object.keys(this.inquisitors).length;
  }

  async addInquisitor(
    userId: string,
    username: string,
    grantedBy: string = 'SISTEMA',
    rank: Inquisitor['rank'] = 'Inquisidor'
  ): Promise<void> {
    if (this.isInquisitor(userId)) {
      throw new Error(`${username} ya es un Inquisidor`);
    }

    this.inquisitors[userId] = {
      username,
      grantedBy,
      grantedAt: new Date().toISOString(),
      rank,
    };

    await this.saveInquisitors();

    this.logger.inquisitor('Nuevo Inquisidor nombrado', {
      userId,
      username,
      grantedBy,
      rank,
    });
  }

  async removeInquisitor(userId: string): Promise<Inquisitor | null> {
    const inquisitor = this.inquisitors[userId];

    if (!inquisitor) {
      return null;
    }

    delete this.inquisitors[userId];
    await this.saveInquisitors();

    this.logger.inquisitor('Inquisidor destituido', {
      userId,
      username: inquisitor.username,
      rank: inquisitor.rank,
    });

    return inquisitor;
  }

  async promoteToSupreme(userId: string, promotedBy: string): Promise<void> {
    const inquisitor = this.inquisitors[userId];

    if (!inquisitor) {
      throw new Error('El usuario no es un Inquisidor');
    }

    if (inquisitor.rank === 'Inquisidor Supremo') {
      throw new Error('Ya es un Inquisidor Supremo');
    }

    this.inquisitors[userId] = {
      ...inquisitor,
      rank: 'Inquisidor Supremo',
      grantedBy: promotedBy,
      grantedAt: new Date().toISOString(),
    };

    await this.saveInquisitors();

    this.logger.inquisitor('Inquisidor promovido a Supremo', {
      userId,
      username: inquisitor.username,
      promotedBy,
    });
  }

  async createSupremeInquisitor(userId: string, username: string): Promise<void> {
    if (Object.keys(this.inquisitors).length > 0) {
      throw new Error(
        'Ya existen Inquisidores. No se puede crear un Inquisidor Supremo automáticamente.'
      );
    }

    await this.addInquisitor(userId, username, 'AUTOPROCLAMACIÓN', 'Inquisidor Supremo');

    this.logger.inquisitor('Primer Inquisidor Supremo autoproclamado', {
      userId,
      username,
    });
  }

  isSupremeInquisitor(userId: string): boolean {
    const inquisitor = this.inquisitors[userId];
    return inquisitor?.rank === 'Inquisidor Supremo';
  }

  getSupremeInquisitors(): { userId: string; inquisitor: Inquisitor }[] {
    return Object.entries(this.inquisitors)
      .filter(([_, inquisitor]) => inquisitor.rank === 'Inquisidor Supremo')
      .map(([userId, inquisitor]) => ({ userId, inquisitor }));
  }

  async updateInquisitorUsername(userId: string, newUsername: string): Promise<void> {
    const inquisitor = this.inquisitors[userId];

    if (!inquisitor) {
      throw new Error('El usuario no es un Inquisidor');
    }

    this.inquisitors[userId] = {
      ...inquisitor,
      username: newUsername,
    };

    await this.saveInquisitors();

    this.logger.info('Inquisitor username updated', {
      userId,
      oldUsername: inquisitor.username,
      newUsername,
    });
  }

  // Utility methods for Discord embed formatting
  formatInquisitorsList(): string {
    const entries = Object.entries(this.inquisitors);

    if (entries.length === 0) {
      return '*No hay Inquisidores registrados.*';
    }

    return entries
      .map(([userId, data]) => {
        const rankEmoji = data.rank === 'Inquisidor Supremo' ? '👑' : '👁️';
        return `${rankEmoji} **${data.username}** (${data.rank})\n   └ Nombrado por: ${data.grantedBy}`;
      })
      .join('\n\n');
  }

  formatInquisitorInfo(userId: string): string {
    const inquisitor = this.inquisitors[userId];

    if (!inquisitor) {
      return 'Usuario no encontrado en los registros imperiales.';
    }

    const rankEmoji = inquisitor.rank === 'Inquisidor Supremo' ? '👑' : '👁️';
    const grantedDate = new Date(inquisitor.grantedAt).toLocaleString();

    return (
      `${rankEmoji} **${inquisitor.username}**\n` +
      `**Rango:** ${inquisitor.rank}\n` +
      `**Nombrado por:** ${inquisitor.grantedBy}\n` +
      `**Fecha:** ${grantedDate}`
    );
  }

  // Backup and restore functionality
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./database/backups/inquisidores_${timestamp}.json`;

    try {
      await mkdir('./database/backups', { recursive: true });
      await writeFile(backupPath, JSON.stringify(this.inquisitors, null, 2));

      this.logger.info('Inquisitors backup created', { path: backupPath });
      return backupPath;
    } catch (error: any) {
      this.logger.error('Failed to create inquisitors backup', { error: error.message });
      throw error;
    }
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    try {
      const data = await readFile(backupPath, 'utf8');
      const backupData: InquisitorStore = JSON.parse(data);

      // Validate backup data structure
      for (const [userId, inquisitor] of Object.entries(backupData)) {
        if (
          !inquisitor.username ||
          !inquisitor.grantedBy ||
          !inquisitor.grantedAt ||
          !inquisitor.rank
        ) {
          throw new Error(`Invalid backup data structure for user ${userId}`);
        }
      }

      this.inquisitors = backupData;
      await this.saveInquisitors();

      this.logger.info('Inquisitors restored from backup', {
        path: backupPath,
        count: Object.keys(this.inquisitors).length,
      });
    } catch (error: any) {
      this.logger.error('Failed to restore inquisitors from backup', {
        error: error.message,
        path: backupPath,
      });
      throw error;
    }
  }
}
