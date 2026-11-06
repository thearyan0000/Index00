import assert from 'node:assert/strict';

export async function checkReset({evaluate,waitFor,respondToDialog}){
  await evaluate(`(async()=>{
    window.resetStore=(await import('/src/store/useEditorStore.ts')).useEditorStore;
    window.resetDB=(await import('/src/database/db.ts')).db;
    await resetDB.projects.put({id:'reset-test-saved',name:'Preserved artwork',updatedAt:Date.now(),snapshot:testEngine.checkpoint()});
    resetStore.getState().setActiveProjectId('reset-test-saved');resetStore.getState().setProjectName('Preserved artwork');
    document.querySelector('#ratio').value='9:16';document.querySelector('#ratio').dispatchEvent(new Event('change'));
    document.querySelector('#clothSurface').value='4';document.querySelector('#clothSurface').dispatchEvent(new Event('change'));
    for(const id of ['wrinkleAmount','clothTear','lightPower']){document.querySelector('#'+id).value='90';document.querySelector('#'+id).dispatchEvent(new Event('input'));}
    document.querySelector('#blendMode').value='21';document.querySelector('#blendMode').dispatchEvent(new Event('change'));
    document.querySelector('#themeToggle').click();document.querySelector('#snd').click();
    document.querySelector('#toolPalette').classList.add('is-floating');document.querySelector('#toolPalette').style.setProperty('--dock-x','600px');
    const mask=document.createElement('canvas');mask.width=mask.height=8;
    const s=testEngine.checkpoint();s.mask=mask.toDataURL();s.brushMode='paint';s.labMode=true;await testEngine.restoreCheckpoint(s);
    window.beforeStudioReset=testEngine.checkpoint();
  })()`);
  respondToDialog(false);
  await evaluate(`document.querySelector('#resetStudio').click()`);
  assert.equal(await evaluate('testEngine.checkpoint().canvasAspect'),'9:16');
  assert.equal(await evaluate('testEngine.checkpoint().mesh.stitches.length'),await evaluate('beforeStudioReset.mesh.stitches.length'));
  await evaluate(`(()=>{window.originalGetUserMedia=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>{window.resolveResetCamera=resolve;});document.querySelector('#cam').click();})()`);
  respondToDialog(true);
  await evaluate(`document.querySelector('#resetStudio').click()`);
  await waitFor(`!document.querySelector('#resetStudio').disabled&&document.querySelector('#st').textContent==='studio reset to defaults'`);
  const result=await evaluate(`(()=>{const s=testEngine.checkpoint();return {aspect:s.canvasAspect,mesh:s.meshMode,palette:s.palette,tool:s.tool,repeat:s.repeatMode,cloth:s.clothSurface,tension:s.clothTension,blend:s.blendModeId,settings:s.settings,image:s.image,stitches:s.mesh.stitches.length,mask:s.mask,brush:s.brushMode,lab:s.labMode,theme:s.uiTheme,float:document.querySelector('#toolPalette').classList.contains('is-floating'),sound:document.querySelector('#snd').classList.contains('on'),project:resetStore.getState().activeProjectId,name:resetStore.getState().projectName};})()`);
  assert.equal(result.aspect,'16:9');assert.equal(result.mesh,'square');assert.equal(result.palette,'ghost');assert.equal(result.tool,'cord');assert.equal(result.repeat,'free');
  assert.equal(result.cloth,1);assert.equal(result.tension,.4);assert.equal(result.blend,'normal');assert.equal(result.settings.wrinkleAmount,'35');assert.equal(result.settings.clothTear,'0');assert.equal(result.settings.lightPower,'110');
  assert.equal(result.stitches,0);assert.equal(result.image,null);assert.equal(result.mask,null);assert.equal(result.brush,'full');assert.equal(result.lab,false);assert.equal(result.theme,'light');assert.equal(result.float,false);assert.equal(result.sound,false);assert.equal(result.project,'autosave');assert.equal(result.name,'Untitled Study');
  await evaluate(`(()=>{window.resetCameraStopped=false;resolveResetCamera({getTracks:()=>[{stop:()=>{window.resetCameraStopped=true;}}]});navigator.mediaDevices.getUserMedia=originalGetUserMedia;})()`);
  await waitFor('window.resetCameraStopped===true');
  assert.equal(await evaluate('testEngine.checkpoint().framed'),false);
  await evaluate(`document.querySelector('#undo').click()`);assert.equal(await evaluate('testEngine.checkpoint().mesh.stitches.length'),0);
  await waitFor(`(async()=>{const p=await resetDB.projects.get('autosave');return p?.snapshot.canvasAspect==='16:9'&&p.snapshot.mesh.stitches.length===0&&p.snapshot.image===null;})()`);
  assert.equal(await evaluate(`(async()=>{const p=await resetDB.projects.get('reset-test-saved');return p.name;})()`),'Preserved artwork');
  console.log('Reset confirmation/cancel, all defaults, empty artwork, masks, autosave and preserved saved projects passed');
}
