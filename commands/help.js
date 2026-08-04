'use strict';

const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const CATEGORY_ORDER = ['music', 'ai', 'games', 'moderation', 'utility', 'developer'];
const CATEGORY_LABELS = {
    music: 'Music',
    ai: 'AI',
    games: 'Games',
    moderation: 'Moderation',
    utility: 'Utility',
    developer: 'Developer',
};

/**
 * Load command modules from this folder (cached by Node's require).
 * @returns {object[]}
 */
function discoverCommands() {
    const files = fs
        .readdirSync(__dirname)
        .filter((file) => file.endsWith('.js'));

    const commands = [];
    for (const file of files) {
        const command = require(path.join(__dirname, file));
        if (!command?.data || typeof command.execute !== 'function') continue;

        const name = command.data.name;
        commands.push({
            name,
            description: command.data.description || 'No description provided.',
            category: command.category || 'utility',
            usage: command.usage || `/${name}`,
            permissions: command.permissions || 'None',
        });
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name));
}

function buildOverviewEmbed(commands) {
    const grouped = new Map();
    for (const category of CATEGORY_ORDER) {
        grouped.set(category, []);
    }

    for (const command of commands) {
        const key = CATEGORY_ORDER.includes(command.category)
            ? command.category
            : 'utility';
        grouped.get(key).push(command);
    }

    const embed = new EmbedBuilder()
        .setTitle('Help')
        .setColor(0x5865f2)
        .setDescription(
            'Slash commands available on this bot.\n' +
                'Use `/help command:<name>` for details on a specific command.',
        )
        .setTimestamp();

    for (const category of CATEGORY_ORDER) {
        const list = grouped.get(category);
        if (!list?.length) continue;

        const value = list
            .map((cmd) => `\`${cmd.usage}\` — ${cmd.description}`)
            .join('\n');

        embed.addFields({
            name: CATEGORY_LABELS[category] || category,
            value: value.slice(0, 1024),
        });
    }

    return embed;
}

function buildCommandEmbed(command) {
    return new EmbedBuilder()
        .setTitle(`/${command.name}`)
        .setColor(0x5865f2)
        .setDescription(command.description)
        .addFields(
            { name: 'Usage', value: `\`${command.usage}\``, inline: true },
            {
                name: 'Category',
                value: CATEGORY_LABELS[command.category] || command.category,
                inline: true,
            },
            { name: 'Permissions', value: command.permissions, inline: true },
        )
        .setTimestamp();
}

module.exports = {
    category: 'utility',
    usage: '/help [command]',
    permissions: 'None',

    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('List bot commands or show details for one command')
        .addStringOption((option) =>
            option
                .setName('command')
                .setDescription('Command name to look up')
                .setRequired(false)
                .setAutocomplete(true),
        ),

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const choices = discoverCommands()
            .filter((cmd) => cmd.name.includes(focused))
            .slice(0, 25)
            .map((cmd) => ({ name: cmd.name, value: cmd.name }));

        await interaction.respond(choices);
    },

    async execute(interaction) {
        const commands = discoverCommands();
        const query = interaction.options.getString('command');

        if (query) {
            const match = commands.find(
                (cmd) => cmd.name.toLowerCase() === query.toLowerCase(),
            );

            if (!match) {
                return interaction.reply({
                    content: `Unknown command \`${query}\`. Use \`/help\` to see all commands.`,
                    ephemeral: true,
                });
            }

            return interaction.reply({ embeds: [buildCommandEmbed(match)] });
        }

        return interaction.reply({ embeds: [buildOverviewEmbed(commands)] });
    },
};
