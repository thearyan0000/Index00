
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, saveProject } from '../../database/db';
import { useEditorStore } from '../../store/useEditorStore';
import { exportProjectFile, importProjectFile } from './projectFiles';

export function ProjectLibrary() {
  const {engine,projectName,activeProjectId,saveStatus,openProjects,setOpenProjects,setProjectName,setActiveProjectId,setSaveStatus} = useEditorStore();
  const projects=useLiveQuery(()=>db.projects.orderBy('updatedAt').reverse().toArray(),[],[]);
  const fileInput=useRef<HTMLInputElement>(null);
  const [working,setWorking]=useState(false);
  async function save(){
    if(!engine)return;
    setWorking(true);
    try {
      await saveProject({id:activeProjectId,name:projectName,updatedAt:Date.now(),snapshot:engine.checkpoint()});
      setSaveStatus('saved locally');
    } catch(e){ console.error(e);setSaveStatus('save failed — export a backup'); }
    finally{setWorking(false);}
  }
  async function open(id:string){
    if(!engine)return;
    setWorking(true);
    try{
      const p=await db.projects.get(id);
      if(!p)return;
      await engine.restoreCheckpoint(p.snapshot);
      setActiveProjectId(p.id);setProjectName(p.name);setSaveStatus('project opened');setOpenProjects(false);
    } catch(e){console.error(e);setSaveStatus('could not open project');}
    finally{setWorking(false);}
  }
  async function importFile(file:File){
    if(!engine)return;
    setWorking(true);
    try{
      const p=await importProjectFile(file);
      const id=crypto.randomUUID();
      await engine.restoreCheckpoint(p.snapshot);
      await saveProject({id,name:p.name,updatedAt:Date.now(),snapshot:engine.checkpoint()});
      setActiveProjectId(id);setProjectName(p.name);setSaveStatus('imported');setOpenProjects(false);
    }catch(e){console.error(e);setSaveStatus('invalid project file');}
    finally{setWorking(false);}
  }
  return <>
    <button id="projectLauncher" type="button" onClick={()=>setOpenProjects(!openProjects)} aria-expanded={openProjects}>
      <span>PROJECTS</span><small>{saveStatus}</small>
    </button>
    {openProjects && <div className="project-backdrop" onPointerDown={(e)=>{if(e.target===e.currentTarget)setOpenProjects(false)}}>
      <section className="project-sheet" role="dialog" aria-modal="true" aria-label="Project library">
        <header><div><small>INDEX 00 / ARCHIVE</small><h2>Projects.</h2></div><button type="button" onClick={()=>setOpenProjects(false)}>CLOSE ×</button></header>
        <label className="project-label">CURRENT PROJECT
          <input value={projectName} maxLength={90} onChange={e=>setProjectName(e.target.value)}/>
        </label>
        <div className="project-actions">
          <button disabled={working||!engine} onClick={save}>SAVE PROJECT</button>
          <button disabled={working||!engine} onClick={async()=>{if(engine)await exportProjectFile(projectName,engine.checkpoint())}}>EXPORT BACKUP ↗</button>
          <button disabled={working||!engine} onClick={()=>fileInput.current?.click()}>IMPORT PROJECT</button>
        </div>
        <input ref={fileInput} hidden type="file" accept=".json,.index00.json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void importFile(f);e.target.value='';}}/>
        <div className="project-list-heading">BROWSER PROJECTS <span>{projects?.length||0}</span></div>
        <div className="project-list">
          {projects?.length?projects.map(p=><div className="project-list-row" key={p.id}>
            <button disabled={working} onClick={()=>open(p.id)}><b>{p.name}</b><small>{new Date(p.updatedAt).toLocaleString()}</small></button>
            <button disabled={working} title="Delete project" onClick={async()=>{if(window.confirm(`Delete ${p.name}?`))await db.projects.delete(p.id)}}>×</button>
          </div>):<p>No saved projects yet. Changes autosave on this device.</p>}
        </div>
        <footer>All project data stays on this device. Export backups before clearing browser data.</footer>
      </section>
    </div>}
  </>;
}
