// Stable IDs are persisted so adding modes never reinterprets a saved project.
export const blendModes = [
  ['normal','Normal'],['dissolve','Dissolve'],['darken','Darken'],['multiply','Multiply'],
  ['color-burn','Color Burn'],['linear-burn','Linear Burn'],['darker-color','Darker Color'],
  ['lighten','Lighten'],['screen','Screen'],['color-dodge','Color Dodge'],
  ['linear-dodge','Linear Dodge (Add)'],['lighter-color','Lighter Color'],
  ['overlay','Overlay'],['soft-light','Soft Light'],['hard-light','Hard Light'],
  ['vivid-light','Vivid Light'],['linear-light','Linear Light'],['pin-light','Pin Light'],
  ['hard-mix','Hard Mix'],['difference','Difference'],['exclusion','Exclusion'],
  ['subtract','Subtract'],['divide','Divide'],['hue','Hue'],['saturation','Saturation'],
  ['color','Color'],['luminosity','Luminosity']
];
export function restoreBlendIndex(snapshot) {
  const named=blendModes.findIndex(([id])=>id===snapshot.blendModeId);
  if(named>=0)return named;
  // Older bespoke effects have no exact standard equivalent. Preserve the
  // closest compositing intent, rather than treating old numeric IDs as new ones.
  return [0,3,13,3,8,12,8,0,19,19][snapshot.blendMode] ?? 0;
}
