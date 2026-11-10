const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

const musicManager = require('../musicManager');
const { resolveSongs } = require('../utils/youtube');
const { connectToChannel } = require('../utils/voice');

module.exports = {
    category: 'music',
    usage: '/play <query>',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from YouTube')
        .addStringOption((option) =>
            option
                .setName('query')
                .setDescription('YouTube URL or search term')
                .setRequired(true),
        ),

    async execute(interaction) {
        const query = interaction.options.getString('query');
        const channel = interaction.member.voice.channel;

        if (!channel) {
            return interaction.reply({
                content: 'Join a voice channel first.',
                ephemeral: true,
            });
        }

        await interaction.deferReply();

        const wasConnected = Boolean(getVoiceConnection(interaction.guild.id));

        try {
            // Resolve first so a bad query never touches the voice connection.
            const songs = await resolveSongs(query);

            const connection = connectToChannel(channel);
            connection.subscribe(musicManager.getPlayer(interaction.guild.id));

            const startedPlaying = await musicManager.addSongs(songs.map((song) => ({
                ...song,
                guildId: interaction.guild.id,
                requestedBy: interaction.user.username,
            })), interaction.channel);

            const { title, url } = songs[0];
            let header;

            if (songs.length > 1) {
                header = startedPlaying
                    ? `🎶 Queued ${songs.length} songs from the playlist, starting with`
                    : `➕ Added ${songs.length} songs from the playlist to the queue, beginning with`;
            } else {
                header = startedPlaying ? '🎶 Queued and starting' : '➕ Added To Queue';
            }

            await interaction.editReply(`${header}\n**${title}**\n${url}`);
        } catch (error) {
            console.error(error);

            // Only tear down a connection this command created; never kill existing playback.
            if (!wasConnected) {
                getVoiceConnection(interaction.guild.id)?.destroy();
            }

            let message = 'Failed to play the requested song.';

            if (error.message?.includes('No results found')) {
                message = error.message;
            } else if (error.message?.includes('yt-dlp') || error.message?.includes('YT_DLP')) {
                message =
                    'Failed to stream from YouTube. Make sure yt-dlp is available (it downloads automatically on first play) or set YT_DLP_PATH to a local yt-dlp binary.';
            }

            await interaction.editReply(message);
        }
    },
};
