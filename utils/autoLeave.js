const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../musicManager');

const EMPTY_CHANNEL_TIMEOUT_MS = 60_000;
const timers = new Map();

function countHumanMembers(voiceChannel) {
    if (!voiceChannel) {
        return 0;
    }

    return voiceChannel.members.filter((member) => !member.user.bot).size;
}

function clearAutoLeaveTimer(guildId) {
    const timer = timers.get(guildId);

    if (timer) {
        clearTimeout(timer);
        timers.delete(guildId);
    }
}

function leaveVoiceChannel(guildId) {
    const connection = getVoiceConnection(guildId);

    if (!connection) {
        return;
    }

    musicManager.clear();
    connection.destroy();
    clearAutoLeaveTimer(guildId);
    console.log(`[voice:${guildId}] auto-left empty channel`);
}

function scheduleAutoLeave(guild, channelId) {
    clearAutoLeaveTimer(guild.id);

    const timer = setTimeout(() => {
        timers.delete(guild.id);

        const connection = getVoiceConnection(guild.id);

        if (!connection || connection.joinConfig.channelId !== channelId) {
            return;
        }

        const channel = guild.channels.cache.get(channelId);

        if (countHumanMembers(channel) === 0) {
            leaveVoiceChannel(guild.id);
        }
    }, EMPTY_CHANNEL_TIMEOUT_MS);

    timers.set(guild.id, timer);
    console.log(`[voice:${guild.id}] channel empty, auto-leaving in 1 minute`);
}

function checkChannelForAutoLeave(guild, channelId) {
    if (!channelId) {
        return;
    }

    const connection = getVoiceConnection(guild.id);

    if (!connection || connection.joinConfig.channelId !== channelId) {
        return;
    }

    const channel = guild.channels.cache.get(channelId);

    if (countHumanMembers(channel) === 0) {
        scheduleAutoLeave(guild, channelId);
    } else {
        clearAutoLeaveTimer(guild.id);
    }
}

function handleVoiceStateUpdate(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    const connection = getVoiceConnection(guild.id);

    if (!connection) {
        return;
    }

    const botChannelId = connection.joinConfig.channelId;
    const affectedChannels = new Set([oldState.channelId, newState.channelId].filter(Boolean));

    if (!affectedChannels.has(botChannelId)) {
        return;
    }

    checkChannelForAutoLeave(guild, botChannelId);
}

module.exports = {
    clearAutoLeaveTimer,
    handleVoiceStateUpdate,
};
