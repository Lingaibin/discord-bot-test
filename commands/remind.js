const { SlashCommandBuilder } = require('discord.js');

const MAX_REMIND_MS = 24 * 60 * 60 * 1000;

const WHEN_CHOICES = [
    { name: '5 minutes', value: '5m', ms: 5 * 60 * 1000 },
    { name: '15 minutes', value: '15m', ms: 15 * 60 * 1000 },
    { name: '30 minutes', value: '30m', ms: 30 * 60 * 1000 },
    { name: '1 hour', value: '1h', ms: 60 * 60 * 1000 },
    { name: '2 hours', value: '2h', ms: 2 * 60 * 60 * 1000 },
    { name: '4 hours', value: '4h', ms: 4 * 60 * 60 * 1000 },
    { name: '8 hours', value: '8h', ms: 8 * 60 * 60 * 1000 },
    { name: '12 hours', value: '12h', ms: 12 * 60 * 60 * 1000 },
    { name: '1 day', value: '1d', ms: MAX_REMIND_MS },
];

const whenByValue = new Map(WHEN_CHOICES.map((choice) => [choice.value, choice]));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder for yourself')
        .addStringOption((option) =>
            option
                .setName('when')
                .setDescription('When to remind you (max 1 day)')
                .setRequired(true)
                .addChoices(...WHEN_CHOICES.map(({ name, value }) => ({ name, value }))))
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('The text to show in the reminder')
                .setRequired(true)
                .setMaxLength(500)),
    async execute(interaction) {
        const when = interaction.options.getString('when');
        const message = interaction.options.getString('message');
        const choice = whenByValue.get(when);

        if (!choice || choice.ms > MAX_REMIND_MS) {
            return interaction.reply({
                content: 'Please choose a reminder time within the next 24 hours.',
                ephemeral: true,
            });
        }

        const remindAt = Math.floor((Date.now() + choice.ms) / 1000);
        const channelId = interaction.channelId;
        const userId = interaction.user.id;

        setTimeout(async () => {
            try {
                const channel = await interaction.client.channels.fetch(channelId);
                if (channel?.isSendable()) {
                    await channel.send(`Reminder for <@${userId}>:\n> ${message}`);
                }
            } catch (error) {
                console.error('Failed to send reminder:', error);
            }
        }, choice.ms);

        await interaction.reply({
            content: `I'll remind you in **${choice.name}** (<t:${remindAt}:R>):\n> ${message}`,
            ephemeral: true,
        });
    },
};
