const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

const musicManager = require('../musicManager');
const { resolveSongs } = require('../utils/youtube');
const { connectToChannel } = require('../utils/voice');
const pause = require('./pause');
const resume = require('./resume');
const skip = require('./skip');
const stop = require('./stop');
const loop = require('./loop');

// Buttons reuse the slash commands, so a click replies exactly like typing /pause, /skip, etc.
const BUTTON_ACTIONS = {
    music_toggle: (i) => (musicManager.isPaused(i.guild.id) ? resume : pause).execute(i),
    music_skip: (i) => skip.execute(i),
    music_stop: (i) => stop.execute(i),
    music_loop: (i) => loop.cycle(i),
};

const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_toggle').setEmoji('⏯️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary),
);

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

            await interaction.editReply({ content: `${header}\n**${title}**\n${url}`, components: [controls] });
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

    controls,

    async handleButton(interaction) {
        const action = BUTTON_ACTIONS[interaction.customId];
        if (!action) return false;

        await action(interaction);
        return true;
    },
};
