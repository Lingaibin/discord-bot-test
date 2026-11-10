const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../musicManager');
const { clearAutoLeaveTimer } = require('../utils/autoLeave');

module.exports = {
    category: 'music',
    usage: '/leave',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Stops the music and leaves the voice channel'),

    async execute(interaction) {
        const connection = getVoiceConnection(interaction.guild.id);

        if (!connection) {
            return interaction.reply({ content: 'I am not in a voice channel!', ephemeral: true });
        }

        musicManager.clear(interaction.guild.id);
        clearAutoLeaveTimer(interaction.guild.id);
        connection.destroy();

        return interaction.reply('👋 Left the voice channel.');
    },
};
