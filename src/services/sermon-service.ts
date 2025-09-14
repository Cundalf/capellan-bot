import * as fs from 'fs';
import * as path from 'path';
import type { SermonData, SermonResult } from '@/types';
import type { Logger } from '@/utils/logger';
import type { RAGSystem } from './rag-system';

export class SermonService {
  private logger: Logger;
  private ragSystem: RAGSystem;
  private sermonDataPath: string;

  constructor(logger: Logger, ragSystem: RAGSystem) {
    this.logger = logger;
    this.ragSystem = ragSystem;
    this.sermonDataPath = path.join(process.cwd(), 'database', 'sermon-data.json');

    // Ensure database directory exists
    const dbDir = path.dirname(this.sermonDataPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }

  async generateDailySermon(): Promise<SermonResult> {
    try {
      this.logger.info('Generating daily sermon for Imperial Hour...');

      // Topics for sermons - rotating themes from W40K lore
      const sermonTopics = [
        'La pureza de la fe imperial y el deber sagrado',
        'La vigilancia eterna contra los poderes del Caos',
        'El sacrificio de los héroes del Imperio',
        'La luz dorada del Emperador que nos guía',
        'La fuerza en la unidad bajo Su voluntad',
        'La purificación del alma a través del combate',
        'Los mártires que dieron su vida por el Trono Dorado',
        'La oscuridad que acecha más allá de las estrellas',
        'El deber inquebrantable de los fieles servants',
        'La gloria eternal del Imperio de la Humanidad',
        'Los herejes que amenazan nuestra existencia',
        'La protección de los inocentes bajo Su gracia',
        'El poder purificador de la fe verdadera',
        'Los guardianes silenciosos de nuestro destino',
        'La esperanza que arde en la oscuridad del vacío',
      ];

      // Select today's topic based on date to ensure variety
      const today = new Date();
      const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000)
      );
      const selectedTopic = sermonTopics[dayOfYear % sermonTopics.length];

      this.logger.debug('Selected sermon topic', { topic: selectedTopic, dayOfYear });

      // Generate sermon using RAG system
      const ragResponse = await this.ragSystem.generateCapellanResponse(
        `Genera un sermón épico y oscuro sobre: ${selectedTopic}. Debe ser inspirador pero grimdark, mencionando la lucha eternal contra las fuerzas del mal, la importancia del sacrificio, y la gloria del Imperio. Incluye referencias específicas al Emperador como guía divina.`,
        'daily_sermon'
      );

      const baseSermon = ragResponse.response;

      // Add the special introduction message
      const fullSermon = `🕰️ Son las 19:40 - La Hora Imperial ha llegado. El Emperador convoca a sus fieles para la reflexión vespertina...

⚔️ **SERMÓN DIARIO DEL CAPELLÁN** ⚔️

${baseSermon}

*Ave Imperator! El Emperador Protege!* 🕊️⚡`;

      this.logger.info('Daily sermon generated successfully', {
        topic: selectedTopic,
        tokensUsed: ragResponse.tokensUsed,
        sourcesUsed: ragResponse.sources.length,
      });

      return { sermon: fullSermon, topic: selectedTopic };
    } catch (error: any) {
      this.logger.error('Failed to generate daily sermon', { error: error.message });

      // Fallback sermon in case of error
      const fallbackSermon = `🕰️ Son las 19:40 - La Hora Imperial ha llegado. El Emperador convoca a sus fieles para la reflexión vespertina...

⚔️ **SERMÓN DIARIO DEL CAPELLÁN** ⚔️

Hermanos y hermanas del Imperio, en este momento sagrado recordamos que la fe es nuestro escudo más poderoso contra las sombras que acechan. El Emperador, desde Su Trono Dorado, observa cada uno de nuestros actos y bendice a aquellos que permanecen firmes en su devoción.

En la oscuridad del vacío, cuando los demonios susurran y los herejes conspiran, solo nuestra fe inquebrantable puede mantenernos en el sendero de la luz. Que cada decisión que tomemos honre Su sacrificio eterno y fortalezca las barreras que protegen la humanidad.

*Ave Imperator! El Emperador Protege!* 🕊️⚡`;

      return { sermon: fallbackSermon, topic: 'Sermón de emergencia - fe inquebrantable' };
    }
  }

  private loadSermonData(): SermonData {
    try {
      if (fs.existsSync(this.sermonDataPath)) {
        const data = fs.readFileSync(this.sermonDataPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error: any) {
      this.logger.warn('Failed to load sermon data, using defaults', { error: error.message });
    }

    // Default data
    return {
      lastSermonDate: '1900-01-01',
      sermonsSent: 0,
    };
  }

  private saveSermonData(data: SermonData): void {
    try {
      fs.writeFileSync(this.sermonDataPath, JSON.stringify(data, null, 2));
    } catch (error: any) {
      this.logger.error('Failed to save sermon data', { error: error.message });
    }
  }

  public hasSermonBeenSentToday(): boolean {
    const data = this.loadSermonData();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

    return data.lastSermonDate === today;
  }

  public markSermonAsSent(topic?: string): void {
    const data = this.loadSermonData();
    const today = new Date().toISOString().split('T')[0];

    data.lastSermonDate = today;
    data.sermonsSent += 1;
    if (topic) {
      data.lastSermonTopic = topic;
    }

    this.saveSermonData(data);

    this.logger.info('Sermon marked as sent for today', {
      date: today,
      totalSermonsSent: data.sermonsSent,
      topic,
    });
  }

  public getSermonStats(): SermonData {
    return this.loadSermonData();
  }
}
