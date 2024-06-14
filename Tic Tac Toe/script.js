let currentPlayer = 'X';
let gameActive = true;
let gameState = ['', '', '', '', '', '', '', '', ''];
const winningConditions = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const winningMessage = () => `Player ${currentPlayer} wins!`;
const drawMessage = () => 'Game ended in a draw!';
const currentPlayerTurn = () => `Player ${currentPlayer}'s turn`;

const message = document.getElementById('message');

message.innerHTML = currentPlayerTurn();

function makeMove(cellIndex) {
  if (!gameActive || gameState[cellIndex] !== '') return;

  gameState[cellIndex] = currentPlayer;
  document.getElementsByClassName('cell')[cellIndex].innerHTML = currentPlayer;

  if (checkWin()) {
    message.innerHTML = winningMessage();
    gameActive = false;
    return;
  }

  if (!gameState.includes('')) {
    message.innerHTML = drawMessage();
    gameActive = false;
    return;
  }

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  message.innerHTML = currentPlayerTurn();
}

function checkWin() {
  return winningConditions.some(condition => {
    return condition.every(index => {
      return gameState[index] === currentPlayer;
    });
  });
}

function resetBoard() {
  gameState = ['', '', '', '', '', '', '', '', ''];
  currentPlayer = 'X';
  gameActive = true;
  message.innerHTML = currentPlayerTurn();
  document.querySelectorAll('.cell').forEach(cell => cell.innerHTML = '');
}
