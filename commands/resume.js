const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume playback'),

    async execute(interaction) {
        const resumed = musicManager.resume();

        if (!resumed) {
            return interaction.reply({
                content: 'Nothing is paused right now.',
                ephemeral: true,
            });
        }

        await interaction.reply(
            '▶️ Playback resumed.'
        );
    },
};
