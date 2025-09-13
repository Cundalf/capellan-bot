import { CapellanBot } from '@/services/capellan-bot';

async function main() {
  console.log('🕊️ Iniciando Bot Capellán de Warhammer 40k...');
  console.log('👁️ En nombre del Emperador, comenzando servicios...');
  
  try {
    const bot = new CapellanBot();
    await bot.start();
    // Success message is now handled in onReady() after full initialization
    
  } catch (error) {
    console.error('❌ Error fatal iniciando el bot:', error);
    process.exit(1);
  }
}
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});