'use strict';

const { randomUUID } = require('crypto');
const ollama = require('../../../ollama');
const Player = require('./Player');
const { MARK, DIFFICULTY, AI_DISPLAY_NAME, DEFAULT_OLLAMA_MODEL, OLLAMA_MOVE_TIMEOUT_MS } =
    require('../constants');
const {
    getAvailablePositions,
    buildMovePrompt,
    buildCommentPrompt,
    buildRetryPrompt,
} = require('../prompts');
const { getBestMove } = require('../minimax');

/**
 * AI opponent backed by the shared Ollama client.
 * Easy mode picks randomly and never calls Ollama.
 */
class OllamaPlayer extends Player {
    /**
     * @param {{
     *   id?: string,
     *   difficulty?: 'easy'|'normal'|'hard',
     *   model?: string,
     *   personality?: boolean,
     *   timeoutMs?: number,
     * }} [options]
     */
    constructor({
        id = `ollama:${randomUUID()}`,
        difficulty = DIFFICULTY.NORMAL,
        model = DEFAULT_OLLAMA_MODEL,
        personality = true,
        timeoutMs = OLLAMA_MOVE_TIMEOUT_MS,
    } = {}) {
        super({ id, name: AI_DISPLAY_NAME, type: 'ai' });
        this.difficulty = difficulty;
        this.model = model;
        this.personality = personality;
        this.timeoutMs = timeoutMs;
    }

    /**
     * Choose a legal board index (0–8).
     *
     * @param {(null|'X'|'O')[]} board
     * @param {'X'|'O'} mark
     * @returns {Promise<{
     *   position: number,
     *   source: 'random'|'ollama'|'minimax'|'fallback',
     *   notice?: string,
     *   comment?: string|null,
     * }>}
     */
    async getMove(board, mark = MARK.O) {
        const available = getAvailablePositions(board);
        if (available.length === 0) {
            throw new Error('No available moves.');
        }

        if (this.difficulty === DIFFICULTY.EASY) {
            return {
                position: pickRandom(available),
                source: 'random',
            };
        }

        if (this.difficulty === DIFFICULTY.HARD) {
            return this.#getHardMove(board, mark);
        }

        try {
            let { position, comment } = await this.#requestMove(board, mark, available, false);
            if (!isValidMove(position, available)) {
                ({ position, comment } = await this.#requestMove(board, mark, available, true));
            }

            if (!isValidMove(position, available)) {
                return {
                    position: pickRandom(available),
                    source: 'fallback',
                    notice: '🤖 AI unavailable. Making a random move.',
                };
            }

            return { position, source: 'ollama', comment: this.personality ? comment : null };
        } catch (error) {
            console.error('OllamaPlayer.getMove failed:', error);
            return {
                position: pickRandom(available),
                source: 'fallback',
                notice: '🤖 AI unavailable. Making a random move.',
            };
        }
    }

    /**
     * Hard mode: the move is always the minimax-optimal one (never loses).
     * Ollama is only asked for a short in-character comment about it.
     *
     * @param {(null|'X'|'O')[]} board
     * @param {'X'|'O'} mark
     * @returns {Promise<{ position: number, source: 'minimax', comment: string|null }>}
     */
    async #getHardMove(board, mark) {
        const position = getBestMove(board, mark);

        if (!this.personality) {
            return { position, source: 'minimax', comment: null };
        }

        try {
            const content = await this.#chat(buildCommentPrompt(mark, board, position));
            return { position, source: 'minimax', comment: cleanComment(content) };
        } catch (error) {
            console.error('OllamaPlayer hard-mode comment failed:', error);
            return { position, source: 'minimax', comment: null };
        }
    }

    /**
     * @param {(null|'X'|'O')[]} board
     * @param {'X'|'O'} mark
     * @param {number[]} available
     * @param {boolean} retry
     * @returns {Promise<{ position: number|null, comment: string|null }>}
     */
    async #requestMove(board, mark, available, retry) {
        const prompt = retry
            ? buildRetryPrompt(available)
            : buildMovePrompt(mark, board);

        const content = await this.#chat(prompt);
        console.debug('OllamaPlayer received content:', content);
        return parseMoveReply(content);
    }

    /**
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async #chat(prompt) {
        console.log('OllamaPlayer sending prompt to Ollama:', prompt);
        const response = await withTimeout(
            ollama.chat({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
            }),
            this.timeoutMs,
            'Ollama request timed out',
        );

        console.debug('OllamaPlayer chat response:', response);
        return String(response?.message?.content ?? '').trim();
    }
}

/**
 * Parse a "{i}, xxxxx" reply into a position and an optional comment.
 * Falls back to grabbing the first number if the model ignores the format.
 *
 * @param {string} text
 * @returns {{ position: number|null, comment: string|null }}
 */
function parseMoveReply(text) {
    if (!text) return { position: null, comment: null };
    const str = String(text).trim();

    const match = str.match(/^(-?\d+)\s*,\s*([\s\S]*)$/);
    if (match) {
        return { position: Number(match[1]), comment: cleanComment(match[2]) };
    }

    const numberOnly = str.match(/-?\d+/);
    return {
        position: numberOnly ? Number(numberOnly[0]) : null,
        comment: null,
    };
}

/**
 * @param {string} text
 * @returns {string|null}
 */
function cleanComment(text) {
    const cleaned = String(text)
        .replace(/^["'`]+|["'`]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return null;

    const words = cleaned.split(' ');
    if (words.length > 15) {
        return words.slice(0, 15).join(' ');
    }
    return cleaned.slice(0, 120);
}

/**
 * @param {number|null} position
 * @param {number[]} available
 */
function isValidMove(position, available) {
    return Number.isInteger(position) && position >= 0 && position <= 8 && available.includes(position);
}

/**
 * @param {number[]} available
 */
function pickRandom(available) {
    return available[Math.floor(Math.random() * available.length)];
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} message
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, message) {
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(message));
        }, ms);

        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}

module.exports = OllamaPlayer;
