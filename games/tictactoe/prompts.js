"use strict";

const { MARK } = require("./constants");

/**
 * Format a board for the move-selection prompt (0–8 indexing) as a 3x3 2D array.
 * @param {(null|'X'|'O')[]} board
 * @returns {string}
 */
function formatBoard(board) {
    const rows = [board.slice(0, 3), board.slice(3, 6), board.slice(6, 9)];
    return JSON.stringify(rows);
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
 * @param {(null|'X'|'O')[]} board
 * @returns {string}
 */
function buildMovePrompt(mark, board) {
    const available = getAvailablePositions(board);

    return [
        "You are playing Tic-Tac-Toe.",
        "",
        `You are ${mark}.`,
        "",
        "Current board as a 3x3 2D array (row-major, null = empty, positions 0-8 left-to-right top-to-bottom):",
        "",
        formatBoard(board),
        "",
        `Available positions:`,
        "",
        available.join(","),
        "",
        "Reply in EXACTLY this format: {i}, xxxxx",
        "Where {i} is the position number you choose, and xxxxx is a short in-character comment about your move (max 15 words).",
        "Example: 4, Center is mine now!",
        "No chain-of-thought. Never expose internal reasoning.",
        "No markdown. No extra lines.",
    ].join("\n");
}

/**
 * Ask for a short in-character comment about a move that has already been
 * decided (used for hard mode, where the move itself comes from minimax).
 *
 * @param {'X'|'O'} mark
 * @param {(null|'X'|'O')[]} board board *before* the move
 * @param {number} position
 * @returns {string}
 */
function buildCommentPrompt(mark, board, position) {
    const nextBoard = [...board];
    nextBoard[position] = mark;

    return [
        "You are playing Tic-Tac-Toe.",
        `You are ${mark} and just played position ${position}.`,
        "",
        "Board now as a 3x3 2D array (row-major, null = empty):",
        "",
        formatBoard(nextBoard),
        "",
        "Reply with ONE short in-character line about the move (max 15 words).",
        "No chain-of-thought. Never expose internal reasoning.",
        "No quotes. No markdown.",
    ].join("\n");
}

/**
 * @param {number[]} available
 * @returns {string}
 */
function buildRetryPrompt(available) {
    return [
        "Your previous answer was invalid.",
        "",
        "Reply in EXACTLY this format: {i}, xxxxx",
        "Where {i} is one number from these options, and xxxxx is a short comment.",
        "",
        available.join(","),
    ].join("\n");
}

module.exports = {
    formatBoard,
    getAvailablePositions,
    buildMovePrompt,
    buildCommentPrompt,
    buildRetryPrompt,
};
