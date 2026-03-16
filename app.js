import { Chess, validateFen } from "./vendor/chess/chess.js";

const CP_CLAMP = 1000;
const ENGINE_PATH = "./vendor/stockfish/stockfish-18-lite-single.js";
const CATEGORY_KEYS = ["Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"];
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];
const PIECE_ASSETS = {
  P: "./vendor/pieces/cburnett/Chess_plt45.svg",
  N: "./vendor/pieces/cburnett/Chess_nlt45.svg",
  B: "./vendor/pieces/cburnett/Chess_blt45.svg",
  R: "./vendor/pieces/cburnett/Chess_rlt45.svg",
  Q: "./vendor/pieces/cburnett/Chess_qlt45.svg",
  K: "./vendor/pieces/cburnett/Chess_klt45.svg",
  p: "./vendor/pieces/cburnett/Chess_pdt45.svg",
  n: "./vendor/pieces/cburnett/Chess_ndt45.svg",
  b: "./vendor/pieces/cburnett/Chess_bdt45.svg",
  r: "./vendor/pieces/cburnett/Chess_rdt45.svg",
  q: "./vendor/pieces/cburnett/Chess_qdt45.svg",
  k: "./vendor/pieces/cburnett/Chess_kdt45.svg",
};

const elements = {
  logo: document.querySelector("#brand-logo"),
  fileInput: document.querySelector("#file-input"),
  positionText: document.querySelector("#position-text"),
  formatSelect: document.querySelector("#format-select"),
  depthInput: document.querySelector("#depth-input"),
  timeInput: document.querySelector("#time-input"),
  analyzeButton: document.querySelector("#analyze-button"),
  statusText: document.querySelector("#status-text"),
  errorText: document.querySelector("#error-text"),
  gameViewPanel: document.querySelector("#game-view-panel"),
  gameViewPosition: document.querySelector("#game-view-position"),
  gameTimeMeta: document.querySelector("#game-time-meta"),
  timeControl: document.querySelector("#time-control"),
  lightClock: document.querySelector("#light-clock"),
  darkClock: document.querySelector("#dark-clock"),
  showBestMoveButton: document.querySelector("#show-best-move-button"),
  bestMoveText: document.querySelector("#best-move-text"),
  moveCharacterization: document.querySelector("#move-characterization"),
  gameBoard: document.querySelector("#game-board"),
  moveArrowLayer: document.querySelector("#move-arrow-layer"),
  flipBoardButton: document.querySelector("#flip-board-button"),
  jumpStartButton: document.querySelector("#jump-start-button"),
  jumpEndButton: document.querySelector("#jump-end-button"),
  prevBlunderButton: document.querySelector("#prev-blunder-button"),
  prevMoveButton: document.querySelector("#prev-move-button"),
  nextMoveButton: document.querySelector("#next-move-button"),
  nextBlunderButton: document.querySelector("#next-blunder-button"),
  whiteScore: document.querySelector("#white-score"),
  whitePlayer: document.querySelector("#white-player"),
  whiteAcpl: document.querySelector("#white-acpl"),
  whiteTotalCpl: document.querySelector("#white-total-cpl"),
  whiteCatBest: document.querySelector("#white-cat-best"),
  whiteCatExcellent: document.querySelector("#white-cat-excellent"),
  whiteCatGood: document.querySelector("#white-cat-good"),
  whiteCatInaccuracy: document.querySelector("#white-cat-inaccuracy"),
  whiteCatMistake: document.querySelector("#white-cat-mistake"),
  whiteCatBlunder: document.querySelector("#white-cat-blunder"),
  whiteLevel: document.querySelector("#white-level"),
  blackScore: document.querySelector("#black-score"),
  blackPlayer: document.querySelector("#black-player"),
  blackAcpl: document.querySelector("#black-acpl"),
  blackTotalCpl: document.querySelector("#black-total-cpl"),
  blackCatBest: document.querySelector("#black-cat-best"),
  blackCatExcellent: document.querySelector("#black-cat-excellent"),
  blackCatGood: document.querySelector("#black-cat-good"),
  blackCatInaccuracy: document.querySelector("#black-cat-inaccuracy"),
  blackCatMistake: document.querySelector("#black-cat-mistake"),
  blackCatBlunder: document.querySelector("#black-cat-blunder"),
  blackLevel: document.querySelector("#black-level"),
  mateScore: document.querySelector("#mate-score"),
  needle: document.querySelector("#needle"),
};

const engineState = {
  worker: null,
  ready: false,
  initPromise: null,
  activeAnalysis: null,
  cache: new Map(),
};

const gameViewState = createEmptyGameViewState();

if (elements.logo) {
  const fallbackSources = ["./Inspector_Blanque.png"];
  elements.logo.addEventListener("error", () => {
    const nextSrc = fallbackSources.shift();
    if (nextSrc) {
      elements.logo.src = nextSrc;
      return;
    }
    elements.logo.hidden = true;
  });
}

elements.analyzeButton?.addEventListener("click", async () => {
  clearError();
  setBusy(true);
  engineState.cache.clear();

  try {
    const source = await getInputText();
    const mode = resolveFormat(source.text, source.sourceType, elements.formatSelect?.value || "auto");
    const position = mode === "fen" ? parseFen(source.text) : parsePgnGame(source.text);

    if (position.multiGameDetected) {
      setStatus("PGN has multiple games; analyzing the first game only.");
    } else {
      setStatus("Analyzing position...");
    }

    const depth = sanitizeInt(elements.depthInput?.value, 12, 8, 30);
    const moveTime = sanitizeInt(elements.timeInput?.value, 5000, 100, 120000);
    const result = await analyzePosition(position.fen, depth, moveTime);

    initializeGameView(position, result.primaryScore);
    renderAcpl(null);

    if (position.moveHistory.length) {
      setStatus("Computing game move quality...");
      const acpl = await computeAverageCentipawnLoss(position.moveHistory, depth, moveTime);
      renderAcpl(acpl);
    } else {
      setStatus("Analysis complete.");
    }

    setStatus("Analysis complete.");
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
    setStatus("Ready.");
  } finally {
    setBusy(false);
  }
});

elements.flipBoardButton?.addEventListener("click", () => {
  if (!gameViewState.timeline.length) {
    return;
  }
  gameViewState.orientation = gameViewState.orientation === "white" ? "black" : "white";
  renderCurrentGameView();
});

elements.jumpStartButton?.addEventListener("click", () => {
  if (gameViewState.currentIndex <= 0) {
    return;
  }
  gameViewState.currentIndex = 0;
  renderCurrentGameView();
});

elements.jumpEndButton?.addEventListener("click", () => {
  if (gameViewState.currentIndex >= gameViewState.timeline.length - 1) {
    return;
  }
  gameViewState.currentIndex = gameViewState.timeline.length - 1;
  renderCurrentGameView();
});

elements.prevBlunderButton?.addEventListener("click", () => {
  const targetIndex = findSeriousMoveIndex(gameViewState.currentIndex, -1);
  if (targetIndex === null) {
    return;
  }
  gameViewState.currentIndex = targetIndex;
  renderCurrentGameView();
});

elements.prevMoveButton?.addEventListener("click", () => {
  if (gameViewState.currentIndex <= 0) {
    return;
  }
  gameViewState.currentIndex -= 1;
  renderCurrentGameView();
});

elements.nextMoveButton?.addEventListener("click", () => {
  if (gameViewState.currentIndex >= gameViewState.timeline.length - 1) {
    return;
  }
  gameViewState.currentIndex += 1;
  renderCurrentGameView();
});

elements.nextBlunderButton?.addEventListener("click", () => {
  const targetIndex = findSeriousMoveIndex(gameViewState.currentIndex, 1);
  if (targetIndex === null) {
    return;
  }
  gameViewState.currentIndex = targetIndex;
  renderCurrentGameView();
});

elements.showBestMoveButton?.addEventListener("click", async () => {
  if (!gameViewState.timeline.length) {
    return;
  }

  gameViewState.bestMoveVisible = !gameViewState.bestMoveVisible;
  updateBestMoveButton();

  if (!gameViewState.bestMoveVisible) {
    renderCurrentGameView();
    return;
  }

  const entry = gameViewState.timeline[gameViewState.currentIndex];
  const fen = entry?.fen || "";
  if (!fen) {
    renderCurrentGameView();
    return;
  }

  if (!gameViewState.bestMoves.has(fen)) {
    const success = await ensureBestMoveForFen(fen);
    if (!success) {
      gameViewState.bestMoveVisible = false;
      updateBestMoveButton();
    }
  }

  renderCurrentGameView();
});

window.addEventListener("resize", () => {
  if (!gameViewState.timeline.length || !elements.gameViewPanel || elements.gameViewPanel.hidden) {
    return;
  }
  renderBoardArrows();
});

function createEmptyGameViewState() {
  return {
    mode: null,
    orientation: "white",
    timeline: [],
    currentIndex: 0,
    finalIndex: 0,
    playerMeta: { white: null, black: null },
    timeMeta: { timeControl: null, clocksByIndex: [] },
    positionScores: new Map(),
    moveCategories: new Map(),
    bestMoveVisible: false,
    bestMoves: new Map(),
  };
}

function setBusy(isBusy) {
  if (elements.analyzeButton) {
    elements.analyzeButton.disabled = isBusy;
    elements.analyzeButton.textContent = isBusy ? "Analyzing..." : "Analyze Position";
  }
}

function setStatus(text) {
  if (elements.statusText) {
    elements.statusText.textContent = text;
  }
}

function setError(text) {
  if (elements.errorText) {
    elements.errorText.textContent = text;
    elements.errorText.hidden = false;
  }
}

function clearError() {
  if (elements.errorText) {
    elements.errorText.textContent = "";
    elements.errorText.hidden = true;
  }
}

function sanitizeInt(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

async function getInputText() {
  const pasted = (elements.positionText?.value || "").trim();
  if (pasted) {
    return { text: pasted, sourceType: "paste" };
  }

  const file = elements.fileInput?.files?.[0];
  if (!file) {
    throw new Error("Provide a PGN or FEN via file upload or paste text.");
  }

  const text = (await file.text()).trim();
  if (!text) {
    throw new Error("Uploaded file is empty.");
  }

  return { text, sourceType: "file", fileName: file.name };
}

function resolveFormat(text, sourceType, selectedMode) {
  if (selectedMode === "fen" || selectedMode === "pgn") {
    return selectedMode;
  }

  const normalized = text.trim();
  const looksLikeFen = normalized.split(/\s+/).length === 6 && normalized.includes("/");
  if (looksLikeFen) {
    return "fen";
  }

  if (sourceType === "file") {
    const file = elements.fileInput?.files?.[0];
    const fileName = file?.name?.toLowerCase() || "";
    if (fileName.endsWith(".fen")) return "fen";
  }

  return "pgn";
}

function parseFen(text) {
  const fen = text.replace(/\s+/g, " ").trim();
  const validated = validateFen(fen);
  if (!validated.ok) {
    throw new Error(validated.error);
  }

  return {
    mode: "fen",
    fen,
    multiGameDetected: false,
    moveHistory: [],
    timeline: [{ fen, move: null }],
    playerMeta: { white: null, black: null },
    timeMeta: { timeControl: null, clocksByIndex: [{ white: null, black: null }] },
  };
}

function parsePgnGame(text) {
  const pgn = text.trim();
  const gameSegments = pgn.split(/\n\s*\n(?=\[Event\s)/g).filter((segment) => segment.trim());
  const chosenGame = gameSegments[0] || pgn;
  const chess = new Chess();

  try {
    chess.loadPgn(chosenGame, { strict: false });
  } catch (_error) {
    throw new Error("Invalid PGN. Verify movetext and tags are valid.");
  }

  const headers = chess.getHeaders();
  const moveHistory = chess.history({ verbose: true });
  const commentMap = new Map(chess.getComments().map((entry) => [entry.fen, entry.comment]));
  const initialFen = moveHistory[0]?.before || headers.FEN || chess.fen();
  const timeline = [{ fen: initialFen, move: null }];
  const clocksByIndex = [{ white: null, black: null }];
  let currentClocks = { white: null, black: null };

  for (const move of moveHistory) {
    timeline.push({ fen: move.after, move });
    const comment = commentMap.get(move.after) || "";
    const clockValue = parseClockFromComment(comment);
    if (clockValue) {
      currentClocks = {
        ...currentClocks,
        [move.color === "w" ? "white" : "black"]: clockValue,
      };
    }
    clocksByIndex.push({ ...currentClocks });
  }

  return {
    mode: "pgn",
    fen: chess.fen(),
    multiGameDetected: gameSegments.length > 1,
    moveHistory,
    timeline,
    playerMeta: {
      white: formatPlayerMeta(headers.White, headers.WhiteElo),
      black: formatPlayerMeta(headers.Black, headers.BlackElo),
    },
    timeMeta: {
      timeControl: typeof headers.TimeControl === "string" ? headers.TimeControl.trim() : null,
      clocksByIndex,
    },
  };
}

function formatPlayerMeta(name, rating) {
  const safeName = typeof name === "string" ? name.trim() : "";
  const safeRating = typeof rating === "string" ? rating.trim() : "";
  if (safeName && safeRating) {
    return `${safeName} (${safeRating})`;
  }
  if (safeName) {
    return safeName;
  }
  return null;
}

function initializeGameView(position, finalScore) {
  gameViewState.mode = position.mode;
  gameViewState.orientation = "white";
  gameViewState.timeline = position.timeline;
  gameViewState.currentIndex = Math.max(0, position.timeline.length - 1);
  gameViewState.finalIndex = gameViewState.currentIndex;
  gameViewState.playerMeta = position.playerMeta;
  gameViewState.timeMeta = position.timeMeta || { timeControl: null, clocksByIndex: [] };
  gameViewState.positionScores = new Map();
  gameViewState.moveCategories = new Map();
  gameViewState.bestMoveVisible = false;
  gameViewState.bestMoves = new Map();

  setPositionScore(gameViewState.finalIndex, finalScore);
  renderPlayerMeta();
  renderGameTimeMeta();
  if (elements.gameViewPanel) {
    elements.gameViewPanel.hidden = false;
  }
  renderCurrentGameView();
}

function setPositionScore(index, score) {
  if (index < 0 || index >= gameViewState.timeline.length || !score) {
    return;
  }
  gameViewState.positionScores.set(index, { kind: score.kind, value: score.value });
  if (gameViewState.currentIndex === index) {
    renderViewedEvaluation();
  }
}

function setMoveCategory(index, category) {
  if (index <= 0 || index >= gameViewState.timeline.length) {
    return;
  }
  gameViewState.moveCategories.set(index, category);
  if (gameViewState.currentIndex === index) {
    renderMoveCharacterization();
  }
}

function renderCurrentGameView() {
  renderBoard();
  renderGameViewPosition();
  renderGameTimeMeta();
  renderBestMove();
  renderMoveCharacterization();
  renderViewedEvaluation();
  updateNavigationControls();
  updateBestMoveButton();
  if (gameViewState.bestMoveVisible) {
    void ensureBestMoveForFen(gameViewState.timeline[gameViewState.currentIndex]?.fen || "");
  }
}

function renderGameViewPosition() {
  const totalPositions = gameViewState.timeline.length;
  const entry = gameViewState.timeline[gameViewState.currentIndex];
  if (!elements.gameViewPosition || !entry) {
    return;
  }

  if (!entry.move) {
    elements.gameViewPosition.textContent = totalPositions > 1 ? `Position 0/${totalPositions - 1}` : "Single position";
    return;
  }

  elements.gameViewPosition.textContent = `Position ${gameViewState.currentIndex}/${totalPositions - 1} • ${formatMoveDescriptor(
    entry.move,
    gameViewState.currentIndex,
  )}`;
}

function renderMoveCharacterization() {
  if (!elements.moveCharacterization) {
    return;
  }

  const entry = gameViewState.timeline[gameViewState.currentIndex];
  const category = gameViewState.moveCategories.get(gameViewState.currentIndex);
  if (!entry?.move || !category) {
    elements.moveCharacterization.hidden = true;
    elements.moveCharacterization.textContent = "";
    return;
  }

  elements.moveCharacterization.hidden = false;
  elements.moveCharacterization.textContent = `${formatMoveDescriptor(entry.move, gameViewState.currentIndex)}: ${category}`;
}

function renderViewedEvaluation() {
  const entry = gameViewState.timeline[gameViewState.currentIndex];
  const score = gameViewState.positionScores.get(gameViewState.currentIndex);
  if (!entry || !score) {
    renderUnavailableResult();
    return;
  }
  renderResult(score, entry.fen);
}

function renderUnavailableResult() {
  if (elements.whiteScore) elements.whiteScore.textContent = "Light: --";
  if (elements.blackScore) elements.blackScore.textContent = "Dark: --";
  if (elements.mateScore) elements.mateScore.textContent = "Mate: --";
  setNeedle(0);
}

function renderPlayerMeta() {
  setPlayerMetaText(elements.whitePlayer, gameViewState.playerMeta.white);
  setPlayerMetaText(elements.blackPlayer, gameViewState.playerMeta.black);
}

function renderGameTimeMeta() {
  const currentClocks = gameViewState.timeMeta.clocksByIndex?.[gameViewState.currentIndex] || {};
  const timeControlText = gameViewState.timeMeta.timeControl
    ? `Time Control: ${formatTimeControl(gameViewState.timeMeta.timeControl)}`
    : null;
  const lightClockText = currentClocks.white ? `Light Clock: ${currentClocks.white}` : null;
  const darkClockText = currentClocks.black ? `Dark Clock: ${currentClocks.black}` : null;
  const hasAny = Boolean(timeControlText || lightClockText || darkClockText);

  if (elements.gameTimeMeta) {
    elements.gameTimeMeta.hidden = !hasAny;
  }
  setMetaText(elements.timeControl, timeControlText);
  setMetaText(elements.lightClock, lightClockText);
  setMetaText(elements.darkClock, darkClockText);
}

function setPlayerMetaText(element, text) {
  if (!element) {
    return;
  }
  element.hidden = !text;
  element.textContent = text || "";
}

function setMetaText(element, text) {
  if (!element) {
    return;
  }
  element.hidden = !text;
  element.textContent = text || "";
}

function updateBestMoveButton() {
  if (!elements.showBestMoveButton) {
    return;
  }
  elements.showBestMoveButton.textContent = gameViewState.bestMoveVisible ? "Hide Best Move" : "Show Best Move";
}

function updateNavigationControls() {
  const hasHistory = gameViewState.timeline.length > 1;
  const previousSerious = hasHistory ? findSeriousMoveIndex(gameViewState.currentIndex, -1) : null;
  const nextSerious = hasHistory ? findSeriousMoveIndex(gameViewState.currentIndex, 1) : null;
  if (elements.jumpStartButton) {
    elements.jumpStartButton.hidden = !hasHistory;
    elements.jumpStartButton.disabled = !hasHistory || gameViewState.currentIndex <= 0;
  }
  if (elements.jumpEndButton) {
    elements.jumpEndButton.hidden = !hasHistory;
    elements.jumpEndButton.disabled = !hasHistory || gameViewState.currentIndex >= gameViewState.timeline.length - 1;
  }
  if (elements.prevBlunderButton) {
    elements.prevBlunderButton.hidden = !hasHistory;
    elements.prevBlunderButton.disabled = previousSerious === null;
  }
  if (elements.prevMoveButton) {
    elements.prevMoveButton.hidden = !hasHistory;
    elements.prevMoveButton.disabled = !hasHistory || gameViewState.currentIndex <= 0;
  }
  if (elements.nextMoveButton) {
    elements.nextMoveButton.hidden = !hasHistory;
    elements.nextMoveButton.disabled =
      !hasHistory || gameViewState.currentIndex >= gameViewState.timeline.length - 1;
  }
  if (elements.nextBlunderButton) {
    elements.nextBlunderButton.hidden = !hasHistory;
    elements.nextBlunderButton.disabled = nextSerious === null;
  }
}

function renderBoard() {
  if (!elements.gameBoard) {
    return;
  }

  const entry = gameViewState.timeline[gameViewState.currentIndex];
  if (!entry) {
    elements.gameBoard.innerHTML = "";
    return;
  }

  const boardMap = parseFenBoard(entry.fen);
  const files = gameViewState.orientation === "white" ? FILES : [...FILES].reverse();
  const ranks = gameViewState.orientation === "white" ? RANKS : [...RANKS].reverse();

  elements.gameBoard.innerHTML = "";
  for (const rank of ranks) {
    for (const file of files) {
      const square = `${file}${rank}`;
      const squareElement = document.createElement("div");
      const fileIndex = FILES.indexOf(file);
      const rankIndex = RANKS.indexOf(rank);
      const isLight = (fileIndex + rankIndex) % 2 === 0;
      squareElement.className = `board-square ${isLight ? "light" : "dark"}`;
      squareElement.setAttribute("data-square", square);

      const piece = boardMap.get(square);
      if (piece) {
        const pieceElement = document.createElement("img");
        pieceElement.className = "board-piece";
        pieceElement.src = PIECE_ASSETS[piece] || "";
        pieceElement.alt = describePiece(piece);
        pieceElement.draggable = false;
        squareElement.appendChild(pieceElement);
      }

      const isBottomRank = rank === ranks[ranks.length - 1];
      const isLeftFile = file === files[0];
      if (isBottomRank || isLeftFile) {
        const label = document.createElement("span");
        label.className = "square-label";
        if (isBottomRank) {
          label.textContent = file;
        }
        if (isLeftFile) {
          label.textContent = label.textContent ? `${label.textContent} ${rank}` : String(rank);
        }
        squareElement.appendChild(label);
      }

      elements.gameBoard.appendChild(squareElement);
    }
  }

  renderBoardArrows();
}

function parseFenBoard(fen) {
  const board = new Map();
  const rows = (fen.split(" ")[0] || "").split("/");
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let fileIndex = 0;
    for (const char of rows[rowIndex]) {
      const emptyCount = Number.parseInt(char, 10);
      if (!Number.isNaN(emptyCount)) {
        fileIndex += emptyCount;
        continue;
      }
      const square = `${FILES[fileIndex]}${8 - rowIndex}`;
      board.set(square, char);
      fileIndex += 1;
    }
  }
  return board;
}

function describePiece(piece) {
  const color = piece === piece.toUpperCase() ? "white" : "black";
  const name = {
    p: "pawn",
    n: "knight",
    b: "bishop",
    r: "rook",
    q: "queen",
    k: "king",
  }[piece.toLowerCase()];
  return `${color} ${name}`;
}

function formatMoveDescriptor(move, positionIndex) {
  const moveNumber = Math.ceil(positionIndex / 2);
  const prefix = move.color === "b" ? `${moveNumber}...` : `${moveNumber}.`;
  return `${prefix} ${move.san}`;
}

function findSeriousMoveIndex(startIndex, direction) {
  for (
    let index = startIndex + direction;
    index >= 1 && index < gameViewState.timeline.length;
    index += direction
  ) {
    const category = gameViewState.moveCategories.get(index);
    if (category === "Mistake" || category === "Blunder") {
      return index;
    }
  }
  return null;
}

function renderBoardArrows() {
  if (!elements.moveArrowLayer) {
    return;
  }

  const width = elements.gameBoard?.clientWidth || 0;
  if (!width) {
    elements.moveArrowLayer.innerHTML = "";
    return;
  }

  const overlays = [];
  const currentMoveOverlay = buildArrowOverlay(
    gameViewState.timeline[gameViewState.currentIndex]?.move,
    gameViewState.orientation,
    width,
    {
      markerId: "move-arrow-head",
      markerFill: "rgba(80, 220, 255, 0.9)",
      circleFill: "rgba(255, 212, 59, 0.22)",
      stroke: "rgba(80, 220, 255, 0.9)",
      strokeWidth: (squareSize) => Math.max(2.5, squareSize * 0.055),
      circleRadius: (squareSize) => Math.max(5, squareSize * 0.1),
    },
  );
  if (currentMoveOverlay) {
    overlays.push(currentMoveOverlay);
  }

  if (gameViewState.bestMoveVisible) {
    const bestMove = gameViewState.bestMoves.get(gameViewState.timeline[gameViewState.currentIndex]?.fen || "");
    const bestMoveOverlay = buildArrowOverlay(bestMove, gameViewState.orientation, width, {
      markerId: "best-move-arrow-head",
      markerFill: "rgba(103, 232, 130, 0.95)",
      circleFill: "rgba(103, 232, 130, 0.18)",
      stroke: "rgba(103, 232, 130, 0.92)",
      strokeWidth: (squareSize) => Math.max(3, squareSize * 0.06),
      circleRadius: (squareSize) => Math.max(6, squareSize * 0.11),
    });
    if (bestMoveOverlay) {
      overlays.push(bestMoveOverlay);
    }
  }

  elements.moveArrowLayer.setAttribute("viewBox", `0 0 ${width} ${width}`);
  elements.moveArrowLayer.innerHTML = overlays.join("");
}

function buildArrowOverlay(moveLike, orientation, width, palette) {
  if (!moveLike?.from || !moveLike?.to) {
    return "";
  }

  const squareSize = width / 8;
  const fromPoint = getSquareCenter(moveLike.from, squareSize, orientation);
  const toPoint = getSquareCenter(moveLike.to, squareSize, orientation);
  if (!fromPoint || !toPoint) {
    return "";
  }

  return `
    <defs>
      <marker id="${palette.markerId}" markerWidth="8" markerHeight="8" refX="6.4" refY="4" orient="auto">
        <path d="M 0 0 L 8 4 L 0 8 z" fill="${palette.markerFill}"></path>
      </marker>
    </defs>
    <circle cx="${fromPoint.x}" cy="${fromPoint.y}" r="${palette.circleRadius(squareSize)}" fill="${palette.circleFill}"></circle>
    <line
      x1="${fromPoint.x}"
      y1="${fromPoint.y}"
      x2="${toPoint.x}"
      y2="${toPoint.y}"
      stroke="${palette.stroke}"
      stroke-width="${palette.strokeWidth(squareSize)}"
      stroke-linecap="round"
      marker-end="url(#${palette.markerId})"
    ></line>
  `;
}

function getSquareCenter(square, squareSize, orientation) {
  const file = square[0];
  const rank = Number.parseInt(square[1], 10);
  const fileIndex = FILES.indexOf(file);
  if (fileIndex < 0 || Number.isNaN(rank)) {
    return null;
  }

  const displayFileIndex = orientation === "white" ? fileIndex : 7 - fileIndex;
  const displayRankIndex = orientation === "white" ? 8 - rank : rank - 1;

  return {
    x: displayFileIndex * squareSize + squareSize / 2,
    y: displayRankIndex * squareSize + squareSize / 2,
  };
}

function parseClockFromComment(comment) {
  const match = comment.match(/\[%clk\s+([0-9:.]+)\]/i);
  return match ? match[1].trim() : null;
}

function formatTimeControl(rawValue) {
  if (!rawValue || rawValue === "-") {
    return null;
  }

  const segments = rawValue.split(":").map((segment) => segment.trim()).filter(Boolean);
  return segments
    .map((segment) => {
      const [base, increment] = segment.split("+");
      const baseSeconds = Number.parseInt(base, 10);
      const incrementSeconds = Number.parseInt(increment || "0", 10);
      if (Number.isNaN(baseSeconds)) {
        return segment;
      }
      const minutes = Math.floor(baseSeconds / 60);
      const seconds = baseSeconds % 60;
      const baseLabel = seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
      return increment
        ? `${baseLabel} + ${Number.isNaN(incrementSeconds) ? increment : `${incrementSeconds}s`}`
        : baseLabel;
    })
    .join(", then ");
}

function renderBestMove() {
  if (!elements.bestMoveText) {
    return;
  }

  if (!gameViewState.bestMoveVisible) {
    elements.bestMoveText.hidden = true;
    elements.bestMoveText.textContent = "";
    return;
  }

  const bestMove = gameViewState.bestMoves.get(gameViewState.timeline[gameViewState.currentIndex]?.fen || "");
  elements.bestMoveText.hidden = false;
  elements.bestMoveText.textContent = bestMove?.san ? `Best move: ${bestMove.san}` : "Best move: calculating...";
}

function deriveBestMoveDetails(fen, bestMoveUci) {
  if (!bestMoveUci || bestMoveUci === "(none)") {
    return null;
  }

  const normalized = bestMoveUci.trim();
  if (!/^[a-h][1-8][a-h][1-8][nbrq]?$/i.test(normalized)) {
    return null;
  }

  const chess = new Chess();
  chess.load(fen);
  const move = chess.move({
    from: normalized.slice(0, 2),
    to: normalized.slice(2, 4),
    promotion: normalized[4] ? normalized[4].toLowerCase() : undefined,
  });
  if (!move) {
    return null;
  }

  return {
    from: move.from,
    to: move.to,
    san: move.san,
    uci: normalized,
  };
}

async function ensureBestMoveForFen(fen) {
  if (!fen || gameViewState.bestMoves.has(fen)) {
    return true;
  }

  const depth = sanitizeInt(elements.depthInput?.value, 12, 8, 30);
  const moveTime = sanitizeInt(elements.timeInput?.value, 5000, 100, 120000);
  const priorStatus = elements.statusText?.textContent || "Ready.";
  setStatus("Computing best move...");
  try {
    const bestMoveResult = await analyzePosition(fen, depth, moveTime, { includeBestMove: true });
    gameViewState.bestMoves.set(fen, deriveBestMoveDetails(fen, bestMoveResult.bestMoveUci));
    if (gameViewState.bestMoveVisible) {
      renderCurrentGameView();
    }
    return true;
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    setStatus(priorStatus);
  }
}

function renderResult(result, fen) {
  const sideToMove = fen.split(/\s+/)[1] || "w";

  if (result.kind === "cp") {
    const whiteCp = sideToMove === "w" ? result.value : -result.value;
    const blackCp = -whiteCp;

    if (elements.whiteScore) elements.whiteScore.textContent = `Light: ${formatCp(whiteCp)}`;
    if (elements.blackScore) elements.blackScore.textContent = `Dark: ${formatCp(blackCp)}`;
    if (elements.mateScore) elements.mateScore.textContent = "Mate: --";

    setNeedle(whiteCp);
    return;
  }

  const winner = inferMateWinner(sideToMove, result.value);
  const matePly = Math.abs(result.value);

  if (winner === "w") {
    if (elements.whiteScore) elements.whiteScore.textContent = `Light: Mate in ${matePly}`;
    if (elements.blackScore) elements.blackScore.textContent = `Dark: Mated in ${matePly}`;
    if (elements.mateScore) elements.mateScore.textContent = `Mate: Light in ${matePly}`;
    setNeedle(CP_CLAMP);
  } else {
    if (elements.whiteScore) elements.whiteScore.textContent = `Light: Mated in ${matePly}`;
    if (elements.blackScore) elements.blackScore.textContent = `Dark: Mate in ${matePly}`;
    if (elements.mateScore) elements.mateScore.textContent = `Mate: Dark in ${matePly}`;
    setNeedle(-CP_CLAMP);
  }
}

function renderAcpl(acpl) {
  if (!acpl) {
    if (elements.whiteAcpl) elements.whiteAcpl.textContent = "Avg CPL: N/A";
    if (elements.blackAcpl) elements.blackAcpl.textContent = "Avg CPL: N/A";
    if (elements.whiteTotalCpl) elements.whiteTotalCpl.textContent = "Total CPL: N/A";
    if (elements.blackTotalCpl) elements.blackTotalCpl.textContent = "Total CPL: N/A";
    setCategoryCounts("white", null);
    setCategoryCounts("black", null);
    if (elements.whiteLevel) elements.whiteLevel.textContent = "Estimated Level: N/A";
    if (elements.blackLevel) elements.blackLevel.textContent = "Estimated Level: N/A";
    return;
  }

  if (elements.whiteAcpl) {
    elements.whiteAcpl.textContent = `Avg CPL: ${acpl.light.avg.toFixed(1)} (${acpl.light.quality.toFixed(1)}%)`;
  }
  if (elements.blackAcpl) {
    elements.blackAcpl.textContent = `Avg CPL: ${acpl.dark.avg.toFixed(1)} (${acpl.dark.quality.toFixed(1)}%)`;
  }
  if (elements.whiteTotalCpl) {
    elements.whiteTotalCpl.textContent = `Total CPL: ${acpl.light.total.toFixed(0)}`;
  }
  if (elements.blackTotalCpl) {
    elements.blackTotalCpl.textContent = `Total CPL: ${acpl.dark.total.toFixed(0)}`;
  }
  setCategoryCounts("white", acpl.light.categories);
  setCategoryCounts("black", acpl.dark.categories);
  if (elements.whiteLevel) {
    elements.whiteLevel.textContent = `Estimated Level: ${estimateEloBand(acpl.light.avg)}`;
  }
  if (elements.blackLevel) {
    elements.blackLevel.textContent = `Estimated Level: ${estimateEloBand(acpl.dark.avg)}`;
  }
}

function inferMateWinner(sideToMove, mateValue) {
  const stmWins = mateValue > 0;
  if (stmWins) {
    return sideToMove;
  }
  return sideToMove === "w" ? "b" : "w";
}

function formatCp(value) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value} cp`;
}

function setNeedle(whiteCp) {
  const clamped = Math.max(-CP_CLAMP, Math.min(CP_CLAMP, whiteCp));
  const angle = (clamped / CP_CLAMP) * 90;
  if (elements.needle) {
    elements.needle.style.transform = `rotate(${angle}deg)`;
  }
}

function scoreToCpEquivalent(score) {
  if (score.kind === "cp") {
    return score.value;
  }
  return score.value >= 0 ? CP_CLAMP : -CP_CLAMP;
}

function estimateEloBand(avgCpl) {
  if (avgCpl <= 15) return "~2200+";
  if (avgCpl <= 25) return "~1900-2200";
  if (avgCpl <= 40) return "~1600-1900";
  if (avgCpl <= 60) return "~1300-1600";
  if (avgCpl <= 85) return "~1000-1300";
  return "<1000";
}

function getPhaseThresholds(phase) {
  if (phase === "opening") {
    return [12, 30, 60, 100, 180];
  }
  if (phase === "endgame") {
    return [10, 25, 50, 90, 170];
  }
  return [15, 35, 70, 120, 220];
}

function classifyMoveLoss(loss, phase = "middlegame") {
  const [bestMax, excellentMax, goodMax, inaccuracyMax, mistakeMax] = getPhaseThresholds(phase);
  if (loss <= bestMax) return "Best";
  if (loss <= excellentMax) return "Excellent";
  if (loss <= goodMax) return "Good";
  if (loss <= inaccuracyMax) return "Inaccuracy";
  if (loss <= mistakeMax) return "Mistake";
  return "Blunder";
}

function cpToWinProbability(cp) {
  return 1 / (1 + Math.exp(-cp / 120));
}

function categoryToRank(category) {
  return {
    Best: 0,
    Excellent: 1,
    Good: 2,
    Inaccuracy: 3,
    Mistake: 4,
    Blunder: 5,
  }[category];
}

function rankToCategory(rank) {
  return ["Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"][Math.max(0, Math.min(5, rank))];
}

function classifyMoveWithProbability(probLoss, cplLoss, phase = "middlegame") {
  const phaseScale = phase === "opening" ? 1.1 : phase === "endgame" ? 0.9 : 1;
  const thresholds = [0.01, 0.03, 0.07, 0.14, 0.25].map((value) => value * phaseScale);
  let probCategory = "Blunder";
  if (probLoss <= thresholds[0]) probCategory = "Best";
  else if (probLoss <= thresholds[1]) probCategory = "Excellent";
  else if (probLoss <= thresholds[2]) probCategory = "Good";
  else if (probLoss <= thresholds[3]) probCategory = "Inaccuracy";
  else if (probLoss <= thresholds[4]) probCategory = "Mistake";

  const cplCategory = classifyMoveLoss(cplLoss, phase);
  const nearProbabilityBoundary = thresholds.some((boundary) => Math.abs(probLoss - boundary) <= 0.005);
  if (nearProbabilityBoundary) {
    return rankToCategory(Math.max(categoryToRank(probCategory), categoryToRank(cplCategory)));
  }
  return probCategory;
}

function isNearCategoryBoundary(loss, phase = "middlegame", margin = 10) {
  const boundaries = getPhaseThresholds(phase);
  return boundaries.some((boundary) => Math.abs(loss - boundary) <= margin);
}

function materialScoreFromFen(fen) {
  const board = fen.split(" ")[0] || "";
  const pieceValues = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };
  let total = 0;
  for (const char of board) {
    const piece = char.toLowerCase();
    if (pieceValues[piece] !== undefined) {
      total += pieceValues[piece];
    }
  }
  return total;
}

function detectGamePhase(move, plyIndex) {
  const totalMaterial = materialScoreFromFen(move.before);
  if (plyIndex < 20 && totalMaterial > 46) {
    return "opening";
  }
  if (totalMaterial <= 20) {
    return "endgame";
  }
  return "middlegame";
}

function createCategoryBucket() {
  return {
    Best: 0,
    Excellent: 0,
    Good: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Blunder: 0,
  };
}

function setCategoryCounts(side, categories) {
  const sidePrefix = side === "white" ? "whiteCat" : "blackCat";
  for (const key of CATEGORY_KEYS) {
    const cell = elements[`${sidePrefix}${key}`];
    if (cell) {
      cell.textContent = categories ? String(categories[key]) : "N/A";
    }
  }
}

function applyMateOverride(bestScore, playedScore, fallbackCategory) {
  const bestIsMate = bestScore?.kind === "mate";
  const playedIsMate = playedScore?.kind === "mate";
  const bestWinningMate = bestIsMate && bestScore.value > 0;
  const bestLosingMate = bestIsMate && bestScore.value < 0;
  const playedWinningMate = playedIsMate && playedScore.value > 0;
  const playedLosingMate = playedIsMate && playedScore.value < 0;

  if (playedLosingMate && !bestLosingMate) {
    return "Blunder";
  }
  if (playedWinningMate) {
    return "Best";
  }
  if (bestWinningMate && playedWinningMate) {
    return "Best";
  }
  if (bestWinningMate && playedScore?.kind === "cp" && playedScore.value >= 400) {
    return "Excellent";
  }
  return fallbackCategory;
}

function isMateForcedOutcome(bestScore, playedScore) {
  const bestIsMate = bestScore?.kind === "mate";
  const playedIsMate = playedScore?.kind === "mate";
  const bestWinningMate = bestIsMate && bestScore.value > 0;
  const bestLosingMate = bestIsMate && bestScore.value < 0;
  const playedWinningMate = playedIsMate && playedScore.value > 0;
  const playedLosingMate = playedIsMate && playedScore.value < 0;
  return (playedLosingMate && !bestLosingMate) || playedWinningMate || (bestWinningMate && playedWinningMate);
}

function getPvSpreadCp(pvScores) {
  if (!pvScores || pvScores.length < 2) {
    return 999;
  }
  const best = scoreToCpEquivalent(pvScores[0]);
  const second = scoreToCpEquivalent(pvScores[1]);
  return Math.abs(best - second);
}

function adjustCategoryForConfidence(category, context) {
  const { pvSpreadCp, volatilityCp, recheckDeltaCp, mateForced } = context;
  if (mateForced) {
    return category;
  }

  const lowConfidence = pvSpreadCp < 40 || (recheckDeltaCp !== null && recheckDeltaCp > 50);
  const veryLowConfidence = pvSpreadCp < 15 && (recheckDeltaCp !== null && recheckDeltaCp > 80);
  const highVolatility = volatilityCp > 180;

  let rank = categoryToRank(category);
  if (lowConfidence && highVolatility && rank >= categoryToRank("Inaccuracy")) {
    rank -= 1;
  }
  if (veryLowConfidence && rank >= categoryToRank("Mistake")) {
    rank -= 1;
  }
  return rankToCategory(rank);
}

async function computeAverageCentipawnLoss(moveHistory, depth, moveTime) {
  const totals = {
    w: { loss: 0, count: 0, categories: createCategoryBucket() },
    b: { loss: 0, count: 0, categories: createCategoryBucket() },
  };

  for (let i = 0; i < moveHistory.length; i += 1) {
    const move = moveHistory[i];
    if (!move?.before || !move?.after || !move?.color) {
      continue;
    }

    setStatus(`Computing game move quality... (${i + 1}/${moveHistory.length})`);

    let positionScore = null;
    const bestAnalysis = await analyzePosition(move.before, depth, moveTime, { multiPv: 3 });
    positionScore = bestAnalysis.primaryScore;

    const playedMoveUci = toUciMove(move);
    const playedAnalysis = playedMoveUci
      ? await analyzePosition(move.before, depth, moveTime, { searchMoveUci: playedMoveUci, multiPv: 1 })
      : null;

    let bestCpForMover = scoreToCpEquivalent(bestAnalysis.primaryScore);
    let playedCpForMover = playedAnalysis ? scoreToCpEquivalent(playedAnalysis.primaryScore) : bestCpForMover;
    const phase = detectGamePhase(move, i);
    let loss = Math.max(0, bestCpForMover - playedCpForMover);
    const bestProbForMover = cpToWinProbability(bestCpForMover);
    const playedProbForMover = cpToWinProbability(playedCpForMover);
    let category = classifyMoveWithProbability(
      Math.max(0, bestProbForMover - playedProbForMover),
      loss,
      phase,
    );
    category = applyMateOverride(bestAnalysis.primaryScore, playedAnalysis?.primaryScore, category);
    const mateForced = isMateForcedOutcome(bestAnalysis.primaryScore, playedAnalysis?.primaryScore);
    const pvSpreadCp = getPvSpreadCp(bestAnalysis.pvScores);
    const volatilityCp = Math.abs(bestCpForMover - playedCpForMover);
    let recheckDeltaCp = null;

    if (isNearCategoryBoundary(loss, phase) && playedMoveUci) {
      const initialLoss = loss;
      const deeperDepth = Math.min(30, depth + 2);
      const deeperTime = Math.min(120000, Math.floor(moveTime * 1.5));
      const bestRecheck = await analyzePosition(move.before, deeperDepth, deeperTime, { multiPv: 3 });
      const playedRecheck = await analyzePosition(move.before, deeperDepth, deeperTime, {
        searchMoveUci: playedMoveUci,
        multiPv: 1,
      });
      positionScore = bestRecheck.primaryScore;
      bestCpForMover = scoreToCpEquivalent(bestRecheck.primaryScore);
      playedCpForMover = scoreToCpEquivalent(playedRecheck.primaryScore);
      loss = Math.max(0, bestCpForMover - playedCpForMover);
      const bestProbForMoverRecheck = cpToWinProbability(bestCpForMover);
      const playedProbForMoverRecheck = cpToWinProbability(playedCpForMover);
      category = classifyMoveWithProbability(
        Math.max(0, bestProbForMoverRecheck - playedProbForMoverRecheck),
        loss,
        phase,
      );
      category = applyMateOverride(bestRecheck.primaryScore, playedRecheck.primaryScore, category);
      recheckDeltaCp = Math.abs(initialLoss - loss);
    }

    category = adjustCategoryForConfidence(category, {
      pvSpreadCp,
      volatilityCp,
      recheckDeltaCp,
      mateForced,
    });

    setPositionScore(i, positionScore);
    setMoveCategory(i + 1, category);

    totals[move.color].loss += loss;
    totals[move.color].count += 1;
    totals[move.color].categories[category] += 1;
  }

  const lightAvg = totals.w.count ? totals.w.loss / totals.w.count : 0;
  const darkAvg = totals.b.count ? totals.b.loss / totals.b.count : 0;
  const lightLossPercent = (lightAvg / CP_CLAMP) * 100;
  const darkLossPercent = (darkAvg / CP_CLAMP) * 100;

  return {
    light: {
      avg: lightAvg,
      total: totals.w.loss,
      quality: Math.max(0, 100 - lightLossPercent),
      categories: totals.w.categories,
    },
    dark: {
      avg: darkAvg,
      total: totals.b.loss,
      quality: Math.max(0, 100 - darkLossPercent),
      categories: totals.b.categories,
    },
  };
}

async function ensureEngineReady() {
  if (engineState.ready) {
    return;
  }

  if (engineState.initPromise) {
    return engineState.initPromise;
  }

  engineState.initPromise = new Promise((resolve, reject) => {
    try {
      engineState.worker = new Worker(ENGINE_PATH);
    } catch (error) {
      reject(new Error(`Failed to start Stockfish worker: ${String(error)}`));
      return;
    }

    let sawUciOk = false;
    let sawReadyOk = false;

    engineState.worker.addEventListener("error", () => {
      reject(new Error("Stockfish worker failed to load."));
    });

    engineState.worker.addEventListener("message", (event) => {
      const line = String(event.data || "");
      if (!engineState.ready) {
        if (line.includes("uciok")) {
          sawUciOk = true;
          engineState.worker?.postMessage("isready");
        }

        if (line.includes("readyok")) {
          sawReadyOk = true;
        }

        if (sawUciOk && sawReadyOk) {
          engineState.ready = true;
          resolve();
          return;
        }
      }

      handleEngineLine(line);
    });

    engineState.worker.postMessage("uci");
  });

  return engineState.initPromise;
}

function toUciMove(move) {
  if (!move?.from || !move?.to) {
    return null;
  }
  return `${move.from}${move.to}${move.promotion ? move.promotion : ""}`;
}

async function analyzePosition(fen, depth, moveTime, options = {}) {
  await ensureEngineReady();

  if (!engineState.worker || !engineState.ready) {
    throw new Error("Stockfish engine is not ready.");
  }

  if (engineState.activeAnalysis) {
    throw new Error("Analysis is already in progress.");
  }

  const multiPv = Math.max(1, Number.parseInt(String(options.multiPv ?? 1), 10) || 1);
  const searchMoveUci = options.searchMoveUci || null;
  const includeBestMove = Boolean(options.includeBestMove);
  const cacheKey = `${fen}|d${depth}|t${moveTime}|mpv${multiPv}|sm:${searchMoveUci || "-"}|bm:${includeBestMove ? 1 : 0}`;
  if (engineState.cache.has(cacheKey)) {
    return engineState.cache.get(cacheKey);
  }

  return new Promise((resolve, reject) => {
    const timeoutMs = Math.max(3000, moveTime + 15000);
    const timeout = setTimeout(() => {
      engineState.activeAnalysis = null;
      reject(new Error("Analysis timed out."));
    }, timeoutMs);

    engineState.activeAnalysis = {
      resolve: (score) => {
        clearTimeout(timeout);
        resolve(score);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
      lastScore: null,
      pvScores: new Map(),
      fen,
      depth,
      moveTime,
      multiPv,
      searchMoveUci,
      includeBestMove,
    };

    engineState.worker.postMessage(`setoption name MultiPV value ${multiPv}`);
    engineState.worker.postMessage("ucinewgame");
    engineState.worker.postMessage(`position fen ${fen}`);
    let goCommand = `go depth ${depth} movetime ${moveTime}`;
    if (searchMoveUci) {
      goCommand += ` searchmoves ${searchMoveUci}`;
    }
    engineState.worker.postMessage(goCommand);
  });
}

function handleEngineLine(line) {
  const analysis = engineState.activeAnalysis;
  if (!analysis) {
    return;
  }

  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (scoreMatch) {
    const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
    const multipv = multipvMatch ? Number.parseInt(multipvMatch[1], 10) : 1;
    const parsedScore = {
      kind: scoreMatch[1],
      value: Number.parseInt(scoreMatch[2], 10),
    };
    analysis.pvScores.set(multipv, parsedScore);
    if (multipv === 1) {
      analysis.lastScore = parsedScore;
    }
    return;
  }

  if (line.startsWith("bestmove")) {
    const finalScore = analysis.lastScore;
    engineState.activeAnalysis = null;

    if (!finalScore || Number.isNaN(finalScore.value)) {
      analysis.reject(new Error("Engine did not return a valid score."));
      return;
    }

    const bestMoveMatch = line.match(/^bestmove\s+(\S+)/);

    const result = {
      primaryScore: finalScore,
      pvScores: Array.from(analysis.pvScores.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]),
      bestMoveUci: bestMoveMatch ? bestMoveMatch[1] : null,
    };
    engineState.cache.set(
      `${analysis.fen}|d${analysis.depth}|t${analysis.moveTime}|mpv${analysis.multiPv}|sm:${analysis.searchMoveUci || "-"}|bm:${analysis.includeBestMove ? 1 : 0}`,
      result,
    );
    analysis.resolve(result);
  }
}

setNeedle(0);
renderAcpl(null);
renderPlayerMeta();
renderGameTimeMeta();
updateNavigationControls();
setStatus("Ready.");
