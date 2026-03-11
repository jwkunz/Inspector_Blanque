import { Chess, validateFen } from "./vendor/chess/chess.js";

const CP_CLAMP = 1000;
const ENGINE_PATH = "./vendor/stockfish/stockfish-18-lite-single.js";
const CATEGORY_KEYS = ["Best", "Excellent", "Good", "Inaccuracy", "Mistake", "Blunder"];

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
  whiteScore: document.querySelector("#white-score"),
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
};

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

  try {
    const source = await getInputText();
    const mode = resolveFormat(source.text, source.sourceType, elements.formatSelect?.value || "auto");
    const position = mode === "fen" ? parseFen(source.text) : parsePgnFinalFen(source.text);

    if (position.multiGameDetected) {
      setStatus("PGN has multiple games; analyzing the first game only.");
    } else {
      setStatus("Analyzing position...");
    }

    const depth = sanitizeInt(elements.depthInput?.value, 18, 8, 30);
    const moveTime = sanitizeInt(elements.timeInput?.value, 5000, 100, 120000);

    const result = await analyzePosition(position.fen, depth, moveTime);
    renderResult(result.primaryScore, position.fen);

    if (position.moveHistory?.length) {
      setStatus("Computing game move quality...");
      const acpl = await computeAverageCentipawnLoss(position.moveHistory, depth, moveTime);
      renderAcpl(acpl);
    } else {
      renderAcpl(null);
    }

    setStatus("Analysis complete.");
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
    setStatus("Ready.");
  } finally {
    setBusy(false);
  }
});

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

  return { fen, multiGameDetected: false, moveHistory: null };
}

function parsePgnFinalFen(text) {
  const pgn = text.trim();
  const gameSegments = pgn.split(/\n\s*\n(?=\[Event\s)/g).filter((segment) => segment.trim());
  const chosenGame = gameSegments[0] || pgn;

  const chess = new Chess();

  try {
    chess.loadPgn(chosenGame, { strict: false });
  } catch (_error) {
    throw new Error("Invalid PGN. Verify movetext and tags are valid.");
  }

  return {
    fen: chess.fen(),
    multiGameDetected: gameSegments.length > 1,
    moveHistory: chess.history({ verbose: true }),
  };
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

function classifyMoveLoss(loss) {
  if (loss <= 15) return "Best";
  if (loss <= 35) return "Excellent";
  if (loss <= 70) return "Good";
  if (loss <= 120) return "Inaccuracy";
  if (loss <= 220) return "Mistake";
  return "Blunder";
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

    const bestAnalysis = await analyzePosition(move.before, depth, moveTime, { multiPv: 3 });
    const playedMoveUci = toUciMove(move);
    const playedAnalysis = playedMoveUci
      ? await analyzePosition(move.before, depth, moveTime, { searchMoveUci: playedMoveUci, multiPv: 1 })
      : null;

    const bestCpForMover = scoreToCpEquivalent(bestAnalysis.primaryScore);
    const playedCpForMover = playedAnalysis
      ? scoreToCpEquivalent(playedAnalysis.primaryScore)
      : bestCpForMover;
    const loss = Math.max(0, bestCpForMover - playedCpForMover);
    const category = classifyMoveLoss(loss);

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

    analysis.resolve({
      primaryScore: finalScore,
      pvScores: Array.from(analysis.pvScores.entries())
        .sort((a, b) => a[0] - b[0])
        .map((entry) => entry[1]),
    });
  }
}

setNeedle(0);
renderAcpl(null);
setStatus("Ready.");
