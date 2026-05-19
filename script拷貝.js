const size = 4;
const board = [];
const tileMap = new Map();
let score = 0;
let bestScore = 0;
let autoPlayInterval = null;
const tileContainer = document.getElementById('tile-container');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const autoPlayBtn = document.getElementById('auto-play-btn');
const restartBtn = document.getElementById('restart-btn');
const toast = document.getElementById('toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => toast.classList.remove('show'), 1400);
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function initBoard() {
  for (let row = 0; row < size; row++) {
    board[row] = [];
    for (let col = 0; col < size; col++) {
      board[row][col] = null;
    }
  }
}

function updateScores() {
  scoreEl.textContent = score;
  bestScore = Math.max(bestScore, score);
  bestScoreEl.textContent = bestScore;
}

function placeRandomTile() {
  const empty = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!board[row][col]) empty.push({ row, col });
    }
  }
  if (!empty.length) return false;
  const choice = empty[Math.floor(Math.random() * empty.length)];
  board[choice.row][choice.col] = {
    id: generateId(),
    value: Math.random() < 0.9 ? 2 : 4,
    merged: false,
  };
  return true;
}

function tilePosition(row, col) {
  const gap = '10px';
  const tileSize = 'calc((100% - 30px) / 4)';
  return {
    top: `calc(${row} * (${tileSize} + ${gap}))`,
    left: `calc(${col} * (${tileSize} + ${gap}))`,
  };
}

function createTileElement(tile, row, col) {
  const tileEl = document.createElement('div');
  const classes = ['tile', `tile-${tile.value}`];
  if (tile.new) classes.push('tile-new');
  if (tile.mergedThisMove) classes.push('tile-merged');
  tileEl.className = classes.join(' ');
  tileEl.dataset.id = tile.id;
  tileEl.innerHTML = `<div class="tile-inner">${tile.value}</div>`;
  const pos = tilePosition(row, col);
  tileEl.style.top = pos.top;
  tileEl.style.left = pos.left;
  return tileEl;
}

function updateTileElement(tileEl, tile, row, col) {
  const classes = ['tile', `tile-${tile.value}`];
  if (tile.mergedThisMove) classes.push('tile-merged');
  tileEl.className = classes.join(' ');
  tileEl.dataset.id = tile.id;
  const inner = tileEl.querySelector('.tile-inner');
  if (inner) inner.textContent = tile.value;
  const pos = tilePosition(row, col);
  tileEl.style.top = pos.top;
  tileEl.style.left = pos.left;
}

function render() {
  const activeIds = new Set();

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const tile = board[row][col];
      if (!tile) continue;
      activeIds.add(tile.id);
      if (tileMap.has(tile.id)) {
        updateTileElement(tileMap.get(tile.id), tile, row, col);
      } else {
        const tileEl = createTileElement(tile, row, col);
        tileMap.set(tile.id, tileEl);
        tileContainer.appendChild(tileEl);
        setTimeout(() => tileEl.classList.remove('tile-new'), 200);
      }
    }
  }

  for (const [id, tileEl] of tileMap.entries()) {
    if (!activeIds.has(id)) {
      tileEl.remove();
      tileMap.delete(id);
    }
  }

  updateScores();
}

function copyBoard(original) {
  return original.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function copyValuesGrid(grid) {
  return grid.map(row => row.map(cell => (cell ? cell.value : 0)));
}

function rotateClockwise(grid) {
  const newGrid = Array.from({ length: size }, () => Array(size).fill(null));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      newGrid[c][size - 1 - r] = grid[r][c];
    }
  }
  return newGrid;
}

function initEmptyGrid() {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

function pushLineTiles(line) {
  const newLine = [];
  for (const cell of line) {
    if (!cell) continue;
    if (
      newLine.length &&
      newLine[newLine.length - 1].value === cell.value &&
      !newLine[newLine.length - 1].merged &&
      !cell.merged
    ) {
      const mergedTile = {
        ...newLine[newLine.length - 1],
        value: newLine[newLine.length - 1].value * 2,
        merged: true,
        mergedThisMove: true,
      };
      mergedTile.id = generateId();
      newLine[newLine.length - 1] = mergedTile;
      score += mergedTile.value;
    } else {
      newLine.push({ ...cell, merged: false, mergedThisMove: false });
    }
  }

  while (newLine.length < size) newLine.push(null);
  return newLine;
}

function pushLineValues(line) {
  const newLine = [];
  for (const value of line) {
    if (!value) continue;
    if (newLine.length && newLine[newLine.length - 1] === value) {
      newLine[newLine.length - 1] *= 2;
    } else {
      newLine.push(value);
    }
  }
  while (newLine.length < size) newLine.push(0);
  return newLine;
}

function move(direction, simulate = false, customGrid = null) {
  const savedScore = score;
  let moved = false;

  const targetBoard = customGrid || board;

  if (!simulate) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const tile = targetBoard[row][col];
        if (tile) {
          tile.merged = false;
          tile.mergedThisMove = false;
        }
      }
    }
  }

  let rotated = simulate ? copyValuesGrid(targetBoard) : copyBoard(targetBoard);

  for (let i = 0; i < direction; i++) rotated = rotateClockwise(rotated);

  for (let row = 0; row < size; row++) {
    const line = rotated[row];
    const pushed = simulate ? pushLineValues(line) : pushLineTiles(line);
    const rowChanged = pushed.some((cell, idx) => {
      const old = line[idx];
      if (!cell && !old) return false;
      if (!cell || !old) return true;
      return simulate ? cell !== old : cell.id !== old.id || cell.value !== old.value;
    });
    if (rowChanged) moved = true;
    rotated[row] = pushed;
  }

  for (let i = 0; i < (4 - direction) % 4; i++) rotated = rotateClockwise(rotated);

  if (!moved) {
    score = savedScore;
    return null;
  }

  if (!simulate) {
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        targetBoard[row][col] = rotated[row][col];
      }
    }
  } else {
    score = savedScore;
  }

  return rotated;
}

function canMove() {
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!board[row][col]) return true;
      if (col < size - 1 && board[row][col].value === board[row][col + 1]?.value) return true;
      if (row < size - 1 && board[row][col].value === board[row + 1][col]?.value) return true;
    }
  }
  return false;
}

function sumGridValues(grid) {
  return grid.reduce((sum, row) => sum + row.reduce((rowSum, value) => rowSum + (value || 0), 0), 0);
}

function getValidMoves(customGrid = null) {
  const validMoves = [];
  for (let direction = 0; direction < 4; direction++) {
    if (move(direction, true, customGrid)) validMoves.push(direction);
  }
  return validMoves;
}

function countEmpty(grid) {
  let empty = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!grid[row][col]) empty += 1;
    }
  }
  return empty;
}

function monotonicity(grid) {
  let total = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size - 1; col++) {
      const left = grid[row][col] || 0;
      const right = grid[row][col + 1] || 0;
      if (left && right) total -= Math.abs(Math.log2(left) - Math.log2(right));
    }
  }

  for (let col = 0; col < size; col++) {
    for (let row = 0; row < size - 1; row++) {
      const top = grid[row][col] || 0;
      const bottom = grid[row + 1][col] || 0;
      if (top && bottom) total -= Math.abs(Math.log2(top) - Math.log2(bottom));
    }
  }

  return total;
}

function cornerMaxBonus(grid) {
  const maxTile = Math.max(...grid.flat().map(value => value || 0));
  const corners = [grid[0][0], grid[0][size - 1], grid[size - 1][0], grid[size - 1][size - 1]];
  return corners.includes(maxTile) ? 1 : 0;
}

function stuckRisk(grid) {
  const empty = countEmpty(grid);
  const mono = monotonicity(grid);
  const maxTile = Math.max(...grid.flat().map(value => value || 0));
  const risk = (16 - empty) * 10 - mono * 5 - Math.log2(maxTile + 1) * 2;
  return Math.max(0, risk);
}

function evaluateGrid(grid) {
  const emptyWeight = 200;
  const monotonicityWeight = 30;
  const maxTileWeight = 2;
  const cornerWeight = 400;
  const stuckWeight = -50;

  const empty = countEmpty(grid);
  let maxTile = 0;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      maxTile = Math.max(maxTile, grid[row][col] || 0);
    }
  }

  return (
    empty * emptyWeight +
    monotonicity(grid) * monotonicityWeight +
    Math.log2(maxTile + 1) * maxTileWeight +
    cornerMaxBonus(grid) * cornerWeight +
    stuckRisk(grid) * stuckWeight
  );
}

function getExpectedMoveScore(direction) {
  const movedGrid = move(direction, true);
  if (!movedGrid) return -Infinity;

  const empties = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!movedGrid[row][col]) empties.push({ row, col });
    }
  }

  if (!empties.length) return evaluateGrid(movedGrid);

  let totalScore = 0;
  const weight2 = 0.9;
  const weight4 = 0.1;

  for (const empty of empties) {
    movedGrid[empty.row][empty.col] = 2;
    totalScore += weight2 * evaluateGrid(movedGrid);
    movedGrid[empty.row][empty.col] = 4;
    totalScore += weight4 * evaluateGrid(movedGrid);
    movedGrid[empty.row][empty.col] = null;
  }

  return totalScore / empties.length;
}

function getDeepMoveScore(direction) {
  const movedGrid = move(direction, true);
  if (!movedGrid) return -Infinity;

  const empties = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!movedGrid[row][col]) empties.push({ row, col });
    }
  }

  if (!empties.length) return evaluateGrid(movedGrid);

  let totalScore = 0;
  const weight2 = 0.9;
  const weight4 = 0.1;

  for (const empty of empties) {
    movedGrid[empty.row][empty.col] = 2;
    totalScore += weight2 * getExpectedMoveScoreAfterTile(movedGrid);
    movedGrid[empty.row][empty.col] = 4;
    totalScore += weight4 * getExpectedMoveScoreAfterTile(movedGrid);
    movedGrid[empty.row][empty.col] = null;
  }

  return totalScore / empties.length;
}

function getExpectedMoveScoreAfterTile(grid) {
  const validMoves = getValidMoves(grid);
  if (!validMoves.length) return evaluateGrid(grid) - 1000; // penalty for stuck

  let total = 0;
  for (const d of validMoves) {
    const afterMove = move(d, true, grid);
    if (afterMove) total += evaluateGrid(afterMove);
  }
  return total / validMoves.length;
}

function getBestMove() {
  const validMoves = getValidMoves();
  if (!validMoves.length) return null;

  let bestDirection = validMoves[0];
  let bestScore = -Infinity;

  for (const direction of validMoves) {
    const scoreValue = getDeepMoveScore(direction);
    if (scoreValue > bestScore) {
      bestScore = scoreValue;
      bestDirection = direction;
    }
  }

  return bestDirection;
}

function playAuto() {
  if (autoPlayInterval) return;
  autoPlayBtn.textContent = '停止自動遊玩';
  autoPlayInterval = setInterval(() => {
    if (!canMove()) {
      stopAutoPlay();
      showToast('遊戲結束');
      return;
    }
    const direction = getBestMove();
    if (direction === null) {
      stopAutoPlay();
      showToast('無可行方向');
      return;
    }
    const movedGrid = move(direction);
    if (!movedGrid) {
      stopAutoPlay();
      showToast('AI 目前無法移動');
      return;
    }
    placeRandomTile();
    render();
    if (!canMove()) showToast('遊戲結束');
  }, 120);
}

function stopAutoPlay() {
  clearInterval(autoPlayInterval);
  autoPlayInterval = null;
  autoPlayBtn.textContent = '啟動自動遊玩';
}

function restartGame() {
  stopAutoPlay();
  score = 0;
  initBoard();
  placeRandomTile();
  placeRandomTile();
  render();
}

window.addEventListener('keydown', event => {
  const keyMap = { ArrowLeft: 0, ArrowDown: 1, ArrowRight: 2, ArrowUp: 3 };
  if (!(event.key in keyMap)) return;
  event.preventDefault();
  const movedGrid = move(keyMap[event.key]);
  if (movedGrid) {
    placeRandomTile();
    render();
    if (!canMove()) showToast('遊戲結束');
  }
});

// Touch events for mobile
let touchStartX = 0;
let touchStartY = 0;

document.addEventListener('touchstart', event => {
  touchStartX = event.touches[0].clientX;
  touchStartY = event.touches[0].clientY;
});

document.addEventListener('touchend', event => {
  if (!touchStartX || !touchStartY) return;

  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  const minSwipeDistance = 50;

  if (Math.abs(deltaX) < minSwipeDistance && Math.abs(deltaY) < minSwipeDistance) return;

  let direction = null;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    direction = deltaX > 0 ? 2 : 0; // right or left
  } else {
    direction = deltaY > 0 ? 1 : 3; // down or up
  }

  const movedGrid = move(direction);
  if (movedGrid) {
    placeRandomTile();
    render();
    if (!canMove()) showToast('遊戲結束');
  }

  touchStartX = 0;
  touchStartY = 0;
});

autoPlayBtn.addEventListener('click', () => {
  if (autoPlayInterval) {
    stopAutoPlay();
  } else {
    playAuto();
  }
});

restartBtn.addEventListener('click', restartGame);

initBoard();
placeRandomTile();
placeRandomTile();
render();
