'use strict';

const Player = require('./Player');

class HumanPlayer extends Player {
    /**
     * @param {{ id: string, name: string }} options
     */
    constructor({ id, name }) {
        super({ id, name, type: 'human' });
    }
}

module.exports = HumanPlayer;
