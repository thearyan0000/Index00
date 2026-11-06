
import { create } from 'zustand';
import type { StudioEngine } from '../engine/types';
interface EditorState {
  engine: StudioEngine | null;
  projectName: string;
  activeProjectId: string;
  saveStatus: string;
  openProjects: boolean;
  attachEngine: (engine: StudioEngine) => void;
  setProjectName: (name: string) => void;
  setActiveProjectId: (id: string) => void;
  setSaveStatus: (status: string) => void;
  setOpenProjects: (open: boolean) => void;
}
export const useEditorStore = create<EditorState>((set) => ({
  engine: null,
  projectName: 'Untitled Study',
  activeProjectId: 'autosave',
  saveStatus: 'local workspace',
  openProjects: false,
  attachEngine: (engine) => set({engine}),
  setProjectName: (projectName) => set({projectName}),
  setActiveProjectId: (activeProjectId) => set({activeProjectId}),
  setSaveStatus: (saveStatus) => set({saveStatus}),
  setOpenProjects: (openProjects) => set({openProjects}),
}));
