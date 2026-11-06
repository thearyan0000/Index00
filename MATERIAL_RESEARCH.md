# Material rendering update — 1 November 2026

## Research translated into rendering

- **Yarn structure:** plain, twill and satin are different interlacings of warp
  and weft. The renderer now models alternating crossings for linen/canvas,
  a 3/1 warp-faced twill for denim, and longer floats for silk satin.
  [CottonWorks: Weaving Basics](https://cottonworks.com/learning-hub/weaving/weaving-basics/)
- **Linen:** irregular yarn thickness/slubs are treated as local variations,
  not a uniform grid or a universal characteristic of every linen. The linen
  preset adds restrained slub variation and a dry matte response.
  [University of the Arts London: Linen Properties](https://sff.arts.ac.uk/Fibre%20Properties/linenroperties.html)
- **Velvet:** its pile construction differs from a flat woven face. The preset
  uses dense fine pile, a dark face and a broad grazing sheen rather than visible
  canvas crossings. The lighting is an artistic approximation of that structure.
  [Textile Research Centre: The production of velvet](https://www.trc-leiden.nl/trc-digital-exhibition/index.php/velvet/item/175-the-production-of-velvet)
- **Stitch tension:** excess thread tension gathers fabric as the thread relaxes;
  needle/thread size, weave density and structural jamming also affect puckering.
  Consequently the tension control produces slender gathers around the seam.
  Visible tears are a separate wear treatment, rather than the default response
  to every stitch. [Coats: Eliminating Seam Puckering](https://www.coats.com/id/info-hub/Eliminating-Seam-Puckering/)

## Controls and implementation

There are six materials: natural linen, cotton canvas, indigo denim, ivory silk
satin, wine velvet and tulle net. The cloth selector and fabric buttons select the
same material, avoiding the former two unrelated texture systems. Surface effects
(clean, grain, moire and chemistry) remain independent.

Each material has cached 512 × 512 colour/coverage and normal/roughness maps.
Maps are generated locally once per selected material and mipmapped on the GPU.
No texture downloads, scanned assets or image-generation service are required.
Yarn relief, colour, scale, roughness and the satin/pile light response distinguish
the presets. Fold slopes deform the sampling coordinates of both weave and image.

Soft drape, crumpling and pressed creases have depth, frequency and direction
controls. These are height-field shading/displacement effects, not a dynamic
cloth solver with gravity, collision or freely moving edges. Fine wrinkles can
be easier to see with grazing light. Small needle punctures remain under the
thread; wear opens sparse, irregular splits along the fabric grain. Undo and
unpick remove the corresponding marks.

## Blending

The new menu contains the 27 requested modes, in the requested order, plus thread
opacity. The thread/mesh is the blend layer and the cloth/photograph is the base.
Modes operate on clamped display RGB. Dissolve uses stable pixel coverage, and
the nonseparable Hue/Saturation/Color/Luminosity modes use luminance/saturation
operations, not simple channel replacement.

Behavior follows [Adobe's mode descriptions](https://helpx.adobe.com/photoshop/desktop/repair-retouch/adjust-light-tone/blending-mode-descriptions.html)
and the applicable formulas in [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/#blending).
Native Canvas2D compositing provides an independent pixel reference for supported
modes; arithmetic golden values cover the remaining modes. This does not promise
bit-for-bit Photoshop equivalence across its colour profiles, HDR modes or Fill
semantics. Saved projects store stable mode identifiers; old bespoke modes map
to the nearest standard operation.
