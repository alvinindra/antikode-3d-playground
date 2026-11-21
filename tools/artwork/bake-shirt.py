"""Rebuild the shirt albedo from the original QuickStart GLB and the editable ink plate."""

import json
import struct
import sys
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageFilter, ImageOps


def original_cloth(glb):
    data = glb.read_bytes()
    end = 20 + struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:end])
    shirt = next(m for m in doc["materials"] if m["name"] == "Wolf3D_Outfit_Top")
    texture = doc["textures"][shirt["pbrMetallicRoughness"]["baseColorTexture"]["index"]]
    view = doc["bufferViews"][doc["images"][texture["source"]]["bufferView"]]
    start = end + 8 + view.get("byteOffset", 0)
    return Image.open(BytesIO(data[start:start + view["byteLength"]])).convert("L")


def clear_old_ink(cloth, uv_box):
    x0, y0, x1, y1 = (round(v * cloth.size[i % 2]) for i, v in enumerate(uv_box))
    patch = cloth.crop((x0, y0, x1, y1))
    w, h = patch.size
    # Reconstruct the cloth underneath the old logos from the bare panel on either side.
    left = patch.crop((0, 0, 1, h)).resize((w, h))
    right = patch.crop((w - 1, 0, w, h)).resize((w, h))
    ramp = Image.linear_gradient("L").transpose(Image.Transpose.ROTATE_90).resize((w, h))
    clean = Image.composite(right, left, ramp)
    mask = Image.new("L", (w, h))
    mask.paste(255, (6, 6, w - 6, h - 6))
    cloth.paste(clean, (x0, y0), mask.filter(ImageFilter.GaussianBlur(1.6)))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Usage: python bake-shirt.py PreviewMesh.glb")
    art = Path(__file__).resolve().parent
    cloth = original_cloth(Path(sys.argv[1]))
    clear_old_ink(cloth, (0.310, 0.365, 0.452, 0.470))
    clear_old_ink(cloth, (0.650, 0.367, 0.889, 0.530))
    plate = Image.open(BytesIO(cairosvg.svg2png(bytestring=(art / "anti-crew-ink.svg").read_bytes()))).getchannel("A")
    cloth = cloth.resize(plate.size, Image.Resampling.BICUBIC)
    cotton = ImageOps.colorize(cloth, (6, 6, 7), (166, 166, 169))
    ink = ImageOps.colorize(cloth, (214, 213, 208), (245, 244, 239), whitepoint=70)
    Image.composite(ink, cotton, plate).save(art / "anti-crew-basecolor.jpg", quality=95, subsampling=0, optimize=True)
