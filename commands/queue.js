const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/queue',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show current queue'),

    async execute(interaction) {
        const currentSong =
            musicManager.getCurrentSong(interaction.guild.id);

        const queue = musicManager.getQueue(interaction.guild.id);

        if (!currentSong && queue.length === 0) {
            return interaction.reply(
                '📭 Queue is empty.'
            );
        }

        let message = '';

        if (currentSong) {
            message +=
                `🎶 Now Playing\n` +
                `1. ${currentSong.title}\n${currentSong.url}\n\n`;
        }

        if (queue.length > 0) {
            message += '📋 Up Next\n';

            let shown = 0;

            for (const song of queue) {
                const line = `${shown + 1}. ${song.title}\n`;

                // Discord rejects messages over 2000 characters; leave room for the "more" line.
                if (message.length + line.length > 1900) {
                    break;
                }

                message += line;
                shown++;
            }

            if (shown < queue.length) {
                message += `…and ${queue.length - shown} more`;
            }
        }

        await interaction.reply(message);
    },
};