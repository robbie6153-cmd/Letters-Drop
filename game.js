// WORD TETRIS / WORD DROP GAME
// Grid: 9 wide x 12 high
// One tile falls at a time
// Finds words horizontally and vertically
// Uses existing dictionary.js if getDictionaryArray() exists

const COLS = 9;
const ROWS = 12;

const START_FALL_MS = 800;      // 0.8 sec
const SPEED_UP_EVERY_MS = 60000; // every minute
const SPEED_STEP_MS = 100;       // gets 0.1 sec faster
const MIN_FALL_MS = 150;

const LETTERS = "EEEEEEEEEEEEAAAAAAAARRRRRRRRIIIIIIIIOOOOOOONNNNNNTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";

let board = [];
let activeTile = null;
let score = 0;
let level = 1;
let gameRunning = false;
let fallInterval = START_FALL_MS;
let fallTimer = null;
let speedTimer = null;
let resolving = false;

const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const speedEl = document.getElementById("speed");
const messageEl = document.getElementById("message");
const startBtn = document.getElementById("startBtn");

// -------------------------
// DICTIONARY
// -------------------------
function getLiveDictionary() {
  if (typeof getDictionaryArray === "function") {
    return new Set(getDictionaryArray().map(w => w.toUpperCase()));
  }

  if (typeof DICTIONARY !== "undefined") {
    if (Array.isArray(DICTIONARY)) {
      return new Set(DICTIONARY.map(w => w.toUpperCase()));
    }
    if (DICTIONARY instanceof Set) {
      return new Set([...DICTIONARY].map(w => w.toUpperCase()));
    }
  }

  console.warn("No dictionary found. Make sure dictionary.js is loaded.");
  return new Set();
}

// cached after start
let DICT = new Set();

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
// BOARD SETUP
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
        cellEl.classList.add("filled");
        cellEl.classList.add("grey-tile");
      }
    }
  }

  if (activeTile) {
    const { row, col, letter } = activeTile;
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      const cellEl = document.getElementById(`cell-${row}-${col}`);
      cellEl.textContent = letter;
      cellEl.classList.add("active");
      cellEl.classList.add("grey-tile");
    }
  }

  scoreEl.textContent = score;
  levelEl.textContent = level;
  speedEl.textContent = `${(fallInterval / 1000).toFixed(1)}s`;
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
  const newCol = activeTile.col - 1;
  if (canMoveTo(activeTile.row, newCol)) {
    activeTile.col = newCol;
    render();
  }
}

function moveRight() {
  if (!gameRunning || !activeTile || resolving) return;
  const newCol = activeTile.col + 1;
  if (canMoveTo(activeTile.row, newCol)) {
    activeTile.col = newCol;
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

  const newRow = activeTile.row + 1;

  if (canMoveTo(newRow, activeTile.col)) {
    activeTile.row = newRow;
    render();
  } else {
    lockTile();
  }
}

function lockTile() {
  if (!activeTile) return;

  board[activeTile.row][activeTile.col] = {
    letter: activeTile.letter
  };

  activeTile = null;
  render();
  resolveBoard();
}

// -------------------------
// WORD FINDING
// -------------------------
function findWordsInLine(cells) {
  // cells = [{row, col, letter}, ...] contiguous non-empty line
  const results = [];

  for (let start = 0; start < cells.length; start++) {
    for (let len = 3; len <= 9; len++) {
      if (start + len > cells.length) continue;

      const slice = cells.slice(start, start + len);
      const word = slice.map(x => x.letter).join("");

      if (DICT.has(word)) {
        results.push({
          word,
          cells: slice.map(x => ({ row: x.row, col: x.col }))
        });
      }
    }
  }

  return results;
}

function getHorizontalWords() {
  const found = [];

  for (let r = 0; r < ROWS; r++) {
    let segment = [];

    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        segment.push({ row: r, col: c, letter: board[r][c].letter });
      } else {
        if (segment.length >= 3) {
          found.push(...findWordsInLine(segment));
        }
        segment = [];
      }
    }

    if (segment.length >= 3) {
      found.push(...findWordsInLine(segment));
    }
  }

  return found;
}

function getVerticalWords() {
  const found = [];

  for (let c = 0; c < COLS; c++) {
    let segment = [];

    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) {
        segment.push({ row: r, col: c, letter: board[r][c].letter });
      } else {
        if (segment.length >= 3) {
          found.push(...findWordsInLine(segment));
        }
        segment = [];
      }
    }

    if (segment.length >= 3) {
      found.push(...findWordsInLine(segment));
    }
  }

  return found;
}

function dedupeWords(words) {
  const seen = new Set();
  const unique = [];

  for (const item of words) {
    const key = item.word + ":" + item.cells.map(c => `${c.row},${c.col}`).join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function findAllWords() {
  const all = [...getHorizontalWords(), ...getVerticalWords()];
  return dedupeWords(all);
}

// -------------------------
// CLEAR + GRAVITY
// -------------------------
function clearWordCells(words) {
  const cellsToClear = new Set();

  for (const wordObj of words) {
    for (const cell of wordObj.cells) {
      cellsToClear.add(`${cell.row},${cell.col}`);
    }
  }

  for (const key of cellsToClear) {
    const [r, c] = key.split(",").map(Number);
    board[r][c] = null;
  }

  return cellsToClear.size;
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const stack = [];

    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r][c] !== null) {
        stack.push(board[r][c]);
      }
    }

    for (let r = ROWS - 1; r >= 0; r--) {
      board[r][c] = stack[ROWS - 1 - r] || null;
    }
  }
}

// -------------------------
// RESOLVE CASCADES / COMBOS
// -------------------------
async function resolveBoard() {
  resolving = true;

  let cascadeCount = 0;

  while (true) {
    const words = findAllWords();

    if (words.length === 0) break;

    cascadeCount++;

    let base = 0;
    for (const w of words) {
      base += wordPoints(w.word.length);
    }

    const multiplier = cascadeCount === 1 ? 1 : cascadeCount;
    const gained = base * multiplier;
    score += gained;

    const wordList = words.map(w => w.word).join(", ");
    if (multiplier > 1) {
      showMessage(`Words: ${wordList} | Combo x${multiplier} | +${gained}`);
    } else {
      showMessage(`Words: ${wordList} | +${gained}`);
    }

    clearWordCells(words);
    render();
    await pause(220);

    applyGravity();
    render();
    await pause(220);
  }

  showMessage(" ");
  resolving = false;

  if (gameRunning) {
    if (!spawnTile()) return;
    render();
  }
}

// -------------------------
// TIMERS / GAME FLOW
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
  DICT = getLiveDictionary();

  board = createEmptyBoard();
  activeTile = null;
  score = 0;
  level = 1;
  fallInterval = START_FALL_MS;
  resolving = false;
  gameRunning = true;

  initBoardUI();
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

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showMessage(msg) {
  if (messageEl) {
    messageEl.textContent = msg;
  }
}

// -------------------------
// CONTROLS
// -------------------------
document.addEventListener("keydown", (e) => {
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

if (startBtn) {
  startBtn.addEventListener("click", startGame);
}

// -------------------------
// OPTIONAL MOBILE CONTROLS
// If you add buttons with these IDs, they'll work:
// leftBtn, rightBtn, downBtn, dropBtn
// -------------------------
const leftBtn = document.getElementById("leftBtn");
const rightBtn = document.getElementById("rightBtn");
const downBtn = document.getElementById("downBtn");
const dropBtn = document.getElementById("dropBtn");

if (leftBtn) leftBtn.addEventListener("click", moveLeft);
if (rightBtn) rightBtn.addEventListener("click", moveRight);
if (downBtn) downBtn.addEventListener("click", softDrop);
if (dropBtn) dropBtn.addEventListener("click", hardDrop);

// -------------------------
// INITIAL BOARD UI
// -------------------------
initBoardUI();
render();