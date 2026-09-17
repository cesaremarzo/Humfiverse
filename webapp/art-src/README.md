# Rendered art

Source of the images in `webapp/public/assets/art/` (§2.99). Everything is
computed — heightmaps, normals, metal and lacquer shading — so there are no
third-party images or fonts to license, and any piece can be re-rendered.

```sh
python3 -m venv /tmp/art-venv && /tmp/art-venv/bin/pip install numpy pillow
cd webapp/art-src
/tmp/art-venv/bin/python render.py out coins vinyl mic grain   # or any subset
/tmp/art-venv/bin/python vu.py out
for f in out/*.png; do cwebp -q 84 -alpha_q 90 "$f" -o ../public/assets/art/$(basename "${f%.png}").webp; done
```

`grain` is exported at `-q 70`. The seed is fixed, so the output is the same on every run.
