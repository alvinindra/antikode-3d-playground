# Studio visitor

The short-sleeved avatar in `studio-visitor.glb` is adapted from [Ready Player
Me's QuickStart preview mesh](https://github.com/readyplayerme/rpm-unity-sdk-core/blob/c963f808f63f538013cc007763ccd066ba542705/Samples%7E/QuickStart/PreviewAvatar/PreviewMesh.glb).
The SDK license is included in `READYPLAYERME-LICENSE.txt`. The black cotton
shirt reproduces the Antikode **Anti Crew** design from the supplied merchandise
references. Its front and back prints share the garment's original UVs and
fabric normal map. The idle, seated, airborne and dance poses are local adaptations.

The walk and run use takes **07_01** and **09_01** from the Carnegie Mellon
Graphics Lab Motion Capture Database, BVH conversion by Bruce Hahne (cgspeed).
The data used in this project was obtained from [mocap.cs.cmu.edu](https://mocap.cs.cmu.edu/).
The database was created with funding from NSF EIA-0196217.
See the [usage terms and conversion notes](https://github.com/una-dinosauria/cmu-mocap/blob/master/READMEFIRST.txt).

To regenerate the GLB, download the preview mesh plus
[07_01.bvh](https://github.com/una-dinosauria/cmu-mocap/blob/master/data/007/07_01.bvh)
and [09_01.bvh](https://github.com/una-dinosauria/cmu-mocap/blob/master/data/009/09_01.bvh),
then run `node tools/bake-visitor.mjs PreviewMesh.glb 07_01.bvh 09_01.bvh`.
No motion or avatar service is contacted at runtime.

The shirt texture is included with the bake inputs. To change the print, edit
`tools/artwork/anti-crew-ink.svg`, run `python tools/artwork/bake-shirt.py PreviewMesh.glb`
(Pillow and CairoSVG), then rerun the GLB bake. Normal builds need neither Python nor fonts.

## Studio cat

The feline sculpt, skeleton and motion in `studio-cat.glb` are adapted from
[Majid Manzarpour's procedural-animals](https://github.com/majidmanzarpour/threejs-procedural-animals/tree/c95ae49346aa8e140a924376cec6cf0073d99512)
under the included `PROCEDURAL-ANIMALS-LICENSE.txt` (MIT). The coat markings,
yellow vest with green binding, eyes and tongue were adapted to the supplied cat photo.
Short guard hairs are combed along the sculpt and skinned to the same rig; their
strand texture is generated locally and excludes the vest, eyes, nose and paw pads.
`node tools/bake-studio-cat.mjs` rebuilds the local GLB and its six clips.
The sculpting and IK tools are not shipped to the browser.
