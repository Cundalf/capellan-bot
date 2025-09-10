#!/usr/bin/env bun
/**
 * Purge Script - Reconstruir índice de conocimiento
 * Uso: bun run scripts/purge.ts
 * 
 * Este script elimina completamente el índice de conocimiento y lo reconstruye desde cero.
 * Útil para resolver problemas de corrupción o después de actualizaciones importantes.
 */

import { Database } from 'bun:sqlite';
import { existsSync } from 'fs';
import { Logger } from '../src/utils/logger';
import { RAGSystem } from '../src/services/rag-system';

const DATABASE_DIR = './database';

async function runPurge() {
  try {
    console.log('🔥 CAPELLÁN BOT - PURGA DEL ÍNDICE DE CONOCIMIENTO');
    console.log('=' .repeat(60));
    console.log('⚠️  ADVERTENCIA: Esta operación es IRREVERSIBLE');
    console.log('   • Eliminará todos los embeddings existentes');
    console.log('   • Requerirá volver a procesar todos los documentos');
    console.log('   • Puede tardar varios minutos');
    console.log('=' .repeat(60));
    
    // Confirmación requerida
    const confirm = await confirmPurge();
    if (!confirm) {
      console.log('❌ Purga cancelada por el usuario');
      return;
    }
    
    console.log('\n🔥 Iniciando purga del índice...');
    const startTime = Date.now();
    
    // Inicializar logger y RAG system
    const logger = new Logger('purge-script');
    const ragSystem = new RAGSystem(logger);
    
    // Ejecutar purga
    await ragSystem.rebuildIndex();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n✅ PURGA COMPLETADA EXITOSAMENTE`);
    console.log(`⏱️  Duración: ${duration} segundos`);
    console.log(`📅 Fecha: ${new Date().toLocaleString()}`);
    console.log('\n💡 El índice ha sido reconstruido. Los Inquisidores pueden ahora agregar nuevo conocimiento.');
    
    // Cerrar conexiones
    await ragSystem.close();
    
  } catch (error: any) {
    console.error(`❌ Error durante la purga:`, error.message);
    console.error('   Contacta al Adeptus Mechanicus para resolución.');
    process.exit(1);
  }
}

async function confirmPurge(): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n¿Estás seguro de continuar? (escribe "PURGAR" para confirmar): ', (answer: string) => {
      rl.close();
      resolve(answer.trim() === 'PURGAR');
    });
  });
}

// Verificar que la base de datos existe
function validateDatabase(): boolean {
  const vectorStorePath = `${DATABASE_DIR}/vector-store.sqlite`;
  if (!existsSync(vectorStorePath)) {
    console.log('⚠️  Base de datos vectorial no encontrada');
    console.log('   Asegúrate de que el bot haya sido ejecutado al menos una vez');
    return false;
  }
  return true;
}

// Ejecutar si se llama directamente
if (import.meta.main) {
  if (!validateDatabase()) {
    process.exit(1);
  }
  
  await runPurge();
}
