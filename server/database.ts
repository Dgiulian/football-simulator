import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const METRICS_FILE = path.join(DATA_DIR, 'metrics.json');

export interface ModelRecord {
  id: number;
  created_at: string;
  episodes: number;
  save_percentage: number;
  epsilon: number;
  hyperparameters: string;
  qtable: string;
}

export interface MetricRecord {
  id: number;
  episode: number;
  timestamp: string;
  save_percentage: number;
  epsilon: number;
  average_reward: number;
  total_saves: number;
  total_goals: number;
  total_misses: number;
}

export class ModelDatabase {
  private models: ModelRecord[] = [];
  private metrics: MetricRecord[] = [];
  private nextModelId = 1;
  private nextMetricId = 1;

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    this.loadData();
  }

  private loadData(): void {
    try {
      if (fs.existsSync(MODELS_FILE)) {
        const data = fs.readFileSync(MODELS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.models = parsed.models || [];
        this.nextModelId = parsed.nextModelId || 1;
      }
      
      if (fs.existsSync(METRICS_FILE)) {
        const data = fs.readFileSync(METRICS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.metrics = parsed.metrics || [];
        this.nextMetricId = parsed.nextMetricId || 1;
      }
    } catch (err) {
      console.log('No existing data found, starting fresh');
    }
  }

  private saveData(): void {
    try {
      fs.writeFileSync(MODELS_FILE, JSON.stringify({
        models: this.models,
        nextModelId: this.nextModelId
      }, null, 2));
      
      fs.writeFileSync(METRICS_FILE, JSON.stringify({
        metrics: this.metrics,
        nextMetricId: this.nextMetricId
      }, null, 2));
    } catch (err) {
      console.error('Error saving data:', err);
    }
  }

  saveModel(
    episodes: number,
    savePercentage: number,
    epsilon: number,
    hyperparameters: object,
    qtable: object
  ): number {
    const model: ModelRecord = {
      id: this.nextModelId++,
      created_at: new Date().toISOString(),
      episodes,
      save_percentage: savePercentage,
      epsilon,
      hyperparameters: JSON.stringify(hyperparameters),
      qtable: JSON.stringify(qtable)
    };
    
    this.models.push(model);
    this.saveData();
    
    return model.id;
  }

  saveMetric(
    episode: number,
    savePercentage: number,
    epsilon: number,
    averageReward: number,
    totalSaves: number,
    totalGoals: number,
    totalMisses: number
  ): void {
    const metric: MetricRecord = {
      id: this.nextMetricId++,
      episode,
      timestamp: new Date().toISOString(),
      save_percentage: savePercentage,
      epsilon,
      average_reward: averageReward,
      total_saves: totalSaves,
      total_goals: totalGoals,
      total_misses: totalMisses
    };
    
    this.metrics.push(metric);
    
    // Keep only last 5000 metrics to prevent file bloat
    if (this.metrics.length > 5000) {
      this.metrics = this.metrics.slice(-5000);
    }
    
    this.saveData();
  }

  getLatestModel(): ModelRecord | null {
    if (this.models.length === 0) return null;
    return this.models[this.models.length - 1];
  }

  getModelById(id: number): ModelRecord | null {
    return this.models.find(m => m.id === id) || null;
  }

  getAllModels(limit: number = 100): ModelRecord[] {
    return this.models.slice(-limit);
  }

  getMetricsForGraphs(windowSize: number = 10): MetricRecord[] {
    // Return every Nth metric for smoother graphs
    return this.metrics.filter((_, index) => index % windowSize === 0);
  }

  getMetricsRange(startEpisode: number, endEpisode: number): MetricRecord[] {
    return this.metrics.filter(m => m.episode >= startEpisode && m.episode <= endEpisode);
  }

  getTotalEpisodes(): number {
    if (this.metrics.length === 0) return 0;
    return Math.max(...this.metrics.map(m => m.episode));
  }

  deleteOldModels(keepLatest: number = 10): void {
    if (this.models.length > keepLatest) {
      this.models = this.models.slice(-keepLatest);
      this.saveData();
    }
  }

  close(): void {
    this.saveData();
  }
}
