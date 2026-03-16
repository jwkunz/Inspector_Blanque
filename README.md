# Inspector Blanque

Mobile-first standalone web app for evaluating chess positions with a local Stockfish WASM engine.

## Features

- Upload or paste PGN/FEN input
- PGN analysis defaults to the final position in the first game
- Local, offline Stockfish WASM evaluation in browser
- VS Code-style dark interface with mobile-friendly layout
- Game View panel with a navigable chessboard and board-flip control
- Higher-quality local SVG chess piece sprites in Game View
- On-demand best-move reveal in Game View with green arrow overlay and SAN text
- Light-perspective centipawn gauge with mirrored Light/Dark score text
- Needle and score display stay in sync with the currently viewed board position
- PGN time control and clock annotations shown in Game View when available
- Average centipawn loss (Avg CPL) for Light and Dark, with quality percent shown as `100 - loss%`
- Total CPL for Light and Dark over the full game
- PGN player names and ratings shown in the Dark and Light summary cards when available
- Move-category totals per side shown in table format with emoji markers (`Best`, `Excellent`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`)
- MultiPV-backed move grading using best-move gap comparisons
- Borderline-move depth rechecks with in-run evaluation caching for more stable labels
- Phase-aware category thresholds (opening, middlegame, endgame)
- Mate-aware category overrides for forced-mate transitions
- Win-probability swing as primary move-grade signal with CPL tie-breaks
- Confidence-aware label softening using MultiPV spread, volatility, and recheck stability
- Estimated skill band per side derived from ACPL heuristics
- Mate handling (`Mate in N`) with gauge pinning
- No best move is shown by default; principal variation lines and broader recommendation output remain hidden

## Files

- `index.html` - single-page interface
- `styles.css` - VS Code-style dark theme
- `app.js` - parsing + Stockfish UCI integration
- `vendor/chess/chess.js` - local chess parser
- `vendor/pieces/*` - local chess piece SVG assets + attribution
- `vendor/stockfish/*` - local Stockfish worker + wasm
- `VERSION` - release version (currently `3.2.0`)
- `MIT_LICENSE.txt` - MIT license text for this project
- `scripts/build_release.sh` - packages a distributable zip in `dist/`

Third-party dependencies in `vendor/` retain their upstream licenses.
The chess piece SVGs in `vendor/pieces/` are by Colin M. L. Burnett under CC BY-SA 3.0.

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

- `dist/Inspector_Blanque_v3_2_0/` (distribution folder)
- `dist/Inspector_Blanque_v3_2_0.zip` (zip artifact)

The build script clears all prior `dist/` entries before creating the new package.

Distribution entry file:

- `Inspector_Blanque.html`

## Notes

- Works without external APIs once files are local.
- If a PGN has multiple games, only the first game is analyzed.
- Manual analyze flow: upload/paste, set depth/time, then tap **Analyze Position**.
- When a PGN is analyzed, Game View opens on the latest move and lets you step through the game one ply at a time.
- The move-characterization banner appears for viewed moves as grading data becomes available.
- If the PGN includes `TimeControl` or `[%clk ...]` comments, Game View shows that timing data near the top.
- Tapping `Show Best Move` reveals the engine best move for the currently viewed position and keeps it in sync while browsing.
