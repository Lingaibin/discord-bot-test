'use strict';

const { MARK, GAME_STATUS, WIN_LINES } = require('./constants');

/**
 * Discord-agnostic Tic-Tac-Toe engine.
 *
 * Players are opaque string IDs (e.g. Discord user IDs today; synthetic IDs
 * for AI opponents in a future phase). The engine never imports Discord APIs.
 */
class TicTacToeGame {
    /**
     * @param {{ id: string, playerXId: string, playerOId: string }} options
     */
    constructor({ id, playerXId, playerOId }) {
        if (!id || !playerXId || !playerOId) {
            throw new Error('Game requires id, playerXId, and playerOId.');
        }
        if (playerXId === playerOId) {
            throw new Error('Players must be distinct.');
        }

        this.id = id;
        /** @type {(null|'X'|'O')[]} */
        this.board = Array(9).fill(MARK.EMPTY);
        this.playerXId = playerXId;
        this.playerOId = playerOId;
        this.currentMark = MARK.X;
        this.status = GAME_STATUS.IN_PROGRESS;
        /** @type {string|null} */
        this.winnerId = null;
        /** @type {number[]|null} */
        this.winningLine = null;
        this.createdAt = Date.now();
        this.updatedAt = this.createdAt;
    }

    /** @returns {string} */
    get currentPlayerId() {
        return this.currentMark === MARK.X ? this.playerXId : this.playerOId;
    }

    /**
     * @param {string} playerId
     * @returns {boolean}
     */
    isPlayer(playerId) {
        return playerId === this.playerXId || playerId === this.playerOId;
    }

    /**
     * @param {string} playerId
     * @returns {'X'|'O'|null}
     */
    getMarkForPlayer(playerId) {
        if (playerId === this.playerXId) return MARK.X;
        if (playerId === this.playerOId) return MARK.O;
        return null;
    }

    /**
     * @param {string} playerId
     * @returns {string|null} opponent player id
     */
    getOpponentId(playerId) {
        if (playerId === this.playerXId) return this.playerOId;
        if (playerId === this.playerOId) return this.playerXId;
        return null;
    }

    /**
     * Attempt a move. Returns a result object; never throws for invalid play.
     *
     * @param {string} playerId
     * @param {number} position 0–8
     * @returns {{ ok: true, status: string, winnerId: string|null, winningLine: number[]|null } | { ok: false, error: string }}
     */
    makeMove(playerId, position) {
        if (this.status !== GAME_STATUS.IN_PROGRESS) {
            return { ok: false, error: 'This game has already ended.' };
        }

        if (!this.isPlayer(playerId)) {
            return { ok: false, error: 'You are not a player in this game.' };
        }

        if (playerId !== this.currentPlayerId) {
            return { ok: false, error: 'It is not your turn.' };
        }

        if (!Number.isInteger(position) || position < 0 || position > 8) {
            return { ok: false, error: 'Invalid board position.' };
        }

        if (this.board[position] !== MARK.EMPTY) {
            return { ok: false, error: 'That cell is already taken.' };
        }

        this.board[position] = this.currentMark;
        this.updatedAt = Date.now();

        const win = this.#findWinningLine(this.currentMark);
        if (win) {
            this.status = GAME_STATUS.WON;
            this.winnerId = playerId;
            this.winningLine = win;
            return {
                ok: true,
                status: this.status,
                winnerId: this.winnerId,
                winningLine: this.winningLine,
            };
        }

        if (this.board.every((cell) => cell !== MARK.EMPTY)) {
            this.status = GAME_STATUS.DRAW;
            return {
                ok: true,
                status: this.status,
                winnerId: null,
                winningLine: null,
            };
        }

        this.currentMark = this.currentMark === MARK.X ? MARK.O : MARK.X;
        return {
            ok: true,
            status: this.status,
            winnerId: null,
            winningLine: null,
        };
    }

    /**
     * End the game by forfeit (e.g. move timeout). The other player wins.
     *
     * @param {string} forfeitingPlayerId
     * @returns {{ ok: true, status: string, winnerId: string } | { ok: false, error: string }}
     */
    forfeit(forfeitingPlayerId) {
        if (this.status !== GAME_STATUS.IN_PROGRESS) {
            return { ok: false, error: 'This game has already ended.' };
        }

        if (!this.isPlayer(forfeitingPlayerId)) {
            return { ok: false, error: 'Player is not in this game.' };
        }

        const winnerId = this.getOpponentId(forfeitingPlayerId);
        this.status = GAME_STATUS.WON;
        this.winnerId = winnerId;
        this.winningLine = null;
        this.updatedAt = Date.now();

        return { ok: true, status: this.status, winnerId };
    }

    /**
     * Snapshot safe for logging or UI without mutating engine state.
     * @returns {object}
     */
    toJSON() {
        return {
            id: this.id,
            board: [...this.board],
            playerXId: this.playerXId,
            playerOId: this.playerOId,
            currentMark: this.currentMark,
            currentPlayerId: this.currentPlayerId,
            status: this.status,
            winnerId: this.winnerId,
            winningLine: this.winningLine ? [...this.winningLine] : null,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
        };
    }

    /**
     * @param {'X'|'O'} mark
     * @returns {number[]|null}
     */
    #findWinningLine(mark) {
        for (const line of WIN_LINES) {
            if (line.every((i) => this.board[i] === mark)) {
                return [...line];
            }
        }
        return null;
    }
}

module.exports = TicTacToeGame;
