const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../musicManager');
const { clearAutoLeaveTimer } = require('../utils/autoLeave');

module.exports = {
    category: 'music',
    usage: '/stop',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop playback and clear queue'),

    async execute(interaction) {
        const connection =
            getVoiceConnection(interaction.guild.id);

        if (!connection) {
            return interaction.reply({
                content:
                    'I am not connected to a voice channel.',
                ephemeral: true,
            });
        }

        musicManager.clear(interaction.guild.id);
        clearAutoLeaveTimer(interaction.guild.id);
        connection.destroy();

        await interaction.reply(
            '⏹️ Stopped playback and cleared queue.'
        );
    },
};
