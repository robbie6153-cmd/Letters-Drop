const COLS = 7;
const ROWS = 12;

const START_FALL_MS = 800;
const SPEED_UP_EVERY_MS = 60000;
const SPEED_STEP_MS = 100;
const MIN_FALL_MS = 150;

const LETTERS =
  "EEEEEEEEEEEEAAAAAAAARRRRRRRRIIIIIIIIOOOOOOONNNNNNTTTTTTLLLLSSSSUUUUDDDDGGGBBCCMMPPFFHHVVWWYYKJXQZ";

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


// -------------------------
// DICTIONARY HOOK
// -------------------------
function onDictionaryReady() {
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = "Start Game";
  }
  showMessage("Dictionary loaded. Ready to play.");
}

// -------------------------
// DICTIONARY
// -------------------------
function loadDictionary() {
  let words = [];

  if (typeof getDictionaryArray === "function") {
    words = getDictionaryArray();
  }

  words = words
    .map(w => String(w).trim().toUpperCase())
    .filter(w => /^[A-Z]{3,7}$/.test(w));

  dict = new Set(words);

  [
    "TEN", "HOOD", "BID", "DOG", "CAT", "WORD", "BED", "BAD", "GOOD",
    "OWED", "KILL", "WELL", "HOME", "MAKE", "TIME", "SIDE", "LINE"
  ].forEach(w => {
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
  if (len === 7) return 7;
  return 0;
}

function showComboPopup(text, isGold = false) {
  const popup = document.createElement("div");
  popup.className = isGold ? "combo-popup gold" : "combo-popup";
  popup.textContent = text;
  document.body.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 750);
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

  touchActive = false;

  activeTile = {
    row: spawnRow,
    col: spawnCol,
    letter: randomLetter()
  };

  return true;
}
let nextLetterCooldown = false;

function dropNextLetter() {
  if (gameEnded || nextLetterCooldown) return;

  spawnTile(); // make sure this matches your actual function name

  nextLetterCooldown = true;
  setTimeout(() => {
    nextLetterCooldown = false;
  }, 500);
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
  touchActive = false;
  render();
  resolveBoard();
}

// -------------------------
// WORD FINDING
// -------------------------
function findWordsInCells(cells) {
  const found = [];

  for (let start = 0; start < cells.length; start++) {
    for (let end = start + 3; end <= Math.min(cells.length, start + 7); end++) {
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

  for (let r = 0; r < ROWS; r++) {
    let segment = [];
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) {
        segment.push({ row: r, col: c, letter: board[r][c].letter });
      } else {
        if (segment.length >= 3) allWords.push(...findWordsInCells(segment));
        segment = [];
      }
    }
    if (segment.length >= 3) allWords.push(...findWordsInCells(segment));
  }

  for (let c = 0; c < COLS; c++) {
    let segment = [];
    for (let r = 0; r < ROWS; r++) {
      if (board[r][c]) {
        segment.push({ row: r, col: c, letter: board[r][c].letter });
      } else {
        if (segment.length >= 3) allWords.push(...findWordsInCells(segment));
        segment = [];
      }
    }
    if (segment.length >= 3) allWords.push(...findWordsInCells(segment));
  }

  const seen = new Set();
  return allWords.filter(item => {
    const key = item.word + "|" + item.cells.map(c => `${c.row},${c.col}`).join(";");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// -------------------------
// FLASH
// -------------------------
function flashCells(words, multiplier = 1) {
  for (const item of words) {
    const isSeven = item.word.length === 7;

    for (const cell of item.cells) {
      const index = cell.row * COLS + cell.col;
      const el = boardEl.children[index];
      if (!el) continue;

      el.classList.add("flash-green");

      if (multiplier >= 2) {
        el.classList.add("flash-combo");
      }

      if (isSeven) {
        el.classList.add("flash-gold");
      }
    }
  }
}

function clearFlashCells() {
  [...boardEl.children].forEach(el => {
    el.classList.remove("flash-green", "flash-combo", "flash-gold");
  });
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
// RESOLVE
// -------------------------
async function resolveBoard() {
  resolving = true;
  let cascade = 1;
  let comboBaseTotal = 0;

  while (true) {
    const words = findAllWords();
    if (!words.length) break;

    const cellsToClear = new Set();
    let longestWord = null;

    for (const item of words) {
      if (!longestWord || item.word.length > longestWord.word.length) {
        longestWord = item;
      }

      for (const cell of item.cells) {
        cellsToClear.add(`${cell.row},${cell.col}`);
      }
    }

    const basePoints = longestWord ? wordPoints(longestWord.word.length) : 0;
    comboBaseTotal += basePoints;

    const multiplier = cascade === 1 ? 1 : cascade;
    const gained = comboBaseTotal * multiplier;

    score += gained;
    scoreEl.textContent = score;

    if (multiplier >= 2) {
      showComboPopup(`Combo x${multiplier}`);
    }

    if (words.some(item => item.word.length === 7)) {
      showComboPopup("7 LETTER WORD!", true);
    }

    showMessage(
      multiplier > 1
        ? `Words: ${words.map(w => w.word).join(", ")} | Combo x${multiplier} | +${gained}`
        : `Words: ${words.map(w => w.word).join(", ")} | +${gained}`
    );

    flashCells(words, multiplier);
    await pause(220);
    clearFlashCells();

    for (const key of cellsToClear) {
      const [r, c] = key.split(",").map(Number);
      board[r][c] = null;
    }

    render();
    await pause(100);

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
// GAME FLOW
// -------------------------
function resetGameState() {
  clearInterval(fallTimer);
  clearInterval(speedTimer);

  board = createEmptyBoard();
  activeTile = null;
  score = 0;
  level = 1;
  fallInterval = START_FALL_MS;
  resolving = false;

  initBoardUI();
  render();

  scoreEl.textContent = score;
  levelEl.textContent = level;
  speedEl.textContent = `${(fallInterval / 1000).toFixed(1)}s`;
}

function startNewGame() {
  loadDictionary();
  resetGameState();
  gameRunning = true;
  showMessage("Game started");
  spawnTile();
  render();
  startFallLoop();
  startSpeedLoop();

  if (startBtn) {
    startBtn.textContent = "Restart Game";
    startBtn.disabled = false;
  }
}

function handleStartButton() {
  if (typeof isDictionaryLoaded === "function" && !isDictionaryLoaded()) {
    showMessage("Dictionary still loading...");
    return;
  }

  if (!gameRunning) {
    startNewGame();
    return;
  }

  const restart = confirm("Restart current game?");
  if (restart) {
    startNewGame();
  }
}

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

function endGame() {
  gameRunning = false;
  clearInterval(fallTimer);
  clearInterval(speedTimer);
  activeTile = null;
  render();
  showMessage(`Game Over! Final score: ${score}`);

  if (startBtn) {
    startBtn.textContent = "Start Game";
    startBtn.disabled = false;
  }
}

// -------------------------
// INPUTS
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

if (startBtn) {
  startBtn.disabled = true;
  startBtn.textContent = "Loading...";
  startBtn.addEventListener("click", handleStartButton);
}

// -------------------------
// SWIPE
// -------------------------
let touchActive = false;

function getBoardTouchPosition(touch) {
  const rect = boardEl.getBoundingClientRect();
  const cellWidth = rect.width / COLS;
  const cellHeight = rect.height / ROWS;

  let x = touch.clientX - rect.left;
  let y = touch.clientY - rect.top;

  // clamp inside board
  x = Math.max(0, Math.min(rect.width - 1, x));
  y = Math.max(0, Math.min(rect.height - 1, y));

  const col = Math.floor(x / cellWidth);
  const row = Math.floor(y / cellHeight);

  return { row, col };
}

boardEl.addEventListener("touchstart", e => {
  if (!gameRunning || !activeTile || resolving) return;

  const t = e.changedTouches[0];
  const pos = getBoardTouchPosition(t);

  // only start swipe if finger begins on active tile
  if (pos.row !== activeTile.row || pos.col !== activeTile.col) {
    touchActive = false;
    return;
  }

  touchActive = true;
}, { passive: true });

boardEl.addEventListener("touchmove", e => {
  if (!gameRunning || !activeTile || resolving || !touchActive) return;

  const t = e.changedTouches[0];
  const pos = getBoardTouchPosition(t);

  // horizontal follow
  while (activeTile.col < pos.col && canMoveTo(activeTile.row, activeTile.col + 1)) {
    activeTile.col++;
  }
  while (activeTile.col > pos.col && canMoveTo(activeTile.row, activeTile.col - 1)) {
    activeTile.col--;
  }

  // vertical follow downward only
  while (activeTile.row < pos.row && canMoveTo(activeTile.row + 1, activeTile.col)) {
    activeTile.row++;
  }

  render();
}, { passive: true });

boardEl.addEventListener("touchend", () => {
  touchActive = false;
}, { passive: true });

// -------------------------
// INIT
// -------------------------
initBoardUI();
render();
showMessage("Loading dictionary...");