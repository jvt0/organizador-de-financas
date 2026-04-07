import type { SourceType } from '../domain/types';

export type DetectionResult = {
  sourceType: SourceType | 'unknown';
  confidence: number;
};

export function detectImporter(): never {
  throw new Error('detectImporter is not implemented yet.');
}
