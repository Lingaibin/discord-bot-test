const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show current queue'),

    async execute(interaction) {
        const currentSong =
            musicManager.getCurrentSong();

        const queue = musicManager.queue;

        if (!currentSong && queue.length === 0) {
            return interaction.reply(
                '📭 Queue is empty.'
            );
        }

        let message = '';

        if (currentSong) {
            message +=
                `🎶 Now Playing\n` +
                `1. ${currentSong.title}\n\n`;
        }

        if (queue.length > 0) {
            message += '📋 Up Next\n';

            queue.forEach((song, index) => {
                message +=
                    `${index + 1}. ${song.title}\n`;
            });
        }

        await interaction.reply(message);
    },
};