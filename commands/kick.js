const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option =>
        option.setName('target')
            .setDescription('The user to kick')
            .setRequired(true))
    .addStringOption(option => 
        option.setName('reason')
            .setDescription('Reason for kicking')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: 'User not found in the server.', ephemeral: true });
        }

        if (!member.kickable) {
            return interaction.reply({ content: 'I cannot kick this user. They may have higher permissions than me.', ephemeral: true });
        }

        try {
            await member.kick(reason);
            await interaction.reply({ content: `Successfully kicked ${targetUser.tag} from the server.\nReason: ${reason}` });
        }catch (error) {
            console.error(`Failed to kick user: ${error}`);
            return interaction.reply({ content: 'There was an error trying to kick this user.', ephemeral: true });
        }
    }
}