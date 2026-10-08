import { vec4, output, agxToneMapping } from 'three/tsl';

// WebGPURenderer tone-maps the whole frame in one pass and ignores material.toneMapped, so instead
// of renderer.toneMapping we apply AgX per material, only to the lit objects (the sky and water stay as is)
export const applyToneMapping = (object, { renderer, exposure }) => {
  object.traverse((child) => {
    if (!child.isMesh) return;
    const toNodeMaterial = (material) => {
      // the same conversion the renderer does for regular (e.g. GLTF) materials
      const nodeMaterial = renderer.library.fromMaterial(material);
      // `output` is the material's final color (after lighting and fog)
      nodeMaterial.outputNode = vec4(agxToneMapping(output.rgb, exposure), output.a);
      return nodeMaterial;
    };
    child.material = Array.isArray(child.material) ? child.material.map(toNodeMaterial) : toNodeMaterial(child.material);
  });
};
