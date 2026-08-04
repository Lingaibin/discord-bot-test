const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

const musicManager = require('../musicManager');
const { player } = musicManager;
const { resolveVideo } = require('../utils/youtube');
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

        try {
            const connection = connectToChannel(channel);
            connection.subscribe(player);

            const { title, url } = await resolveVideo(query);

            const startedPlaying = await musicManager.addSong({
                title,
                url,
                guildId: interaction.guild.id,
                requestedBy: interaction.user.username,
            });

            const statusMessage = startedPlaying
                ? `🎶 Queued and starting\n**${title}**`
                : `➕ Added To Queue\n**${title}**`;

            await interaction.editReply(statusMessage);
        } catch (error) {
            console.error(error);

            const existing = getVoiceConnection(interaction.guild.id);
            if (existing) {
                existing.destroy();
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
