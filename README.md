# Inspector Blanque

Mobile-first standalone web app for evaluating chess positions with a local Stockfish WASM engine.

## Features

- Upload or paste PGN/FEN input
- PGN analysis defaults to the final position in the first game
- Local, offline Stockfish WASM evaluation in browser
- VS Code-style dark interface with mobile-friendly layout
- Light-perspective centipawn gauge with mirrored Light/Dark score text
- Average centipawn loss (Avg CPL) for Light and Dark, with quality percent shown as `100 - loss%`
- Total CPL for Light and Dark over the full game
- Move-category totals per side shown in table format with emoji markers (`Best`, `Excellent`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`)
- Estimated skill band per side derived from ACPL heuristics
- Mate handling (`Mate in N`) with gauge pinning
- No best move, principal variation, or recommendation output shown in the UI

## Files

- `index.html` - single-page interface
- `styles.css` - VS Code-style dark theme
- `app.js` - parsing + Stockfish UCI integration
- `vendor/chess/chess.js` - local chess parser
- `vendor/stockfish/*` - local Stockfish worker + wasm
- `VERSION` - release version (currently `2.0.0`)
- `MIT_LICENSE.txt` - MIT license text for this project
- `scripts/build_release.sh` - packages a distributable zip in `dist/`

Third-party dependencies in `vendor/` retain their upstream licenses.

## Run

Serve the folder over HTTP (recommended):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in Chrome or Edge.

For packaged releases, open `Inspector_Blanque.html` in the distribution folder.

## Build a distributable zip

Run:

```bash
./scripts/build_release.sh
```

This creates:

- `dist/Inspector_Blanque_v2_0_0/` (distribution folder)
- `dist/Inspector_Blanque_v2_0_0.zip` (zip artifact)

The build script clears all prior `dist/` entries before creating the new package.

Distribution entry file:

- `Inspector_Blanque.html`

## Notes

- Works without external APIs once files are local.
- If a PGN has multiple games, only the first game is analyzed.
- Manual analyze flow: upload/paste, set depth/time, then tap **Analyze Position**.
