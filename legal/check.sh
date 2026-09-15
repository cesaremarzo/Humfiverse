#!/usr/bin/env bash
# Tells whether any file with legal weight changed since legal/ was last
# reviewed. It notices changes; it does not understand them — the
# procedure for updating the documents is .claude/skills/legal-review.
#
#   ./legal/check.sh           verify (exit 1 if something changed)
#   ./legal/check.sh --update  record current hashes, after updating legal/
set -euo pipefail

cd "$(dirname "$0")/.."
RECORD=legal/reviewed-files.sha256

WATCHED=(
  contracts/contracts/*.sol
  server/contract-template.js
  server/data/schema.js
  server/services/compliance.service.js
  server/routes/compliance.routes.js
  webapp/src/app/core/embedded-wallet.ts
  webapp/src/app/core/known-wallets.ts
  webapp/src/index.html
  whitepaper/*.md
)

if [[ "${1:-}" == "--update" ]]; then
  shasum -a 256 "${WATCHED[@]}" > "$RECORD"
  echo "Recorded $(wc -l < "$RECORD" | tr -d ' ') files at commit $(git rev-parse --short HEAD)."
  echo "Update the commit and date in legal/README.md and add a CHANGELOG entry."
  exit 0
fi

[[ -f "$RECORD" ]] || { echo "No $RECORD yet: run with --update after a review."; exit 1; }

changed=0
# Files recorded at the last review that changed or disappeared.
while read -r hash path; do
  if [[ ! -f "$path" ]]; then
    echo "REMOVED  $path"; changed=1
  elif [[ "$(shasum -a 256 "$path" | cut -d' ' -f1)" != "$hash" ]]; then
    echo "CHANGED  $path"; changed=1
  fi
done < "$RECORD"
# Watched files that did not exist at the last review.
for path in "${WATCHED[@]}"; do
  grep -q "  $path\$" "$RECORD" || { echo "NEW      $path"; changed=1; }
done

if [[ $changed -eq 1 ]]; then
  echo
  echo "legal/ may be out of date. Follow .claude/skills/legal-review/SKILL.md."
  exit 1
fi
echo "legal/ is up to date with every watched file."
