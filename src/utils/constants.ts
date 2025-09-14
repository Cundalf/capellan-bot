export const WARHAMMER_CONSTANTS = {
  // Domains permitidos para descargas
  ALLOWED_DOMAINS: [
    'wh40k.lexicanum.com',
    'warhammer40k.fandom.com',
    'warhammer-community.com',
    '1d4chan.org',
    'reddit.com/r/40kLore',
  ],

  // Palabras clave heréticas para auto-detección
  HERETICAL_KEYWORDS: [
    'chaos',
    'caos',
    'khorne',
    'slaanesh',
    'nurgle',
    'tzeentch',
    'hereje',
    'blasfemia',
    'el emperador está muerto',
    'tau are good',
    'eldar superiority',
    'ork victory',
    'tyranid hunger',
    'dark gods',
    'warp corruption',
    'daemon prince',
  ],

  // Frases características del Capellán
  CHAPLAIN_PHRASES: {
    PROTECTION: 'El Emperador Protege',
    GREETING: 'Ave Imperator!',
    BATTLE_CRY: 'Por el Trono Dorado!',
    HERESY: '¡HEREJÍA!',
    ERROR: 'Los espíritus de la máquina me fallan',
    BLESSING: 'Que Su luz dorada os guíe',
    PURGE: 'Purificar, limpiar, servir',
  },

  // Niveles de herejía y sus colores
  HERESY_LEVELS: {
    PURA_FE: { color: '#00FF00', description: 'Fe pura e inmaculada' },
    SOSPECHOSO: { color: '#FFFF00', description: 'Requiere vigilancia' },
    HEREJIA_MENOR: { color: '#FFA500', description: 'Desviación doctrinal menor' },
    HEREJIA_MAYOR: { color: '#FF0000', description: 'Grave transgresión imperial' },
    HEREJIA_EXTREMA: { color: '#8B0000', description: 'Corrupción total del alma' },
  },

  // Configuraciones del sistema RAG
  RAG_CONFIG: {
    CHUNK_SIZE: 1000,
    CHUNK_OVERLAP: 200,
    MAX_CONTEXT_LENGTH: 8000,
    SIMILARITY_THRESHOLD: 0.7,
    MAX_RESULTS: 5,
    EMBEDDING_MODEL: 'text-embedding-3-small',
    CHAT_MODEL: 'gpt-4o-mini',
  },
} as const;

export const DISCORD_COLORS = {
  GOLD: 0xffd700,
  RED: 0xff0000,
  GREEN: 0x00ff00,
  BLUE: 0x0099ff,
  ORANGE: 0xffa500,
  DARK_RED: 0x8b0000,
  YELLOW: 0xffff00,
  PURPLE: 0x9932cc,
} as const;
