import { expect, test, describe, beforeEach, afterEach, spyOn } from 'bun:test';
import { existsSync } from 'fs';
import { rm, mkdir } from 'fs/promises';
import { InquisitorService } from '@/services/inquisitor-service';
import { Logger } from '@/utils/logger';
import type { BotConfig, Inquisitor } from '@/types';

describe('InquisitorService', () => {
  let inquisitorService: InquisitorService;
  let mockLogger: Logger;
  const testDataPath = './test-inquisitor-data';

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
    spyOn(mockLogger, 'inquisitor').mockImplementation(() => {});

    // Clean up test directory
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
    await mkdir(testDataPath, { recursive: true });

    inquisitorService = new InquisitorService(mockLogger, testDataPath);
  });

  afterEach(async () => {
    if (existsSync(testDataPath)) {
      await rm(testDataPath, { recursive: true });
    }
  });

  test('should start with empty inquisitor list', () => {
    expect(inquisitorService.getInquisitorCount()).toBe(0);
    expect(inquisitorService.isInquisitor('user123')).toBe(false);
  });

  test('should add new inquisitor', async () => {
    const userId = 'user123';
    const username = 'TestInquisitor';
    const grantedBy = 'admin456';

    await inquisitorService.addInquisitor(userId, username, grantedBy);

    expect(inquisitorService.isInquisitor(userId)).toBe(true);
    expect(inquisitorService.getInquisitorCount()).toBe(1);

    const inquisitor = inquisitorService.getInquisitor(userId);
    expect(inquisitor).not.toBeNull();
    expect(inquisitor!.username).toBe(username);
    expect(inquisitor!.grantedBy).toBe(grantedBy);
    expect(inquisitor!.rank).toBe('Inquisidor');
  });

  test('should not allow duplicate inquisitors', async () => {
    const userId = 'user123';
    const username = 'TestInquisitor';

    await inquisitorService.addInquisitor(userId, username);

    await expect(
      inquisitorService.addInquisitor(userId, username)
    ).rejects.toThrow(`${username} ya es un Inquisidor`);
  });

  test('should remove inquisitor', async () => {
    const userId = 'user123';
    const username = 'TestInquisitor';

    await inquisitorService.addInquisitor(userId, username);
    expect(inquisitorService.isInquisitor(userId)).toBe(true);

    const removed = await inquisitorService.removeInquisitor(userId);

    expect(removed).not.toBeNull();
    expect(removed!.username).toBe(username);
    expect(inquisitorService.isInquisitor(userId)).toBe(false);
    expect(inquisitorService.getInquisitorCount()).toBe(0);
  });

  test('should return null when removing non-existent inquisitor', async () => {
    const removed = await inquisitorService.removeInquisitor('nonexistent');
    expect(removed).toBeNull();
  });

  test('should create supreme inquisitor when none exist', async () => {
    const userId = 'user123';
    const username = 'SupremeInquisitor';

    await inquisitorService.createSupremeInquisitor(userId, username);

    expect(inquisitorService.isSupremeInquisitor(userId)).toBe(true);
    const inquisitor = inquisitorService.getInquisitor(userId);
    expect(inquisitor!.rank).toBe('Inquisidor Supremo');
    expect(inquisitor!.grantedBy).toBe('AUTOPROCLAMACIÓN');
  });

  test('should not create supreme inquisitor when others exist', async () => {
    // Add a regular inquisitor first
    await inquisitorService.addInquisitor('user1', 'RegularInquisitor');

    await expect(
      inquisitorService.createSupremeInquisitor('user2', 'SupremeInquisitor')
    ).rejects.toThrow('Ya existen Inquisidores');
  });

  test('should promote inquisitor to supreme', async () => {
    const userId = 'user123';
    const username = 'TestInquisitor';
    const promotedBy = 'emperor';

    await inquisitorService.addInquisitor(userId, username);
    expect(inquisitorService.isSupremeInquisitor(userId)).toBe(false);

    await inquisitorService.promoteToSupreme(userId, promotedBy);

    expect(inquisitorService.isSupremeInquisitor(userId)).toBe(true);
    const inquisitor = inquisitorService.getInquisitor(userId);
    expect(inquisitor!.rank).toBe('Inquisidor Supremo');
    expect(inquisitor!.grantedBy).toBe(promotedBy);
  });

  test('should not promote non-existent user', async () => {
    await expect(
      inquisitorService.promoteToSupreme('nonexistent', 'admin')
    ).rejects.toThrow('El usuario no es un Inquisidor');
  });

  test('should not promote already supreme inquisitor', async () => {
    const userId = 'user123';
    const username = 'SupremeInquisitor';

    await inquisitorService.createSupremeInquisitor(userId, username);

    await expect(
      inquisitorService.promoteToSupreme(userId, 'admin')
    ).rejects.toThrow('Ya es un Inquisidor Supremo');
  });

  test('should get all inquisitors', async () => {
    await inquisitorService.addInquisitor('user1', 'Inquisitor1');
    await inquisitorService.addInquisitor('user2', 'Inquisitor2');

    const all = inquisitorService.getAllInquisitors();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all.user1.username).toBe('Inquisitor1');
    expect(all.user2.username).toBe('Inquisitor2');
  });

  test('should get supreme inquisitors only', async () => {
    await inquisitorService.addInquisitor('user1', 'Regular1');
    await inquisitorService.addInquisitor('user2', 'Regular2');
    await inquisitorService.promoteToSupreme('user2', 'admin');

    const supremeInquisitors = inquisitorService.getSupremeInquisitors();
    expect(supremeInquisitors).toHaveLength(1);
    expect(supremeInquisitors[0].userId).toBe('user2');
    expect(supremeInquisitors[0].inquisitor.username).toBe('Regular2');
  });

  test('should update inquisitor username', async () => {
    const userId = 'user123';
    const oldUsername = 'OldName';
    const newUsername = 'NewName';

    await inquisitorService.addInquisitor(userId, oldUsername);
    await inquisitorService.updateInquisitorUsername(userId, newUsername);

    const inquisitor = inquisitorService.getInquisitor(userId);
    expect(inquisitor!.username).toBe(newUsername);
  });

  test('should not update username for non-existent inquisitor', async () => {
    await expect(
      inquisitorService.updateInquisitorUsername('nonexistent', 'NewName')
    ).rejects.toThrow('El usuario no es un Inquisidor');
  });

  test('should format inquisitors list correctly', async () => {
    expect(inquisitorService.formatInquisitorsList()).toBe('*No hay Inquisidores registrados.*');

    await inquisitorService.addInquisitor('user1', 'Regular1', 'admin');
    await inquisitorService.addInquisitor('user2', 'Supreme1', 'admin', 'Inquisidor Supremo');

    const formatted = inquisitorService.formatInquisitorsList();
    expect(formatted).toContain('👁️ **Regular1** (Inquisidor)');
    expect(formatted).toContain('👑 **Supreme1** (Inquisidor Supremo)');
    expect(formatted).toContain('Nombrado por: admin');
  });

  test('should format individual inquisitor info', async () => {
    const userId = 'user123';
    const username = 'TestInquisitor';

    expect(inquisitorService.formatInquisitorInfo('nonexistent'))
      .toBe('Usuario no encontrado en los registros imperiales.');

    await inquisitorService.addInquisitor(userId, username, 'admin');

    const formatted = inquisitorService.formatInquisitorInfo(userId);
    expect(formatted).toContain(`👁️ **${username}**`);
    expect(formatted).toContain('**Rango:** Inquisidor');
    expect(formatted).toContain('**Nombrado por:** admin');
    expect(formatted).toContain('**Fecha:**');
  });

  test('should create and restore backup', async () => {
    await inquisitorService.addInquisitor('user1', 'Inquisitor1', 'admin');
    await inquisitorService.addInquisitor('user2', 'Inquisitor2', 'admin');

    const backupPath = await inquisitorService.createBackup();
    expect(backupPath).toMatch(/inquisidores_.*\.json$/);

    // Clear current data
    await inquisitorService.removeInquisitor('user1');
    await inquisitorService.removeInquisitor('user2');
    expect(inquisitorService.getInquisitorCount()).toBe(0);

    // Restore from backup
    await inquisitorService.restoreFromBackup(backupPath);
    expect(inquisitorService.getInquisitorCount()).toBe(2);
    expect(inquisitorService.isInquisitor('user1')).toBe(true);
    expect(inquisitorService.isInquisitor('user2')).toBe(true);
  });

  test('should validate backup data structure', async () => {
    const invalidBackupPath = `${testDataPath}/invalid-backup.json`;
    const invalidData = {
      user1: { username: 'Test' } // Missing required fields
    };

    await Bun.write(invalidBackupPath, JSON.stringify(invalidData));

    await expect(
      inquisitorService.restoreFromBackup(invalidBackupPath)
    ).rejects.toThrow('Invalid backup data structure');
  });

  test('should handle file system errors gracefully', async () => {
    const mockService = new InquisitorService(mockLogger, '/invalid/path/that/does/not/exist');

    // Should still work despite path issues (creates directory)
    expect(mockService.getInquisitorCount()).toBe(0);
  });
});