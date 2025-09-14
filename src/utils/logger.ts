import { existsSync } from 'fs';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { BotConfig, LogEntry } from '@/types';

class Logger {
  private config: BotConfig['logLevel'];
  private logFile: string;

  constructor(config: BotConfig) {
    this.config = config.logLevel;
    this.logFile = './logs/bot.log';
    this.ensureLogDirectory();
  }

  private async ensureLogDirectory() {
    const logDir = './logs';
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }

  private async writeLog(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return;

    const logLine = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
    const contextStr = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const fullLine = `${logLine}${contextStr}
`;

    // Console output
    const colorMap = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m', // green
      warn: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
    };
    console.log(`${colorMap[entry.level]}${logLine}\x1b[0m${contextStr}`);

    // File output
    try {
      await appendFile(this.logFile, fullLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  debug(message: string, context?: Record<string, any>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    });
  }

  info(message: string, context?: Record<string, any>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    });
  }

  warn(message: string, context?: Record<string, any>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    });
  }

  error(message: string, context?: Record<string, any>) {
    this.writeLog({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
    });
  }

  capellan(message: string, context?: Record<string, any>) {
    this.info(`🕊️ ${message}`, context);
  }

  heresy(message: string, context?: Record<string, any>) {
    this.warn(`⚡ HEREJÍA DETECTADA: ${message}`, context);
  }

  inquisitor(message: string, context?: Record<string, any>) {
    this.info(`👁️ INQUISIDOR: ${message}`, context);
  }
}

export { Logger };
