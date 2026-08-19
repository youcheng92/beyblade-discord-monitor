import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async load() {
    try {
      const state = JSON.parse(await readFile(this.filePath, 'utf8'));
      return state.products && typeof state.products === 'object'
        ? state.products
        : null;
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error(`無法讀取狀態檔 ${this.filePath}：${error.message}`);
    }
  }

  async save(products) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const state = {
      version: 1,
      updatedAt: new Date().toISOString(),
      products,
    };
    await writeFile(this.filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}
