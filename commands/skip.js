const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),

    async execute(interaction) {
        const currentSong =
            musicManager.getCurrentSong();

        if (!currentSong) {
            return interaction.reply({
                content: 'Nothing is playing.',
                ephemeral: true,
            });
        }

        musicManager.skip();

        await interaction.reply(
            `⏭️ Skipped **${currentSong.title}**`
        );
    },
};