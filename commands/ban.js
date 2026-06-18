const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option =>
        option.setName('target')
            .setDescription('The user to ban')
            .setRequired(true))
    .addStringOption(option => 
        option.setName('reason')
            .setDescription('Reason for banning')
            .setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
            return interaction.reply({ content: 'User not found in the server.', ephemeral: true });
        }

        if (!member.bannable) {
            return interaction.reply({ content: 'I cannot ban this user. They may have higher permissions than me.', ephemeral: true });
        }

        try {
            await member.ban({ reason });
            await interaction.reply({ content: `Successfully banned ${targetUser.tag} from the server.\nReason: ${reason}` });
        }catch (error) {
            console.error(`Failed to ban user: ${error}`);
            return interaction.reply({ content: 'There was an error trying to ban this user.', ephemeral: true });
        }
    }
}