const {
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    NoSubscriberBehavior,
    getVoiceConnection,
} = require('@discordjs/voice');

const { createAudioStream } = require('./utils/youtube');
const { waitUntilReady } = require('./utils/voice');

// One player + queue per guild so servers never share playback.
const guilds = new Map();

function getGuild(guildId) {
    let state = guilds.get(guildId);

    if (state) {
        return state;
    }

    const player = createAudioPlayer({
        behaviors: {
            noSubscriber: NoSubscriberBehavior.Play,
        },
    });

    // loop: 'off' | 'song' | 'queue'. skipped: the current song ended via /skip, so don't repeat it.
    // textChannel: where /play was last used; song-change announcements go there.
    state = { guildId, player, queue: [], currentSong: null, isStarting: false, loop: 'off', skipped: false, textChannel: null };

    player.on(AudioPlayerStatus.Idle, async () => {
        await playNext(state);
    });

    player.on('error', async (error) => {
        if (error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
            console.warn(`[music:${guildId}] Stream ended early, moving to next song.`);
        } else {
            console.error(`[music:${guildId}] Audio player error:`, error.message ?? error);
        }

        // The player goes Idle right after an error and the Idle handler advances the queue.
        // Advancing here too would skip a song. Clearing currentSong stops loop mode replaying a broken song.
        state.currentSong = null;
    });

    guilds.set(guildId, state);
    return state;
}

async function playNext(state) {
    const finished = state.currentSong;

    if (finished && state.loop === 'song' && !state.skipped) {
        state.queue.unshift(finished);
    } else if (finished && state.loop === 'queue') {
        state.queue.push(finished);
    }

    state.skipped = false;

    if (state.queue.length === 0) {
        state.currentSong = null;
        announce(state, '✅ Queue finished. Use /play to add more songs.');
        return;
    }

    state.currentSong = state.queue.shift();

    // /play already replies for the song it starts; loop-song repeats would just spam.
    if (!state.isStarting && state.currentSong !== finished) {
        const { title, url, requestedBy } = state.currentSong;
        announce(state, `🎶 Now Playing\n**${title}**\n${url}\nRequested by ${requestedBy}`);
    }

    try {
        const connection = getVoiceConnection(state.guildId);

        if (!connection) {
            throw new Error('Bot is not connected to a voice channel.');
        }

        await waitUntilReady(connection);

        const { stream, type } = await createAudioStream(state.currentSong.url);

        const resource = createAudioResource(stream, {
            inputType: type,
            inlineVolume: true,
        });

        if (resource.volume) {
            resource.volume.setVolume(1);
        }

        state.player.play(resource);
    } catch (error) {
        console.error(`Failed to start playback for "${state.currentSong.title}":`, error);
        state.currentSong = null;
        await playNext(state);
    }
}

function announce(state, content) {
    state.textChannel?.send(content).catch((error) => {
        console.warn(`[music:${state.guildId}] Could not send announcement:`, error.message);
    });
}

module.exports = {
    getPlayer(guildId) {
        return getGuild(guildId).player;
    },

    getQueue(guildId) {
        return guilds.get(guildId)?.queue ?? [];
    },

    getCurrentSong(guildId) {
        return guilds.get(guildId)?.currentSong ?? null;
    },

    // Queues all songs before starting, so a playlist whose first song fails still plays the rest.
    async addSongs(songs, textChannel) {
        const state = getGuild(songs[0].guildId);
        state.textChannel = textChannel;
        const shouldStartPlaying = !state.currentSong && state.queue.length === 0 && !state.isStarting;

        state.queue.push(...songs);

        if (shouldStartPlaying) {
            state.isStarting = true;

            try {
                await playNext(state);
                return true;
            } finally {
                state.isStarting = false;
            }
        }

        return false;
    },

    clear(guildId) {
        const state = guilds.get(guildId);

        if (!state) {
            return;
        }

        state.queue.length = 0;
        state.currentSong = null;
        // stop() fires Idle -> playNext synchronously; /stop and /leave already reply, so stay quiet.
        state.textChannel = null;
        state.player.stop(true);
        guilds.delete(guildId);
    },

    skip(guildId) {
        const state = guilds.get(guildId);

        if (state) {
            // stop() is false when already idle; then no song ends and nothing should be marked skipped.
            state.skipped = state.player.stop();
        }
    },

    getElapsedMs(guildId) {
        return guilds.get(guildId)?.player.state.resource?.playbackDuration ?? 0;
    },

    getLoop(guildId) {
        return guilds.get(guildId)?.loop ?? 'off';
    },

    setLoop(guildId, mode) {
        const state = guilds.get(guildId);

        if (!state) {
            return false;
        }

        state.loop = mode;
        return true;
    },

    shuffle(guildId) {
        const queue = guilds.get(guildId)?.queue ?? [];

        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }

        return queue.length;
    },

    // position is 1-based, matching the "Up Next" numbers in /queue.
    remove(guildId, position) {
        const queue = guilds.get(guildId)?.queue;

        if (!queue || position < 1 || position > queue.length) {
            return null;
        }

        return queue.splice(position - 1, 1)[0];
    },

    pause(guildId) {
        return guilds.get(guildId)?.player.pause() ?? false;
    },

    resume(guildId) {
        return guilds.get(guildId)?.player.unpause() ?? false;
    },

    isPaused(guildId) {
        return guilds.get(guildId)?.player.state.status === AudioPlayerStatus.Paused;
    },
};
