
export interface EditorSnapshot {
  version: 1;
  savedAt: number;
  width: number;
  height: number;
  meshMode: string;
  palette: string;
  image?: Blob | null;
  mesh: Record<string, unknown>;
  settings: Record<string, string | null>;
  [key: string]: unknown;
}
export interface StudioEngine {
  checkpoint(): EditorSnapshot;
  restoreCheckpoint(snapshot: EditorSnapshot): Promise<void>;
  getStatus(): { meshMode: string; palette: string; labMode: boolean; hasImage: boolean; renderer: string };
  redraw(): void;
}
