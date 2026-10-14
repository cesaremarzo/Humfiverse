# Brand assets

Logo, avatar, social headers and the YouTube banner (moved here from the repo
root on 12 Oct 2026).

- `humfiverse-logo-1024.png` / `.png.pdf` — the nine-bar mark, 1024 px.
- `humfiverse-logo-1024 copy.png` — a variant of the same logo (the files differ).
- `humfiverse-avatar.png`, `humfiverse-x-header.png` — X / social profile.
- `humfiverse trademark.jpg` — the trademark image.
- `humfiverse-youtube-banner.png` — 2560×1440 channel banner, rendered from
  `humfiverse-youtube-banner.html` (text inside the 1546×423 safe area):
  `chrome --headless --window-size=2560,1440 --screenshot=humfiverse-youtube-banner.png humfiverse-youtube-banner.html`
- `social/week-2/` — the eight cards (1600×900) for week 2 of the editorial plan
  (`planning/piano-editoriale-social.md`), all from `cards.html?card=N`;
  `./render.sh` re-renders them with headless Chrome.
