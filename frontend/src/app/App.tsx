
import { useEffect } from 'react';
import { mountStudio } from '../engine/legacyEngine';
import { useEditorStore } from '../store/useEditorStore';
import { useProjectAutosave } from '../hooks/useProjectAutosave';
import { ProjectLibrary } from '../features/projects/ProjectLibrary';
import { EditorStage,EditorHeader,EditorPanels,EditorTools,EditorDialogs,EditorLoader } from '../components/StudioShell';
import '../styles/studio.css';
import '../styles/projects.css';
import '../styles/editorial-v2.css';

function EditorRuntime(){
  const attachEngine=useEditorStore(s=>s.attachEngine);
  useEffect(()=>{
    // Intentionally initialize once. Legacy shader/DOM event bridge is mounted
    // after React inserts the shell and is not tied to React state changes.
    const engine=mountStudio();
    attachEngine(engine);
  },[attachEngine]);
  useProjectAutosave();
  return null;
}
export function App(){
  return <>
    <EditorStage/><EditorHeader/><EditorPanels/><EditorTools/><EditorDialogs/><EditorLoader/>
    <ProjectLibrary/>
    <EditorRuntime/>
  </>;
}
