'use strict';

const MARK = Object.freeze({
    X: 'X',
    O: 'O',
    EMPTY: null,
});

const GAME_STATUS = Object.freeze({
    IN_PROGRESS: 'in_progress',
    WON: 'won',
    DRAW: 'draw',
});

const CHALLENGE_STATUS = Object.freeze({
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    DECLINED: 'declined',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
});

/** How long the challenged player has to accept or decline. */
const CHALLENGE_TIMEOUT_MS = 60 * 1000;

/** How long a player has to make their move before forfeiting. */
const MOVE_TIMEOUT_MS = 60 * 1000;

/** How long to wait for an Ollama move before falling back to random. */
const OLLAMA_MOVE_TIMEOUT_MS = 25 * 1000;

const DIFFICULTY = Object.freeze({
    EASY: 'easy',
    NORMAL: 'normal',
    HARD: 'hard',
});

/** Same default model as `/chat`. */
const DEFAULT_OLLAMA_MODEL = 'llama3';

const AI_DISPLAY_NAME = '🤖 Ollama AI';

const WIN_LINES = Object.freeze([
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
]);

module.exports = {
    MARK,
    GAME_STATUS,
    CHALLENGE_STATUS,
    CHALLENGE_TIMEOUT_MS,
    MOVE_TIMEOUT_MS,
    OLLAMA_MOVE_TIMEOUT_MS,
    DIFFICULTY,
    DEFAULT_OLLAMA_MODEL,
    AI_DISPLAY_NAME,
    WIN_LINES,
};
