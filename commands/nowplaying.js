const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');
const { controls } = require('./play');

function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

module.exports = {
    category: 'music',
    usage: '/nowplaying',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the song that is playing now'),

    async execute(interaction) {
        const guildId = interaction.guild.id;
        const song = musicManager.getCurrentSong(guildId);

        if (!song) {
            return interaction.reply({
                content: 'Nothing is playing.',
                ephemeral: true,
            });
        }

        const elapsed = formatTime(musicManager.getElapsedMs(guildId));
        // Live streams have no length, so show only the time played.
        const time = song.durationSec ? `${elapsed} / ${formatTime(song.durationSec * 1000)}` : `${elapsed} played`;

        await interaction.reply({
            content:
                `🎶 Now Playing\n**${song.title}**\n${song.url}\n` +
                `⏱️ ${time} · ` +
                `Requested by ${song.requestedBy} · Loop: ${musicManager.getLoop(guildId)}`,
            components: [controls],
        });
    },
};
