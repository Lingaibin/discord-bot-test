'use strict';

const TicTacToeGame = require('./Game');
const GameManager = require('./GameManager');
const constants = require('./constants');
const players = require('./players');
const prompts = require('./prompts');

module.exports = {
    TicTacToeGame,
    GameManager,
    ...constants,
    ...players,
    prompts,
};
