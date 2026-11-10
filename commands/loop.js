const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../musicManager');

const MESSAGES = {
    off: '➡️ Loop is off.',
    song: '🔂 Looping the current song. /skip still moves to the next one.',
    queue: '🔁 Looping the whole queue.',
};
const MODES = Object.keys(MESSAGES);

async function setMode(interaction, mode) {
    if (!musicManager.setLoop(interaction.guild.id, mode)) {
        return interaction.reply({
            content: 'Nothing is playing. Start a song with /play first.',
            ephemeral: true,
        });
    }

    await interaction.reply(MESSAGES[mode]);
}

module.exports = {
    category: 'music',
    usage: '/loop <mode>',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Repeat the current song or the whole queue')
        .addStringOption((option) =>
            option
                .setName('mode')
                .setDescription('What to repeat')
                .setRequired(true)
                .addChoices(
                    { name: 'Off', value: 'off' },
                    { name: 'Current song', value: 'song' },
                    { name: 'Whole queue', value: 'queue' },
                )),

    execute(interaction) {
        return setMode(interaction, interaction.options.getString('mode'));
    },

    // 🔁 button: off -> song -> queue -> off.
    cycle(interaction) {
        const current = MODES.indexOf(musicManager.getLoop(interaction.guild.id));
        return setMode(interaction, MODES[(current + 1) % MODES.length]);
    },
};
