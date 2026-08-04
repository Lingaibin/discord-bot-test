const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/pause',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current song'),

    async execute(interaction) {
        const paused = musicManager.pause();

        if (!paused) {
            return interaction.reply({
                content: 'Nothing is playing right now.',
                ephemeral: true,
            });
        }

        await interaction.reply(
            '⏸️ Playback paused.'
        );
    },
};
