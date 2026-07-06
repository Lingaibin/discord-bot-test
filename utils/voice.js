const {
    joinVoiceChannel,
    getVoiceConnection,
    entersState,
    VoiceConnectionStatus,
} = require('@discordjs/voice');

function logVoiceState(connection, oldState, newState) {
    const guildId = connection.joinConfig.guildId;
    console.log(`[voice:${guildId}] ${oldState.status} -> ${newState.status}`);
}

function attachConnectionHandlers(connection) {
    connection.on('stateChange', (oldState, newState) => {
        logVoiceState(connection, oldState, newState);
    });

    connection.on(VoiceConnectionStatus.Disconnected, async (_oldState, newState) => {
        console.warn(
            `[voice:${connection.joinConfig.guildId}] disconnected (${newState.reason ?? 'unknown'})`,
        );

        try {
            await Promise.race([
                entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
            ]);
        } catch {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
        }
    });
}

function connectToChannel(channel) {
    const guildId = channel.guild.id;
    const existing = getVoiceConnection(guildId);

    if (
        existing &&
        existing.joinConfig.channelId === channel.id &&
        existing.state.status !== VoiceConnectionStatus.Destroyed
    ) {
        return existing;
    }

    if (existing) {
        existing.destroy();
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
    });

    attachConnectionHandlers(connection);
    return connection;
}

async function waitUntilReady(connection, timeoutMs = 60_000) {
    if (connection.state.status === VoiceConnectionStatus.Ready) {
        return;
    }

    if (connection.state.status === VoiceConnectionStatus.Destroyed) {
        throw new Error('Voice connection was destroyed before it became ready.');
    }

    await entersState(connection, VoiceConnectionStatus.Ready, timeoutMs);
}

module.exports = {
    attachConnectionHandlers,
    connectToChannel,
    waitUntilReady,
};
