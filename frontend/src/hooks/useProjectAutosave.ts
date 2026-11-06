
import { useEffect } from 'react';
import { db } from '../database/db';
import { useEditorStore } from '../store/useEditorStore';

// Autosave after editing stops; never serialize large mesh arrays during pointermove.
export function useProjectAutosave(){
  const engine=useEditorStore(s=>s.engine);
  useEffect(()=>{
    if(!engine)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    let idle:number|undefined;
    let generation=0;
    let restoring=false;
    let disposed=false;
    async function boot(){
      try{
        const p=await db.projects.get('autosave');
        if(!p||disposed)return;
        restoring=true;
        await engine!.restoreCheckpoint(p.snapshot);
        useEditorStore.getState().setProjectName(p.name || 'Untitled Study');
        useEditorStore.getState().setSaveStatus('recovered last session');
      }catch(e){console.warn('Project recovery unavailable',e);}
      finally{restoring=false;}
    }
    void boot();
    function cancelPending(){
      generation++;
      clearTimeout(timer);
      if(idle!==undefined && 'cancelIdleCallback' in window)window.cancelIdleCallback(idle);
      idle=undefined;
    }
    function schedule(event:Event){
      if(restoring||disposed)return;
      const target=event.target;
      if(!(target instanceof Element))return;
      // Ignore passive mouse movements, project library and export dialogs.
      if(target.closest('.project-sheet, #projectLauncher, #exportOptions, #sv'))return;
      cancelPending();
      const scheduledGeneration=generation;
      useEditorStore.getState().setSaveStatus('unsaved changes');
      timer=setTimeout(async()=>{
        if(disposed||restoring)return;
        const execute=async()=>{
          if(disposed||restoring||scheduledGeneration!==generation)return;
          try{
            const name=useEditorStore.getState().projectName;
            await db.projects.put({id:'autosave',name,updatedAt:Date.now(),snapshot:engine!.checkpoint()});
            if(!disposed)useEditorStore.getState().setSaveStatus('autosaved');
          }catch(e){console.warn('Autosave failed',e);useEditorStore.getState().setSaveStatus('save failed');}
        };
        if('requestIdleCallback' in window)idle=window.requestIdleCallback(()=>void execute(),{timeout:1800});
        else void execute();
      },2200);
    }
    const monitored=['pointerup','change','input'];
    function resetProject(event:Event){
      const store=useEditorStore.getState();
      store.setActiveProjectId('autosave');store.setProjectName('Untitled Study');store.setOpenProjects(false);
      schedule(event);
    }
    document.addEventListener('index00:reset',resetProject);
    document.addEventListener('pointerdown',cancelPending,true);
    monitored.forEach(e=>document.addEventListener(e,schedule,true));
    return()=>{disposed=true;cancelPending();document.removeEventListener('index00:reset',resetProject);document.removeEventListener('pointerdown',cancelPending,true);monitored.forEach(e=>document.removeEventListener(e,schedule,true));};
  },[engine]);
}
