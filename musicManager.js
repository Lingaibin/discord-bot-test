const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    getVoiceConnection,
} = require('@discordjs/voice');

const { createAudioStream } = require('./utils/youtube');
const { waitUntilReady } = require('./utils/voice');

const player = createAudioPlayer({
    behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
    },
});

const queue = [];
let currentSong = null;
let isStarting = false;

async function playNext() {
    if (queue.length === 0) {
        currentSong = null;
        return;
    }

    currentSong = queue.shift();

    try {
        const connection = getVoiceConnection(currentSong.guildId);

        if (!connection) {
            throw new Error('Bot is not connected to a voice channel.');
        }

        await waitUntilReady(connection);

        const { stream, type } = await createAudioStream(currentSong.url);

        const resource = createAudioResource(stream, {
            inputType: type,
            inlineVolume: true,
        });

        if (resource.volume) {
            resource.volume.setVolume(1);
        }

        player.play(resource);
    } catch (error) {
        console.error(`Failed to start playback for "${currentSong.title}":`, error);
        currentSong = null;
        await playNext();
    }
}

player.on(AudioPlayerStatus.Idle, async () => {
    await playNext();
});

player.on('error', async (error) => {
    if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
        console.warn('Stream ended early, moving to next song.');
    } else {
        console.error('Audio player error:', error.message ?? error);
    }

    currentSong = null;
    await playNext();
});

module.exports = {
    player,
    queue,

    getCurrentSong() {
        return currentSong;
    },

    async addSong(song) {
        const shouldStartPlaying = !currentSong && queue.length === 0 && !isStarting;

        queue.push(song);

        if (shouldStartPlaying) {
            isStarting = true;

            try {
                await playNext();
                return true;
            } finally {
                isStarting = false;
            }
        }

        return false;
    },

    clear() {
        queue.length = 0;
        currentSong = null;
        player.stop(true);
    },

    skip() {
        player.stop();
    },

    pause() {
        return player.pause();
    },

    resume() {
        return player.unpause();
    },

    stop() {
        queue.length = 0;
        currentSong = null;
        player.stop(true);
    },
};
