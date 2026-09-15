'use strict';

const { MARK, WIN_LINES } = require('./constants');

/**
 * @param {(null|'X'|'O')[]} board
 * @returns {'X'|'O'|null}
 */
function checkWinner(board) {
    for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    return null;
}

/**
 * @param {(null|'X'|'O')[]} board
 * @returns {boolean}
 */
function isFull(board) {
    return board.every((cell) => cell !== MARK.EMPTY);
}

/**
 * Standard minimax, depth-aware so the AI prefers the fastest win and the
 * slowest loss. The board is only 9 cells, so no pruning is needed.
 *
 * @param {(null|'X'|'O')[]} board
 * @param {'X'|'O'} turn mark to move next
 * @param {'X'|'O'} aiMark
 * @param {number} depth
 * @returns {number}
 */
function minimax(board, turn, aiMark, depth = 0) {
    const winner = checkWinner(board);
    if (winner === aiMark) return 10 - depth;
    if (winner) return depth - 10;
    if (isFull(board)) return 0;

    const opponent = turn === MARK.X ? MARK.O : MARK.X;
    const scores = [];
    for (let i = 0; i < board.length; i++) {
        if (board[i] !== MARK.EMPTY) continue;
        board[i] = turn;
        scores.push(minimax(board, opponent, aiMark, depth + 1));
        board[i] = MARK.EMPTY;
    }

    return turn === aiMark ? Math.max(...scores) : Math.min(...scores);
}

/**
 * @param {(null|'X'|'O')[]} board
 * @param {'X'|'O'} mark the AI's mark
 * @returns {number} best available position, or -1 if the board is full
 */
function getBestMove(board, mark) {
    let bestScore = -Infinity;
    let bestPosition = -1;
    const opponent = mark === MARK.X ? MARK.O : MARK.X;

    for (let i = 0; i < board.length; i++) {
        if (board[i] !== MARK.EMPTY) continue;
        board[i] = mark;
        const score = minimax(board, opponent, mark, 1);
        board[i] = MARK.EMPTY;

        if (score > bestScore) {
            bestScore = score;
            bestPosition = i;
        }
    }

    return bestPosition;
}

module.exports = { checkWinner, getBestMove };

if (require.main === module) {
    const assert = require('assert');

    // Takes an immediate win.
    assert.strictEqual(
        getBestMove(['X', 'X', null, 'O', 'O', null, null, null, null], 'X'),
        2,
        'should take the immediate win',
    );

    // Blocks an immediate opponent win.
    assert.strictEqual(
        getBestMove(['O', 'O', null, 'X', null, null, null, null, null], 'X'),
        2,
        'should block the opponent win',
    );

    // Minimax vs minimax always draws.
    let board = Array(9).fill(MARK.EMPTY);
    let turn = MARK.X;
    while (!checkWinner(board) && !isFull(board)) {
        board[getBestMove(board, turn)] = turn;
        turn = turn === MARK.X ? MARK.O : MARK.X;
    }
    assert.strictEqual(checkWinner(board), null, 'perfect play should always draw');

    console.log('minimax self-check passed');
}
