'use strict';

const { randomUUID } = require('crypto');
const TicTacToeGame = require('./Game');
const {
    CHALLENGE_STATUS,
    CHALLENGE_TIMEOUT_MS,
    MOVE_TIMEOUT_MS,
    GAME_STATUS,
} = require('./constants');

/**
 * Manages challenges and concurrent Tic-Tac-Toe sessions.
 *
 * Discord-agnostic: callers supply opaque player IDs and optional metadata
 * (channel/message IDs) for their own UI layer. Timeouts fire callbacks so
 * the controller can update Discord messages.
 */
class GameManager {
    constructor({
        challengeTimeoutMs = CHALLENGE_TIMEOUT_MS,
        moveTimeoutMs = MOVE_TIMEOUT_MS,
    } = {}) {
        this.challengeTimeoutMs = challengeTimeoutMs;
        this.moveTimeoutMs = moveTimeoutMs;

        /** @type {Map<string, object>} */
        this.challenges = new Map();
        /** @type {Map<string, TicTacToeGame>} */
        this.games = new Map();
        /** @type {Map<string, string>} playerId -> challengeId */
        this.playerChallenge = new Map();
        /** @type {Map<string, string>} playerId -> gameId */
        this.playerGame = new Map();
        /** @type {Map<string, NodeJS.Timeout>} */
        this.challengeTimers = new Map();
        /** @type {Map<string, NodeJS.Timeout>} */
        this.moveTimers = new Map();
        /** @type {Map<string, object>} gameId -> session metadata for UI */
        this.sessions = new Map();
    }

    /**
     * @param {string} playerId
     * @returns {boolean}
     */
    isBusy(playerId) {
        return this.playerChallenge.has(playerId) || this.playerGame.has(playerId);
    }

    /**
     * @param {string} playerId
     * @returns {TicTacToeGame|null}
     */
    getGameForPlayer(playerId) {
        const gameId = this.playerGame.get(playerId);
        return gameId ? this.games.get(gameId) ?? null : null;
    }

    /**
     * @param {string} gameId
     * @returns {TicTacToeGame|null}
     */
    getGame(gameId) {
        return this.games.get(gameId) ?? null;
    }

    /**
     * @param {string} challengeId
     * @returns {object|null}
     */
    getChallenge(challengeId) {
        return this.challenges.get(challengeId) ?? null;
    }

    /**
     * @param {string} gameId
     * @returns {object|null}
     */
    getSession(gameId) {
        return this.sessions.get(gameId) ?? null;
    }

    /**
     * Create a pending challenge from challengerId to opponentId.
     *
     * @param {{
     *   challengerId: string,
     *   opponentId: string,
     *   guildId?: string,
     *   channelId?: string,
     *   meta?: object,
     *   onExpire?: (challenge: object) => void | Promise<void>,
     * }} options
     * @returns {{ ok: true, challenge: object } | { ok: false, error: string }}
     */
    createChallenge({ challengerId, opponentId, guildId, channelId, meta, onExpire }) {
        if (!challengerId || !opponentId) {
            return { ok: false, error: 'Both players are required.' };
        }
        if (challengerId === opponentId) {
            return { ok: false, error: 'You cannot challenge yourself.' };
        }
        if (this.isBusy(challengerId)) {
            return { ok: false, error: 'You are already in a challenge or game.' };
        }
        if (this.isBusy(opponentId)) {
            return { ok: false, error: 'That player is already in a challenge or game.' };
        }

        const id = randomUUID();
        const challenge = {
            id,
            challengerId,
            opponentId,
            guildId: guildId ?? null,
            channelId: channelId ?? null,
            status: CHALLENGE_STATUS.PENDING,
            createdAt: Date.now(),
            meta: meta ?? {},
        };

        this.challenges.set(id, challenge);
        this.playerChallenge.set(challengerId, id);
        this.playerChallenge.set(opponentId, id);

        const timer = setTimeout(() => {
            void this.#expireChallenge(id, onExpire);
        }, this.challengeTimeoutMs);
        this.challengeTimers.set(id, timer);

        return { ok: true, challenge };
    }

    /**
     * @param {string} challengeId
     * @param {string} actorId player accepting
     * @param {{
     *   meta?: object,
     *   onMoveTimeout?: (payload: { game: TicTacToeGame, session: object, timedOutPlayerId: string, winnerId: string }) => void | Promise<void>,
     * }} [options]
     * @returns {{ ok: true, game: TicTacToeGame, session: object } | { ok: false, error: string }}
     */
    acceptChallenge(challengeId, actorId, { meta, onMoveTimeout } = {}) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.status !== CHALLENGE_STATUS.PENDING) {
            return { ok: false, error: 'This challenge is no longer valid.' };
        }
        if (actorId !== challenge.opponentId) {
            return { ok: false, error: 'Only the challenged player can accept.' };
        }

        this.#clearChallengeTimer(challengeId);
        challenge.status = CHALLENGE_STATUS.ACCEPTED;

        this.playerChallenge.delete(challenge.challengerId);
        this.playerChallenge.delete(challenge.opponentId);
        this.challenges.delete(challengeId);

        // Challenger is X (goes first); opponent is O.
        const game = new TicTacToeGame({
            id: randomUUID(),
            playerXId: challenge.challengerId,
            playerOId: challenge.opponentId,
        });

        const session = {
            gameId: game.id,
            guildId: challenge.guildId,
            channelId: challenge.channelId,
            messageId: null,
            meta: { ...challenge.meta, ...(meta ?? {}) },
            onMoveTimeout: onMoveTimeout ?? null,
            createdAt: Date.now(),
        };

        this.games.set(game.id, game);
        this.sessions.set(game.id, session);
        this.playerGame.set(game.playerXId, game.id);
        this.playerGame.set(game.playerOId, game.id);
        this.#armMoveTimer(game.id);

        return { ok: true, game, session };
    }

    /**
     * @param {string} challengeId
     * @param {string} actorId
     * @returns {{ ok: true, challenge: object } | { ok: false, error: string }}
     */
    declineChallenge(challengeId, actorId) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.status !== CHALLENGE_STATUS.PENDING) {
            return { ok: false, error: 'This challenge is no longer valid.' };
        }
        if (actorId !== challenge.opponentId && actorId !== challenge.challengerId) {
            return { ok: false, error: 'You are not part of this challenge.' };
        }

        // Either party may cancel/decline a pending challenge.
        this.#clearChallengeTimer(challengeId);
        challenge.status =
            actorId === challenge.opponentId
                ? CHALLENGE_STATUS.DECLINED
                : CHALLENGE_STATUS.CANCELLED;

        this.playerChallenge.delete(challenge.challengerId);
        this.playerChallenge.delete(challenge.opponentId);
        this.challenges.delete(challengeId);

        return { ok: true, challenge };
    }

    /**
     * Start a game immediately (no challenge), e.g. Human vs AI.
     *
     * @param {{
     *   playerXId: string,
     *   playerOId: string,
     *   guildId?: string,
     *   channelId?: string,
     *   meta?: object,
     *   onMoveTimeout?: (payload: { game: TicTacToeGame, session: object, timedOutPlayerId: string, winnerId: string }) => void | Promise<void>,
     *   busyPlayerIds?: string[],
     * }} options
     * @returns {{ ok: true, game: TicTacToeGame, session: object } | { ok: false, error: string }}
     */
    startGame({
        playerXId,
        playerOId,
        guildId,
        channelId,
        meta,
        onMoveTimeout,
        busyPlayerIds,
    }) {
        if (!playerXId || !playerOId) {
            return { ok: false, error: 'Both players are required.' };
        }
        if (playerXId === playerOId) {
            return { ok: false, error: 'Players must be distinct.' };
        }

        const toCheck = busyPlayerIds ?? [playerXId, playerOId];
        for (const playerId of toCheck) {
            if (this.isBusy(playerId)) {
                return { ok: false, error: 'You are already in a challenge or game.' };
            }
        }

        const game = new TicTacToeGame({
            id: randomUUID(),
            playerXId,
            playerOId,
        });

        const session = {
            gameId: game.id,
            guildId: guildId ?? null,
            channelId: channelId ?? null,
            messageId: null,
            meta: meta ?? {},
            onMoveTimeout: onMoveTimeout ?? null,
            createdAt: Date.now(),
        };

        this.games.set(game.id, game);
        this.sessions.set(game.id, session);
        this.playerGame.set(game.playerXId, game.id);
        this.playerGame.set(game.playerOId, game.id);
        this.#armMoveTimer(game.id);

        return { ok: true, game, session };
    }

    /**
     * Attach Discord message id (or other UI handle) after the board is posted.
     * @param {string} gameId
     * @param {{ messageId?: string, channelId?: string, meta?: object }} patch
     */
    updateSession(gameId, patch) {
        const session = this.sessions.get(gameId);
        if (!session) return;
        if (patch.messageId !== undefined) session.messageId = patch.messageId;
        if (patch.channelId !== undefined) session.channelId = patch.channelId;
        if (patch.meta) session.meta = { ...session.meta, ...patch.meta };
    }

    /**
     * @param {string} gameId
     * @param {string} playerId
     * @param {number} position
     * @returns {{ ok: true, game: TicTacToeGame, result: object } | { ok: false, error: string }}
     */
    makeMove(gameId, playerId, position) {
        const game = this.games.get(gameId);
        if (!game) {
            return { ok: false, error: 'This game no longer exists.' };
        }

        const result = game.makeMove(playerId, position);
        if (!result.ok) return result;

        if (result.status === GAME_STATUS.IN_PROGRESS) {
            this.#armMoveTimer(gameId);
        } else {
            this.#endGame(gameId);
        }

        return { ok: true, game, result };
    }

    /**
     * Force-end a game (e.g. channel deleted). Winner optional.
     * @param {string} gameId
     * @param {{ reason?: string }} [options]
     */
    abandonGame(gameId, { reason } = {}) {
        const game = this.games.get(gameId);
        if (!game) return null;
        this.#endGame(gameId);
        return { game, reason: reason ?? 'abandoned' };
    }

    /**
     * Remove all state. Useful for tests / shutdown.
     */
    clear() {
        for (const timer of this.challengeTimers.values()) clearTimeout(timer);
        for (const timer of this.moveTimers.values()) clearTimeout(timer);
        this.challengeTimers.clear();
        this.moveTimers.clear();
        this.challenges.clear();
        this.games.clear();
        this.sessions.clear();
        this.playerChallenge.clear();
        this.playerGame.clear();
    }

    /**
     * @param {string} challengeId
     * @param {(challenge: object) => void | Promise<void>} [onExpire]
     */
    async #expireChallenge(challengeId, onExpire) {
        const challenge = this.challenges.get(challengeId);
        if (!challenge || challenge.status !== CHALLENGE_STATUS.PENDING) return;

        this.#clearChallengeTimer(challengeId);
        challenge.status = CHALLENGE_STATUS.EXPIRED;
        this.playerChallenge.delete(challenge.challengerId);
        this.playerChallenge.delete(challenge.opponentId);
        this.challenges.delete(challengeId);

        if (typeof onExpire === 'function') {
            try {
                await onExpire(challenge);
            } catch (error) {
                console.error('Challenge expire callback failed:', error);
            }
        }
    }

    /**
     * @param {string} gameId
     */
    #armMoveTimer(gameId) {
        this.#clearMoveTimer(gameId);

        const game = this.games.get(gameId);
        const session = this.sessions.get(gameId);
        if (!game || game.status !== GAME_STATUS.IN_PROGRESS) return;

        // AI (and similar) players are driven by the controller — do not forfeit them.
        const skipIds = session?.meta?.noTimeoutPlayerIds;
        if (Array.isArray(skipIds) && skipIds.includes(game.currentPlayerId)) {
            return;
        }

        const timer = setTimeout(() => {
            void this.#handleMoveTimeout(gameId);
        }, this.moveTimeoutMs);
        this.moveTimers.set(gameId, timer);
    }

    /**
     * @param {string} gameId
     */
    async #handleMoveTimeout(gameId) {
        const game = this.games.get(gameId);
        const session = this.sessions.get(gameId);
        if (!game || game.status !== GAME_STATUS.IN_PROGRESS) return;

        const timedOutPlayerId = game.currentPlayerId;
        const forfeitResult = game.forfeit(timedOutPlayerId);
        this.#endGame(gameId);

        if (forfeitResult.ok && typeof session?.onMoveTimeout === 'function') {
            try {
                await session.onMoveTimeout({
                    game,
                    session,
                    timedOutPlayerId,
                    winnerId: forfeitResult.winnerId,
                });
            } catch (error) {
                console.error('Move timeout callback failed:', error);
            }
        }
    }

    /**
     * @param {string} gameId
     */
    #endGame(gameId) {
        this.#clearMoveTimer(gameId);
        const game = this.games.get(gameId);
        if (game) {
            this.playerGame.delete(game.playerXId);
            this.playerGame.delete(game.playerOId);
        }
        this.games.delete(gameId);
        this.sessions.delete(gameId);
    }

    /**
     * @param {string} challengeId
     */
    #clearChallengeTimer(challengeId) {
        const timer = this.challengeTimers.get(challengeId);
        if (timer) {
            clearTimeout(timer);
            this.challengeTimers.delete(challengeId);
        }
    }

    /**
     * @param {string} gameId
     */
    #clearMoveTimer(gameId) {
        const timer = this.moveTimers.get(gameId);
        if (timer) {
            clearTimeout(timer);
            this.moveTimers.delete(gameId);
        }
    }
}

module.exports = GameManager;