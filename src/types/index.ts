export interface Inquisitor {
  username: string;
  grantedBy: string;
  grantedAt: string;
  rank: 'Inquisidor' | 'Inquisidor Supremo';
}

export interface InquisitorStore {
  [userId: string]: Inquisitor;
}

export interface DocumentMetadata {
  source: string;
  addedBy: string;
  addedAt: string;
  filePath: string;
  title?: string;
  type: 'pdf' | 'web' | 'text';
  processed: boolean;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
  chunkIndex: number;
}

export interface SearchResult {
  document: VectorDocument;
  similarity: number;
  source: string;
}

export interface RAGResponse {
  response: string;
  sources: SearchResult[];
  tokensUsed: number;
}

export interface RAGStats {
  documents: number;
  embeddings: number;
  sources: string[];
  types: Record<string, number>;
}

export type HeresyLevel = 'PURA_FE' | 'SOSPECHOSO' | 'HEREJIA_MENOR' | 'HEREJIA_MAYOR' | 'HEREJIA_EXTREMA';

export interface BotConfig {
  autoHeresyDetectionChance: number;
  maxDailyEmbeddings: number;
  sqlitePath: string;
  documentsPath: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface CommandContext {
  isInquisitor: boolean;
  userId: string;
  username: string;
  channelId: string;
  guildId?: string;
}

export type CommandType = 'heresy_analysis' | 'daily_sermon' | 'knowledge_search' | 'questions' | 'general';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export interface UserProfile {
  userId: string;
  username: string;
  purityPoints: number;
  corruptionPoints: number;
  totalMessages: number;
  heresiesDetected: number;
  sermonsReceived: number;
  rank: UserRank;
  joinedAt: string;
  lastActivity: string;
  achievements: string[];
  penitenceStatus?: PenitenceStatus;
  penitencias: PenitenceStatus[];
}

export interface UserProfiles {
  [userId: string]: UserProfile;
}

export type UserRank =  | 'Herético'  | 'Sospechoso'   | 'Ciudadano'  | 'Fiel'  | 'Devoto'  | 'Piadoso'  | 'Santo'  | 'Mártir'  | 'Servo del Emperador';

export interface PenitenceStatus {
  id: string;
  active: boolean;
  reason: string;
  assignedBy: string;
  assignedAt: string;
  duration: number;
  endsAt: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (profile: UserProfile) => boolean;
}