const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/remove <position>',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a song from Up Next')
        .addIntegerOption((option) =>
            option
                .setName('position')
                .setDescription('Song number from the Up Next list in /queue')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        const position = interaction.options.getInteger('position');
        const song = musicManager.remove(interaction.guild.id, position);

        if (!song) {
            return interaction.reply({
                content: `There is no song #${position} in Up Next. Check /queue.`,
                ephemeral: true,
            });
        }

        await interaction.reply(`🗑️ Removed **${song.title}** from the queue.`);
    },
};
