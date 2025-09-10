#!/usr/bin/env bun
/**
 * Backup Script - Crear backup completo del sistema
 * Uso: bun run scripts/backup.ts
 */

import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATABASE_DIR = './database';
const BACKUPS_DIR = './database/backups';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = join(BACKUPS_DIR, `backup-${timestamp}`);

async function createBackup() {
  try {
    // Crear directorio de backup
    if (!existsSync(BACKUPS_DIR)) {
      mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    mkdirSync(backupDir, { recursive: true });

    // Lista de archivos críticos a respaldar
    const criticalFiles = [
      'vector-store.sqlite',
      'inquisidores.json', 
      'user-profiles.json',
      'bot.log'
    ];

    let backedUpFiles = 0;
    
    for (const file of criticalFiles) {
      const sourcePath = join(DATABASE_DIR, file);
      const targetPath = join(backupDir, file);
      
      if (existsSync(sourcePath)) {
        copyFileSync(sourcePath, targetPath);
        backedUpFiles++;
        console.log(`✅ Respaldado: ${file}`);
      } else {
        console.log(`⚠️  No encontrado: ${file}`);
      }
    }

    // Crear archivo de metadatos del backup
    const metadata = {
      timestamp: new Date().toISOString(),
      files: backedUpFiles,
      version: 'v2.1.0'
    };
    
    await Bun.write(join(backupDir, 'metadata.json'), JSON.stringify(metadata, null, 2));
    
    console.log(`\n🎉 Backup completado exitosamente`);
    console.log(`📁 Directorio: ${backupDir}`);
    console.log(`📊 Archivos respaldados: ${backedUpFiles}`);

    // Limpiar backups antiguos (mantener solo los últimos 10)
    await cleanOldBackups();
    
  } catch (error) {
    console.error(`❌ Error creando backup:`, error);
    process.exit(1);
  }
}

async function cleanOldBackups() {
  try {
    if (!existsSync(BACKUPS_DIR)) return;
    
    const entries = await Array.fromAsync(
      await (await import('fs/promises')).readdir(BACKUPS_DIR, { withFileTypes: true })
    );
    
    const backupDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('backup-'))
      .sort((a, b) => b.name.localeCompare(a.name)) // Más reciente primero
      .slice(10); // Mantener solo los últimos 10
    
    for (const dir of backupDirs) {
      const dirPath = join(BACKUPS_DIR, dir.name);
      await (await import('fs/promises')).rmdir(dirPath, { recursive: true });
      console.log(`🗑️  Backup antiguo eliminado: ${dir.name}`);
    }
    
  } catch (error) {
    console.warn(`⚠️  Error limpiando backups antiguos:`, error);
  }
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  console.log('🕊️ CAPELLÁN BOT - BACKUP SYSTEM');
  console.log('=' .repeat(50));
  await createBackup();
}