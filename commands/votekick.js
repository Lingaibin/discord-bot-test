const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');

const VOTE_DURATION_MS = 60 * 60 * 1000;

/** @type {Map<string, { guildId: string, targetId: string, reason: string, yesVoters: Set<string>, noVoters: Set<string>, requiredYes: number, eligibleCount: number, timeout: NodeJS.Timeout }>} */
const activeVotes = new Map();

function countEligibleVoters(guild, excludeUserId) {
    return guild.members.cache.filter((m) => !m.user.bot && m.id !== excludeUserId).size;
}

function requiredYesVotes(eligibleCount) {
    return Math.ceil(eligibleCount / 3);
}

function buildVoteEmbed({ targetUser, reason, initiator, yesCount, noCount, requiredYes, eligibleCount, status }) {
    const embed = new EmbedBuilder()
        .setTitle('Vote kick')
        .setColor(status === 'passed' ? 0x57f287 : status === 'failed' ? 0xed4245 : 0xfee75c)
        .setDescription(`Should **${targetUser.tag}** be kicked from the server?`)
        .addFields(
            { name: 'Reason', value: reason },
            { name: 'Started by', value: initiator.tag, inline: true },
            { name: 'Votes', value: `Yes: **${yesCount}** / **${requiredYes}** needed\nNo: **${noCount}**`, inline: true },
            { name: 'Eligible voters', value: `${eligibleCount} members (bots and target excluded)`, inline: true },
        )
        .setThumbnail(targetUser.displayAvatarURL())
        .setTimestamp();

    if (status === 'passed') {
        embed.setFooter({ text: 'Vote passed — user was kicked.' });
    } else if (status === 'failed') {
        embed.setFooter({ text: 'Vote ended without enough yes votes.' });
    } else {
        embed.setFooter({ text: 'Vote ends in 1 hour' });
    }

    return embed;
}

function endVote(voteId, status) {
    const vote = activeVotes.get(voteId);
    if (!vote) return null;
    clearTimeout(vote.timeout);
    activeVotes.delete(voteId);
    return vote;
}

async function finalizeVote(interaction, voteId, status, { kick = false } = {}) {
    const vote = endVote(voteId, status);
    if (!vote) return;

    const guild = interaction.guild;
    const channel = interaction.channel;
    const message = await channel.messages.fetch(interaction.message.id).catch(() => null);

    let kickResult = null;
    if (kick && guild) {
        const member = await guild.members.fetch(vote.targetId).catch(() => null);
        if (member?.kickable) {
            try {
                await member.kick(`Votekick passed: ${vote.reason}`);
                kickResult = 'kicked';
            } catch (error) {
                console.error('Votekick kick failed:', error);
                kickResult = 'error';
            }
        } else if (member) {
            kickResult = 'not_kickable';
        } else {
            kickResult = 'left';
        }
    }

    const targetUser = await interaction.client.users.fetch(vote.targetId).catch(() => null);
    const initiator = await interaction.client.users.fetch(vote.initiatorId).catch(() => ({ tag: 'Unknown' }));
    const yesCount = vote.yesVoters.size;
    const noCount = vote.noVoters.size;

    const embed = targetUser
        ? buildVoteEmbed({
              targetUser,
              reason: vote.reason,
              initiator,
              yesCount,
              noCount,
              requiredYes: vote.requiredYes,
              eligibleCount: vote.eligibleCount,
              status,
          })
        : null;

    if (embed && kickResult === 'kicked') {
        embed.setDescription(`**${targetUser.tag}** was kicked after the vote passed.`);
    } else if (embed && kickResult === 'not_kickable') {
        embed.setDescription(`Vote passed, but **${targetUser.tag}** could not be kicked (permissions).`);
        embed.setColor(0xed4245);
    } else if (embed && kickResult === 'left') {
        embed.setDescription(`Vote passed, but **${targetUser?.tag ?? 'the user'}** is no longer in the server.`);
    }

    const components = [];

    if (message && embed) {
        await message.edit({ embeds: [embed], components }).catch(console.error);
    }

    return { vote, kickResult };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('votekick')
        .setDescription('Start a vote to kick a user (passes at ~1/3 of non-bot members voting yes)')
        .addUserOption((option) =>
            option.setName('target').setDescription('The user to vote kick').setRequired(true),
        )
        .addStringOption((option) =>
            option.setName('reason').setDescription('Reason for the vote kick').setRequired(false),
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (targetUser.bot) {
            return interaction.reply({ content: 'You cannot votekick a bot.', ephemeral: true });
        }

        if (targetUser.id === interaction.user.id) {
            return interaction.reply({ content: 'You cannot votekick yourself.', ephemeral: true });
        }

        if (targetUser.id === interaction.guild.ownerId) {
            return interaction.reply({ content: 'You cannot votekick the server owner.', ephemeral: true });
        }

        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            return interaction.reply({ content: 'That user is not in this server.', ephemeral: true });
        }

        if (!targetMember.kickable) {
            return interaction.reply({
                content: 'That user cannot be kicked (they may have higher permissions than the bot).',
                ephemeral: true,
            });
        }

        for (const [, vote] of activeVotes) {
            if (vote.guildId === interaction.guild.id && vote.targetId === targetUser.id) {
                return interaction.reply({
                    content: 'There is already an active votekick for that user.',
                    ephemeral: true,
                });
            }
        }

        await interaction.guild.members.fetch();
        const eligibleCount = countEligibleVoters(interaction.guild, targetUser.id);
        const requiredYes = requiredYesVotes(eligibleCount);

        if (requiredYes < 1) {
            return interaction.reply({ content: 'Not enough members to start a votekick.', ephemeral: true });
        }

        const voteId = `${interaction.guild.id}-${targetUser.id}-${Date.now()}`;

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`votekick_yes_${voteId}`)
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`votekick_no_${voteId}`)
                .setLabel('No')
                .setStyle(ButtonStyle.Danger),
        );

        const embed = buildVoteEmbed({
            targetUser,
            reason,
            initiator: interaction.user,
            yesCount: 0,
            noCount: 0,
            requiredYes,
            eligibleCount,
            status: 'active',
        });

        const reply = await interaction.reply({
            embeds: [embed],
            components: [row],
            fetchReply: true,
        });

        const timeout = setTimeout(async () => {
            const vote = activeVotes.get(voteId);
            if (!vote) return;

            const channel = await interaction.client.channels.fetch(reply.channelId).catch(() => null);
            const message = await channel?.messages.fetch(reply.id).catch(() => null);
            if (!message) {
                endVote(voteId, 'failed');
                return;
            }

            const fakeInteraction = {
                guild: interaction.guild,
                channel,
                message,
                client: interaction.client,
            };
            await finalizeVote(fakeInteraction, voteId, 'failed');
        }, VOTE_DURATION_MS);

        activeVotes.set(voteId, {
            guildId: interaction.guild.id,
            targetId: targetUser.id,
            initiatorId: interaction.user.id,
            reason,
            yesVoters: new Set(),
            noVoters: new Set(),
            requiredYes,
            eligibleCount,
            timeout,
        });
    },

    async handleButton(interaction) {
        if (!interaction.customId.startsWith('votekick_')) return false;

        const parts = interaction.customId.split('_');
        const choice = parts[1];
        const voteId = parts.slice(2).join('_');

        const vote = activeVotes.get(voteId);
        if (!vote) {
            await interaction.reply({ content: 'This vote has ended or is no longer valid.', ephemeral: true });
            return true;
        }

        if (interaction.guild.id !== vote.guildId) {
            await interaction.reply({ content: 'This vote belongs to another server.', ephemeral: true });
            return true;
        }

        if (interaction.user.bot) {
            await interaction.reply({ content: 'Bots cannot vote.', ephemeral: true });
            return true;
        }

        const voterMember = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!voterMember || voterMember.user.bot) {
            await interaction.reply({ content: 'Only non-bot members can vote.', ephemeral: true });
            return true;
        }

        if (interaction.user.id === vote.targetId) {
            await interaction.reply({ content: 'The target cannot vote in their own votekick.', ephemeral: true });
            return true;
        }

        const userId = interaction.user.id;
        vote.yesVoters.delete(userId);
        vote.noVoters.delete(userId);

        if (choice === 'yes') {
            vote.yesVoters.add(userId);
        } else if (choice === 'no') {
            vote.noVoters.add(userId);
        }

        const targetUser = await interaction.client.users.fetch(vote.targetId);
        const initiator = await interaction.client.users.fetch(vote.initiatorId).catch(() => ({ tag: 'Unknown' }));

        const embed = buildVoteEmbed({
            targetUser,
            reason: vote.reason,
            initiator,
            yesCount: vote.yesVoters.size,
            noCount: vote.noVoters.size,
            requiredYes: vote.requiredYes,
            eligibleCount: vote.eligibleCount,
            status: 'active',
        });

        if (vote.yesVoters.size >= vote.requiredYes) {
            await interaction.deferUpdate();
            await finalizeVote(interaction, voteId, 'passed', { kick: true });
        } else {
            await interaction.update({ embeds: [embed] });
        }

        return true;
    },
};
