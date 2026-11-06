
import Dexie, { type Table } from 'dexie';
import type { EditorSnapshot } from '../engine/types';
export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  snapshot: EditorSnapshot;
}
class Index00Database extends Dexie {
  projects!: Table<SavedProject, string>;
  constructor() {
    super('Index00Studio');
    this.version(1).stores({ projects: 'id, updatedAt, name' });
  }
}
export const db = new Index00Database();
export async function saveProject(project: SavedProject) {
  await db.projects.put(project);
}
