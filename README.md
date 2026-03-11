# Inspector Blanque

Mobile-first standalone web app for evaluating chess positions with a local Stockfish WASM engine.

## Features

- Upload or paste PGN/FEN input
- PGN analysis defaults to the final position in the first game
- Local, offline Stockfish WASM evaluation in browser
- White-perspective centipawn gauge with mirrored White/Black score text
- Mate handling (`Mate in N`) with gauge pinning
- No best move, principal variation, or recommendation output shown in the UI

## Files

- `index.html` - single-page interface
- `styles.css` - mobile-first wood + green theme
- `app.js` - parsing + Stockfish UCI integration
- `vendor/chess/chess.js` - local chess parser
- `vendor/stockfish/*` - local Stockfish worker + wasm

## Run

Serve the folder over HTTP (recommended):

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in Chrome or Edge.

## Notes

- Works without external APIs once files are local.
- If a PGN has multiple games, only the first game is analyzed.
- Manual analyze flow: upload/paste, set depth/time, then tap **Analyze Position**.
