
import type { EditorSnapshot } from '../../engine/types';
// Blobs are stored directly by Dexie, but exported JSON needs an embedded data URL.
function blobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
export async function exportProjectFile(name: string, snapshot: EditorSnapshot) {
  const image = snapshot.image instanceof Blob ? await blobAsDataURL(snapshot.image) : null;
  const data = JSON.stringify({kind:'index00-project', name,
    snapshot:{...snapshot,image:image ? {dataURL:image,type:snapshot.image?.type}:null}});
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`${name.trim().replace(/[^a-z0-9_-]+/gi,'-')||'index00'}.index00.json`;
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export async function importProjectFile(file: File): Promise<{name:string;snapshot:EditorSnapshot}> {
  const data=JSON.parse(await file.text());
  if(data.kind!=='index00-project'||data.snapshot?.version!==1)throw new Error('Invalid Index 00 project');
  const snapshot=data.snapshot as EditorSnapshot;
  const encoded=(snapshot.image as {dataURL?:string}|null)?.dataURL;
  if(encoded) snapshot.image=await (await fetch(encoded)).blob();
  return {name:String(data.name||file.name),snapshot};
}
