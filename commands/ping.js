const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong and latency information!'),
    async execute(interaction) {
        const sent = await interaction.reply({ content: 'Pinging....', fetchReply: true });
        const pingTime = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong! Latency is ${pingTime}ms\nAPI Latency is ${Math.round(interaction.client.ws.ping)}ms`);
    },
};