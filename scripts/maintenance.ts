#!/usr/bin/env bun
/**
 * Maintenance Script - Optimizar y mantener la base de datos
 * Uso: bun run scripts/maintenance.ts
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';

const DATABASE_DIR = './database';

async function runMaintenance() {
  try {
    console.log('🕊️ CAPELLÁN BOT - SISTEMA DE MANTENIMIENTO');
    console.log('=' .repeat(50));
    
    await optimizeVectorDatabase();
    await validateDataIntegrity();
    
    console.log(`\\n🎉 Mantenimiento completado exitosamente`);
    
  } catch (error) {
    console.error(`❌ Error en mantenimiento:`, error);
    process.exit(1);
  }
}

async function optimizeVectorDatabase() {
  try {
    const dbPath = `${DATABASE_DIR}/vector-store.sqlite`;
    if (!existsSync(dbPath)) {
      console.log('⚠️  Base de datos vectorial no encontrada');
      return;
    }
    
    console.log('🔧 Optimizando base de datos vectorial...');
    
    const db = new Database(dbPath);
    
    // Obtener estadísticas antes de la optimización
    const statsBefore = db.query('SELECT COUNT(*) as count FROM documents').get() as { count: number };
    const sizeBefore = (await Bun.file(dbPath).arrayBuffer()).byteLength;
    
    console.log(`   Documentos: ${statsBefore.count}`);
    console.log(`   Tamaño antes: ${(sizeBefore / (1024 * 1024)).toFixed(2)} MB`);
    
    // Ejecutar comandos de mantenimiento SQLite
    db.run('VACUUM');
    db.run('ANALYZE');
    db.run('PRAGMA optimize');
    
    // Reindexar si es necesario
    const indexes = db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND sql IS NOT NULL
    `).all();
    
    for (const index of indexes) {
      db.run(`REINDEX ${(index as any).name}`);
    }
    
    db.close();
    
    // Estadísticas después
    const sizeAfter = (await Bun.file(dbPath).arrayBuffer()).byteLength;
    const savedMB = (sizeBefore - sizeAfter) / (1024 * 1024);
    
    console.log(`   Tamaño después: ${(sizeAfter / (1024 * 1024)).toFixed(2)} MB`);
    if (savedMB > 0) {
      console.log(`   Espacio liberado: ${savedMB.toFixed(2)} MB`);
    }
    
    console.log('✅ Base de datos vectorial optimizada');
    
  } catch (error) {
    console.error('Error optimizando base de datos:', error);
  }
}

async function validateDataIntegrity() {
  try {
    console.log('🔍 Validando integridad de datos...');
    
    let issues = 0;
    
    // Validar perfiles de usuario
    issues += await validateUserProfiles();
    
    // Validar inquisidores
    issues += await validateInquisitors();
    
    // Validar consistencia entre archivos
    issues += await validateCrossFileConsistency();
    
    if (issues === 0) {
      console.log('✅ Integridad de datos: Sin problemas detectados');
    } else {
      console.log(`⚠️  Integridad de datos: ${issues} problema(s) detectado(s)`);
    }
    
  } catch (error) {
    console.error('Error validando integridad:', error);
  }
}

async function validateUserProfiles(): Promise<number> {
  try {
    const profilesPath = `${DATABASE_DIR}/user-profiles.json`;
    if (!existsSync(profilesPath)) return 0;
    
    const profilesData = await Bun.file(profilesPath).text();
    const profiles = JSON.parse(profilesData);
    
    let issues = 0;
    
    for (const [userId, profile] of Object.entries(profiles)) {
      const userProfile = profile as any;
      
      // Validar campos requeridos
      if (!userProfile.userId || !userProfile.username) {
        console.log(`   ⚠️  Usuario ${userId}: Faltan campos básicos`);
        issues++;
      }
      
      // Validar tipos de datos
      if (typeof userProfile.purityPoints !== 'number' || typeof userProfile.corruptionPoints !== 'number') {
        console.log(`   ⚠️  Usuario ${userId}: Tipos de datos incorrectos en puntos`);
        issues++;
      }
      
      // Validar penitencias
      if (userProfile.penitencias && !Array.isArray(userProfile.penitencias)) {
        console.log(`   ⚠️  Usuario ${userId}: Campo penitencias debe ser un array`);
        issues++;
      }
      
      // Validar fechas
      try {
        if (userProfile.joinedAt) new Date(userProfile.joinedAt);
        if (userProfile.lastActivity) new Date(userProfile.lastActivity);
      } catch {
        console.log(`   ⚠️  Usuario ${userId}: Fechas inválidas`);
        issues++;
      }
    }
    
    return issues;
    
  } catch (error) {
    console.error('Error validando perfiles de usuario:', error);
    return 1;
  }
}

async function validateInquisitors(): Promise<number> {
  try {
    const inquisitoresPath = `${DATABASE_DIR}/inquisidores.json`;
    if (!existsSync(inquisitoresPath)) return 0;
    
    const inquisitoresData = await Bun.file(inquisitoresPath).text();
    const inquisidores = JSON.parse(inquisitoresData);
    
    let issues = 0;
    
    for (const [userId, inquisitor] of Object.entries(inquisidores)) {
      const inquisitorData = inquisitor as any;
      
      // Validar campos requeridos
      if (!inquisitorData.username || !inquisitorData.rank || !inquisitorData.grantedBy) {
        console.log(`   ⚠️  Inquisidor ${userId}: Faltan campos requeridos`);
        issues++;
      }
      
      // Validar rango
      const validRanks = ['Inquisidor', 'Inquisidor Supremo'];
      if (!validRanks.includes(inquisitorData.rank)) {
        console.log(`   ⚠️  Inquisidor ${userId}: Rango inválido`);
        issues++;
      }
    }
    
    return issues;
    
  } catch (error) {
    console.error('Error validando inquisidores:', error);
    return 1;
  }
}

async function validateCrossFileConsistency(): Promise<number> {
  try {
    let issues = 0;
    
    // Verificar que todos los inquisidores tienen perfil de usuario
    const profilesPath = `${DATABASE_DIR}/user-profiles.json`;
    const inquisitoresPath = `${DATABASE_DIR}/inquisidores.json`;
    
    if (existsSync(profilesPath) && existsSync(inquisitoresPath)) {
      const profiles = JSON.parse(await Bun.file(profilesPath).text());
      const inquisidores = JSON.parse(await Bun.file(inquisitoresPath).text());
      
      for (const userId of Object.keys(inquisidores)) {
        if (!profiles[userId]) {
          console.log(`   ⚠️  Inquisidor ${userId} no tiene perfil de usuario`);
          issues++;
        }
      }
    }
    
    return issues;
    
  } catch (error) {
    console.error('Error validando consistencia entre archivos:', error);
    return 1;
  }
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  await runMaintenance();
}