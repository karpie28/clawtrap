import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { LoggerFactory } from '../logging';

const logger = LoggerFactory.getLogger('patterns');

export interface PatternDefinition {
  name: string;
  type: string;
  subtype: string;
  pattern: string;
  flags?: string;
  confidence: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description?: string;
  examples?: string[];
  mitre_attack_id?: string;
}

export interface PatternFile {
  version: string;
  category: string;
  description: string;
  patterns: PatternDefinition[];
}

export class PatternLoader {
  private patterns: Map<string, PatternDefinition[]> = new Map();
  private patternsDir: string;

  constructor(patternsDir: string) {
    this.patternsDir = patternsDir;
  }

  async load(): Promise<void> {
    if (!fs.existsSync(this.patternsDir)) {
      logger.warn(`Patterns directory not found: ${this.patternsDir}`);
      return;
    }

    const files = fs.readdirSync(this.patternsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    for (const file of files) {
      try {
        const filePath = path.join(this.patternsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = yaml.load(content) as PatternFile;

        if (parsed?.patterns) {
          const category = parsed.category || path.basename(file, path.extname(file));
          this.patterns.set(category, parsed.patterns);
          logger.info(`Loaded ${parsed.patterns.length} patterns from ${file}`);
        }
      } catch (error) {
        logger.error(`Failed to load patterns from ${file}`, {
          error: (error as Error).message,
        });
      }
    }
  }

  getPatternsByCategory(category: string): PatternDefinition[] {
    return this.patterns.get(category) || [];
  }

  getAllPatterns(): PatternDefinition[] {
    const all: PatternDefinition[] = [];
    for (const patterns of this.patterns.values()) {
      all.push(...patterns);
    }
    return all;
  }

  getCategories(): string[] {
    return Array.from(this.patterns.keys());
  }

  getPatternCount(): number {
    let count = 0;
    for (const patterns of this.patterns.values()) {
      count += patterns.length;
    }
    return count;
  }

  addPattern(category: string, pattern: PatternDefinition): void {
    const existing = this.patterns.get(category) || [];
    existing.push(pattern);
    this.patterns.set(category, existing);
  }

  removePattern(category: string, patternName: string): boolean {
    const existing = this.patterns.get(category);
    if (!existing) return false;

    const index = existing.findIndex(p => p.name === patternName);
    if (index === -1) return false;

    existing.splice(index, 1);
    return true;
  }
}

export function validatePattern(pattern: PatternDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!pattern.name) errors.push('Missing pattern name');
  if (!pattern.type) errors.push('Missing pattern type');
  if (!pattern.pattern) errors.push('Missing regex pattern');

  // Validate regex
  if (pattern.pattern) {
    try {
      new RegExp(pattern.pattern, pattern.flags || 'gi');
    } catch (e) {
      errors.push(`Invalid regex: ${(e as Error).message}`);
    }
  }

  // Validate confidence
  if (pattern.confidence < 0 || pattern.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }

  // Validate severity
  const validSeverities = ['low', 'medium', 'high', 'critical'];
  if (!validSeverities.includes(pattern.severity)) {
    errors.push(`Invalid severity: ${pattern.severity}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
