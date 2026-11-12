#!/bin/sh
# Raider-Bausatz: alle Animationen des PixelLab-Charakters holen (ZIP über api.pixellab.ai, der Proxy setzt den Schlüssel)
# nach projects/nomadgirl/assets/raider/source/anims/<name>/frame_NNN.png
set -e
ID=${1:-59cb5f11-84ed-419f-abbe-5ff5ecfbfe8e}
DST=projects/nomadgirl/assets/raider/source/anims
TMP=$(mktemp -d)
curl -sS -o "$TMP/c.zip" "https://api.pixellab.ai/mcp/characters/$ID/download"
cd "$TMP" && unzip -q c.zip && cd - >/dev/null
mkdir -p "$DST"
for d in "$TMP"/*/animations/*/east; do
  n=$(basename "$(dirname "$d")")
  rm -rf "$DST/$n"; mkdir -p "$DST/$n"; cp "$d"/*.png "$DST/$n/"
done
ls "$DST"
rm -rf "$TMP"
