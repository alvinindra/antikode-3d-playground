import { useLayoutEffect } from 'react';
import { useTexture } from '@react-three/drei';
import { Color, Matrix3, MeshStandardMaterial, Object3D, SkinnedMesh, SRGBColorSpace } from 'three';

// The GLB albedo mixes neutral fur, jersey yarn and binding. Change the two
// dyes in linear space, retaining the original knit, seams and coat markings.
function palette(yarnHex: string, trimHex: string) {
  const yarn = new Color(yarnHex), trim = new Color(trimHex);
  return new Matrix3().set(1, yarn.r, trim.r, 1, yarn.g, trim.g, 1, yarn.b, trim.b);
}
const dye = palette('#81824e', '#302c27').multiply(palette('#f6c52b', '#68a147').invert());

export function JouninVest({ model }: { model: Object3D }) {
  const print = useTexture(`${import.meta.env.BASE_URL}models/jounin-print.svg`);
  useLayoutEffect(() => {
    const mesh = model.getObjectByName('Shorthaired_calico_in_knit_vest') as SkinnedMesh;
    const brazil = mesh.material as MeshStandardMaterial;
    const vest = brazil.clone();
    print.colorSpace = SRGBColorSpace;
    vest.name = 'Coretax - Jounin';
    vest.onBeforeCompile = shader => {
      shader.uniforms.vestDye = { value: dye };
      shader.uniforms.vestPrint = { value: print };
      // The baked side UVs mirror across the spine. Wrap the print around the
      // back in bind space so there is one emblem, even when Coretax curls up.
      shader.vertexShader = 'varying vec3 vestPosition;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nvestPosition = position;');
      shader.fragmentShader = 'varying vec3 vestPosition;\nuniform mat3 vestDye;\nuniform sampler2D vestPrint;\n' +
        shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          float angle = atan(vestPosition.x, vestPosition.y - 0.17);
          vec2 printUv = vec2(-0.068 * angle / 0.30, (vestPosition.z - 0.013) / 0.21) + 0.5;
          vec4 ink = texture2D(vestPrint, printUv);
          diffuseColor.rgb = mix(max(vestDye * diffuseColor.rgb, vec3(0.0)), ink.rgb, ink.a);
        `);
    };
    mesh.material = vest;
    return () => { mesh.material = brazil; vest.dispose(); };
  }, [model, print]);
  return null;
}
