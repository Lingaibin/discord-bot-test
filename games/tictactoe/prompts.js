'use strict';

const { MARK } = require('./constants');

/**
 * Format a board for the move-selection prompt (0–8 indexing).
 * @param {(null|'X'|'O')[]} board
 * @returns {string}
 */
function formatBoard(board) {
    const cell = (i) => (board[i] == null ? ' ' : board[i]);
    return [
        `${cell(0)} | ${cell(1)} | ${cell(2)}`,
        '---------',
        `${cell(3)} | ${cell(4)} | ${cell(5)}`,
        '---------',
        `${cell(6)} | ${cell(7)} | ${cell(8)}`,
    ].join('\n');
}

/**
 * @param {(null|'X'|'O')[]} board
 * @returns {number[]}
 */
function getAvailablePositions(board) {
    const available = [];
    for (let i = 0; i < board.length; i++) {
        if (board[i] === MARK.EMPTY) available.push(i);
    }
    return available;
}

/**
 * @param {'X'|'O'} mark
 * @param {'normal'|'hard'} difficulty
 * @param {(null|'X'|'O')[]} board
 * @returns {string}
 */
function buildMovePrompt(mark, difficulty, board) {
    const available = getAvailablePositions(board);
    const hardExtra =
        difficulty === 'hard'
            ? [
                  '',
                  'Play optimally.',
                  'Prioritize: (1) win now if possible, (2) block opponent wins, (3) take center, (4) take a corner, (5) otherwise any open cell.',
              ].join('\n')
            : '';

    return [
        'You are playing Tic-Tac-Toe.',
        '',
        `You are ${mark}.`,
        '',
        'Current board (positions 0-8 left-to-right, top-to-bottom):',
        '',
        formatBoard(board),
        '',
        `Available positions:`,
        '',
        available.join(','),
        hardExtra,
        '',
        'Return ONLY the position number.',
        'No explanation.',
        'No markdown.',
    ]
        .filter((line) => line !== null)
        .join('\n');
}

/**
 * @param {number[]} available
 * @returns {string}
 */
function buildRetryPrompt(available) {
    return [
        'Your previous answer was invalid.',
        '',
        'Return only one number from these options:',
        '',
        available.join(','),
    ].join('\n');
}

/**
 * @param {'X'|'O'} mark
 * @param {(null|'X'|'O')[]} board
 * @param {number} position
 * @returns {string}
 */
function buildPersonalityPrompt(mark, board, position) {
    return [
        'You just played Tic-Tac-Toe.',
        `You are ${mark} and played position ${position}.`,
        '',
        'Board now:',
        formatBoard(board),
        '',
        'Reply with ONE short in-character line about the move.',
        'Maximum 15 words.',
        'No chain-of-thought.',
        'Never expose internal reasoning.',
        'No quotes. No markdown.',
    ].join('\n');
}

module.exports = {
    formatBoard,
    getAvailablePositions,
    buildMovePrompt,
    buildRetryPrompt,
    buildPersonalityPrompt,
};
