'use strict';

const { randomUUID } = require('crypto');
const ollama = require('../../../ollama');
const Player = require('./Player');
const { MARK, DIFFICULTY, AI_DISPLAY_NAME, DEFAULT_OLLAMA_MODEL, OLLAMA_MOVE_TIMEOUT_MS } =
    require('../constants');
const {
    getAvailablePositions,
    buildMovePrompt,
    buildRetryPrompt,
    buildPersonalityPrompt,
} = require('../prompts');

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
     *   source: 'random'|'ollama'|'fallback',
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

        try {
            let position = await this.#requestPosition(board, mark, available, false);
            if (!isValidMove(position, available)) {
                position = await this.#requestPosition(board, mark, available, true);
            }

            if (!isValidMove(position, available)) {
                return {
                    position: pickRandom(available),
                    source: 'fallback',
                    notice: '🤖 AI unavailable. Making a random move.',
                };
            }

            let comment = null;
            if (this.personality) {
                comment = await this.#requestComment(board, mark, position).catch(() => null);
            }

            return { position, source: 'ollama', comment };
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
     * @param {(null|'X'|'O')[]} board
     * @param {'X'|'O'} mark
     * @param {number[]} available
     * @param {boolean} retry
     * @returns {Promise<number|null>}
     */
    async #requestPosition(board, mark, available, retry) {
        const prompt = retry
            ? buildRetryPrompt(available)
            : buildMovePrompt(mark, this.difficulty, board);

        const content = await this.#chat(prompt);
        return parsePosition(content);
    }

    /**
     * @param {(null|'X'|'O')[]} board
     * @param {'X'|'O'} mark
     * @param {number} position
     * @returns {Promise<string|null>}
     */
    async #requestComment(board, mark, position) {
        const nextBoard = [...board];
        nextBoard[position] = mark;
        const content = await this.#chat(buildPersonalityPrompt(mark, nextBoard, position));
        if (!content) return null;

        const cleaned = content
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
     * @param {string} prompt
     * @returns {Promise<string>}
     */
    async #chat(prompt) {
        const response = await withTimeout(
            ollama.chat({
                model: this.model,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
            }),
            this.timeoutMs,
            'Ollama request timed out',
        );

        return String(response?.message?.content ?? '').trim();
    }
}

/**
 * @param {string} text
 * @returns {number|null}
 */
function parsePosition(text) {
    if (!text) return null;
    const match = String(text).trim().match(/-?\d+/);
    if (!match) return null;
    const value = Number(match[0]);
    return Number.isInteger(value) ? value : null;
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
