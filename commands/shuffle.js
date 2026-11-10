const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

module.exports = {
    category: 'music',
    usage: '/shuffle',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the songs in Up Next'),

    async execute(interaction) {
        const count = musicManager.shuffle(interaction.guild.id);

        if (count < 2) {
            return interaction.reply({
                content: 'Need at least 2 songs in Up Next to shuffle.',
                ephemeral: true,
            });
        }

        await interaction.reply(`🔀 Shuffled ${count} songs.`);
    },
};
