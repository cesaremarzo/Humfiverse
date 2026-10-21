#!/bin/sh
# Renders the eight week-2 cards (1600x900) from cards.html with headless Chrome.
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
names="1:mon-thread-1-cover 2:mon-thread-2-escrow 3:mon-thread-3-tranches 4:mon-thread-4-two-keys 5:mon-thread-5-release-link 6:wed-release-link 7:thu-studios 8:tue-telegram-domanda"
for pair in $names; do
  n=${pair%%:*}; f=${pair#*:}
  "$CHROME" --headless --hide-scrollbars --force-device-scale-factor=1 --window-size=1600,900 \
    --virtual-time-budget=4000 --user-data-dir="${TMPDIR:-/tmp}/hv-cards" --screenshot="$PWD/$n-$f.png" "file://$PWD/cards.html?card=$n" 2>/dev/null
done
