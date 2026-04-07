// WORD DROP / WORD TETRIS
// 9 columns x 12 rows
// Swipe left/right/down on phone
// Valid words clear, flash briefly, then tiles fall
// Combo scoring on cascades: x2, x3, x4 etc.

const COLS = 9;
const ROWS = 12;

const START_FALL_MS = 800;
const SPEED_UP_EVERY_MS = 60000;
const SPEED_STEP_MS = 100;
const MIN_FALL_MS = 150;

const LETTERS =
  "EEEEEEEEEEAAAAAARRRRRRRRIIIIIIIIOOOOOOONNNNNNTTTTTTLLLLSSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";

let board = [];
let activeTile = null;
let score = 0;
let level = 1;
let gameRunning = false;
let fallInterval = START_FALL_MS;
let fallTimer = null;
let speedTimer = null;
let resolving = false;
let dict = new Set();

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const speedEl = document.getElementById("speed");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");

const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const dropBtn = document.getElementById("dropBtn");

// -------------------------
// DICTIONARY
// -------------------------
function loadDictionary() {
  let words = [];

  if (typeof getDictionaryArray === "function") {
    words = getDictionaryArray();
  } else if (typeof DICTIONARY !== "undefined") {
    if (Array.isArray(DICTIONARY)) words = DICTIONARY;
    else if (DICTIONARY instanceof Set) words = [...DICTIONARY];
  }

  words = words
    .map(w => String(w).trim().toUpperCase())
    .filter(w => /^[A-Z]{3,9}$/.test(w));

  dict = new Set(words);

  // fallback test words so engine definitely proves itself
  ["TEN", "HOOD", "BID", "DOG", "CAT", "WORD", "BED", "BAD", "GOOD"].forEach(w => {
    dict.add(w);
  });

  console.log("Dictionary size:", dict.size);
  console.log("Has TEN?", dict.has("TEN"));
  console.log("Has HOOD?", dict.has("HOOD"));
  console.log("Has BID?", dict.has("BID"));
}

// -------------------------
// SCORING
// -------------------------
function wordPoints(len) {
  if (len === 3) return 1;
  if (len === 4) return 2;
  if (len === 5) return 3;
  if (len === 6) return 4;
  if (len === 7) return 5;
  if (len === 8) return 8;
  if (len === 9) return 10;
  return 0;
}

// -------------------------
// BOARD
// -------------------------
function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function initBoardUI() {
  boardEl.innerHTML = "";
  boardEl.style.display = "grid";
  boardEl.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.id = `cell-${r}-${c}`;
      boardEl.appendChild(cell);
    }
  }
}

function render() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cellEl = document.getElementById(`cell-${r}-${c}`);
      const tile = board[r][c];

      cellEl.className = "cell";
      cellEl.textContent = "";

      if (tile) {
        cellEl.textContent = tile.letter;
        cellEl.classList.add("filled", "grey-tile");
      }
    }
  }

  if (activeTile) {
    const { row, col, letter } = activeTile;
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      const cellEl = document.getElementById(`cell-${row}-${col}`);
      cellEl.textContent = letter;
      cellEl.classList.add("active", "grey-tile");
    }
  }

  scoreEl.textContent = score;
  levelEl.textContent = level;
  speedEl.textContent = `${(fallInterval / 1000).toFixed(1)}s`;
}

function showMessage(msg) {
  if (messageEl) messageEl.textContent = msg;
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------
// LETTER SPAWN
// -------------------------
function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

function spawnTile() {
  const spawnCol = Math.floor(COLS / 2);
  const spawnRow = 0;

  if (board[spawnRow][spawnCol] !== null) {
    endGame();
    return false;
  }

  activeTile = {
    row: spawnRow,
    col: spawnCol,
    letter: randomLetter()
  };

  return true;
}

// -------------------------
// MOVEMENT
// -------------------------
function canMoveTo(row, col) {
  if (col < 0 || col >= COLS) return false;
  if (row < 0 || row >= ROWS) return false;
  if (board[row][col] !== null) return false;
  return true;
}

function moveLeft() {
  if (!gameRunning || !activeTile || resolving) return;
  if (canMoveTo(activeTile.row, activeTile.col - 1)) {
    activeTile.col--;
    render();
  }
}

function moveRight() {
  if (!gameRunning || !activeTile || resolving) return;
  if (canMoveTo(activeTile.row, activeTile.col + 1)) {
    activeTile.col++;
    render();
  }
}

function softDrop() {
  if (!gameRunning || !activeTile || resolving) return;
  tickFall();
}

function hardDrop() {
  if (!gameRunning || !activeTile || resolving) return;

  while (canMoveTo(activeTile.row + 1, activeTile.col)) {
    activeTile.row++;
  }

  lockTile();
}

function tickFall() {
  if (!gameRunning || !activeTile || resolving) return;

  if (canMoveTo(activeTile.row + 1, activeTile.col)) {
    activeTile.row++;
    render();
  } else {
    lockTile();
  }
}

function lockTile() {
  if (!activeTile) return;

  board[activeTile.row][activeTile.col] = { letter: activeTile.letter };
  activeTile = null;
  render();
  resolveBoard();
}

// -------------------------
// WORD FINDING
// -------------------------
function findWordsInCells(cells) {
  const found = [];

  for (let start = 0; start < cells.length; start++) {
    for (let end = start + 3; end <= Math.min(cells.length, start + 9); end++) {
      const slice = cells.slice(start, end);
      const word = slice.map(cell => cell.letter).join("").toUpperCase();

      if (dict.has(word)) {
        found.push({
          word,
          cells: slice.map(cell => ({ row: cell.row, col: cell.col }))
        });
      }
    }
  }

  return found;
}

function findAllWords() {
  let allWords = [];

  // horizontal
  for (let r = 0; r < ROWS; r++) {
    let segment = [];

    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        segment.push({
          row: r,
          col: c,
          letter: board[r][c].letter
        });
      } else {
        if (segment.length >= 3) {
          allWords.push(...findWordsInCells(segment));
        }
        segment = [];
      }
    }

    if (segment.length >= 3) {
      allWords.push(...findWordsInCells(segment));
    }
  }

  // vertical
  for (let c = 0; c < COLS; c++) {
    let segment = [];

    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) {
        segment.push({
          row: r,
          col: c,
          letter: board[r][c].letter
        });
      } else {
        if (segment.length >= 3) {
          allWords.push(...findWordsInCells(segment));
        }
        segment = [];
      }
    }

    if (segment.length >= 3) {
      allWords.push(...findWordsInCells(segment));
    }
  }

  // remove exact duplicates
  const seen = new Set();
  return allWords.filter(item => {
    const key = item.word + "|" + item.cells.map(c => `${c.row},${c.col}`).join(";");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// -------------------------
// FLASH VALID WORD CELLS
// -------------------------
function flashCells(words) {
  const flashed = new Set();

  for (const item of words) {
    for (const cell of item.cells) {
      const key = `${cell.row},${cell.col}`;
      if (flashed.has(key)) continue;
      flashed.add(key);

      const el = document.getElementById(`cell-${cell.row}-${cell.col}`);
      if (el) el.classList.add("flash");
    }
  }
}

function clearFlashCells() {
  const els = document.querySelectorAll(".cell.flash");
  els.forEach(el => el.classList.remove("flash"));
}

// -------------------------
// GRAVITY
// -------------------------
function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const letters = [];

    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        letters.push(board[r][c]);
      }
    }

    for (let r = ROWS - 1; r >= 0; r--) {
      board[r][c] = letters[ROWS - 1 - r] || null;
    }
  }
}

// -------------------------
// RESOLVE WORDS / COMBOS
// -------------------------
async function resolveBoard() {
  resolving = true;
  let cascade = 1;

  while (true) {
    const words = findAllWords();
    if (!words.length) break;

    console.log("Words found:", words.map(w => w.word));

    let basePoints = 0;
    const cellsToClear = new Set();

    for (const item of words) {
      basePoints += wordPoints(item.word.length);
      for (const cell of item.cells) {
        cellsToClear.add(`${cell.row},${cell.col}`);
      }
    }

    const multiplier = cascade === 1 ? 1 : cascade;
    const gained = basePoints * multiplier;
    score += gained;
    scoreEl.textContent = score;

    showMessage(
      multiplier > 1
        ? `Words: ${words.map(w => w.word).join(", ")} | Combo x${multiplier} | +${gained}`
        : `Words: ${words.map(w => w.word).join(", ")} | +${gained}`
    );

    flashCells(words);
    await pause(140);
    clearFlashCells();

    for (const key of cellsToClear) {
      const [r, c] = key.split(",").map(Number);
      board[r][c] = null;
    }

    render();
    await pause(120);

    applyGravity();
    render();
    await pause(140);

    cascade++;
  }

  resolving = false;

  if (gameRunning) {
    if (!spawnTile()) return;
    render();
  }
}

// -------------------------
// TIMER / GAME FLOW
// -------------------------
function startFallLoop() {
  clearInterval(fallTimer);
  fallTimer = setInterval(() => {
    tickFall();
  }, fallInterval);
}

function startSpeedLoop() {
  clearInterval(speedTimer);
  speedTimer = setInterval(() => {
    fallInterval = Math.max(MIN_FALL_MS, fallInterval - SPEED_STEP_MS);
    level++;
    startFallLoop();
    render();
  }, SPEED_UP_EVERY_MS);
}

function startGame() {
  clearInterval(fallTimer);
  clearInterval(speedTimer);

  loadDictionary();

  board = createEmptyBoard();
  activeTile = null;
  score = 0;
  level = 1;
  fallInterval = START_FALL_MS;
  resolving = false;
  gameRunning = true;

  initBoardUI();
  scoreEl.textContent = score;
  levelEl.textContent = level;
  speedEl.textContent = `${(fallInterval / 1000).toFixed(1)}s`;

  showMessage("Game started");

  spawnTile();
  render();

  startFallLoop();
  startSpeedLoop();
}

function endGame() {
  gameRunning = false;
  clearInterval(fallTimer);
  clearInterval(speedTimer);
  activeTile = null;
  render();
  showMessage(`Game Over! Final score: ${score}`);
}

// -------------------------
// KEYBOARD CONTROLS
// -------------------------
document.addEventListener("keydown", e => {
  if (!gameRunning) return;

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    moveLeft();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    moveRight();
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    softDrop();
  } else if (e.key === " " || e.code === "Space") {
    e.preventDefault();
    hardDrop();
  }
});

// -------------------------
// BUTTON CONTROLS
// -------------------------
if (startBtn) startBtn.addEventListener("click", startGame);
if (leftBtn) leftBtn.addEventListener("click", moveLeft);
if (rightBtn) rightBtn.addEventListener("click", moveRight);
if (downBtn) downBtn.addEventListener("click", softDrop);
if (dropBtn) dropBtn.addEventListener("click", hardDrop);

// -------------------------
// SWIPE CONTROLS
// -------------------------
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

boardEl.addEventListener(
  "touchstart",
  e => {
    if (!gameRunning || !activeTile || resolving) return;
    const t = e.changedTouches[0];
    touchStartX = t.clientX;
    touchStartY = t.clientY;
    touchMoved = false;
  },
  { passive: true }
);

boardEl.addEventListener(
  "touchmove",
  e => {
    if (!gameRunning || !activeTile || resolving) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // prevent repeated micro moves
    if (touchMoved) return;

    // horizontal swipe
    if (Math.abs(dx) > 24 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) moveRight();
      else moveLeft();
      touchMoved = true;
    }

    // downward swipe
    else if (dy > 24 && Math.abs(dy) > Math.abs(dx)) {
      softDrop();
      touchMoved = true;
    }
  },
  { passive: true }
);

boardEl.addEventListener(
  "touchend",
  e => {
    if (!gameRunning || !activeTile || resolving) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;

    // strong downward swipe = hard drop
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      hardDrop();
    }
  },
  { passive: true }
);

// -------------------------
// INIT
// -------------------------
initBoardUI();
render();