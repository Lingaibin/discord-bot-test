const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/resume',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume playback'),

    async execute(interaction) {
        const resumed = musicManager.resume(interaction.guild.id);

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
