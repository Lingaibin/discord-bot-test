const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/skip',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    async execute(interaction) {
        const currentSong =
            musicManager.getCurrentSong(interaction.guild.id);

        if (!currentSong) {
            return interaction.reply({
                content: 'Nothing is playing.',
                ephemeral: true,
            });
        }

        musicManager.skip(interaction.guild.id);

        await interaction.reply(
            `⏭️ Skipped **${currentSong.title}**`
        );
    },
};