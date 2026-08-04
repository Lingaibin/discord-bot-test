'use strict';

/**
 * @typedef {'human'|'ai'} PlayerType
 */

/**
 * Shared player shape for Discord humans and AI opponents.
 * The game engine only uses `id`; display and move selection live outside it.
 */
class Player {
    /**
     * @param {{ id: string, name: string, type: PlayerType }} options
     */
    constructor({ id, name, type }) {
        if (!id || !name || !type) {
            throw new Error('Player requires id, name, and type.');
        }
        this.id = id;
        this.name = name;
        this.type = type;
    }

    /**
     * @returns {{ id: string, name: string, type: PlayerType }}
     */
    toJSON() {
        return { id: this.id, name: this.name, type: this.type };
    }
}

module.exports = Player;
