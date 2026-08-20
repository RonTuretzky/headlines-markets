#!/usr/bin/env bash
# Convert the Playwright recording videos (playwright.record.config.ts) into optimized
# GIFs embedded in the docs. Two-pass palette for clean colors at a small size.
#   pnpm exec playwright test --config=playwright.record.config.ts   # record first
#   bash scripts/make-gifs.sh
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="../docs/assets"
mkdir -p "$OUT"
FPS=12
WIDTH=900

convert() {
  local src="$1" name="$2"
  [ -f "$src" ] || { echo "skip $name (no video)"; return; }
  local pal
  pal="$(mktemp -t "$name").png"
  ffmpeg -y -ss 0.5 -i "$src" -vf "fps=$FPS,scale=$WIDTH:-1:flags=lanczos,palettegen=stats_mode=diff" "$pal" 2>/dev/null
  ffmpeg -y -ss 0.5 -i "$src" -i "$pal" \
    -lavfi "fps=$FPS,scale=$WIDTH:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" \
    "$OUT/$name.gif" 2>/dev/null
  rm -f "$pal"
  echo "wrote $OUT/$name.gif ($(du -h "$OUT/$name.gif" | cut -f1))"
}

convert "test-results/record-browse-and-trade/video.webm" "browse-and-trade"
convert "test-results/record-create-a-market/video.webm" "create-market"
convert "test-results/record-settle-with-a-real-DKIM-proof/video.webm" "settle-dkim"
