/**
 * Test data loader
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestDataset } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TestDataLoader {
  static async load(dataPath: string): Promise<TestDataset> {
    const dataFilePath = join(__dirname, '..', dataPath);
    const testInputsData = await readFile(dataFilePath, 'utf-8');
    return JSON.parse(testInputsData) as TestDataset;
  }
  
  static getSchemaPath(): string {
    return join(__dirname, '..', 'test-data-schema.json');
  }
}