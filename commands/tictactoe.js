'use strict';

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
} = require('discord.js');
const {
    GameManager,
    HumanPlayer,
    OllamaPlayer,
    MARK,
    GAME_STATUS,
    DIFFICULTY,
    CHALLENGE_TIMEOUT_MS,
    MOVE_TIMEOUT_MS,
} = require('../games/tictactoe');

const manager = new GameManager();

const MARK_LABEL = {
    [MARK.X]: 'X',
    [MARK.O]: 'O',
};

/**
 * @param {string} playerId
 * @param {Map<string, { id: string, name: string, type: string }>|object} players
 */
function formatPlayer(playerId, players) {
    const info = players instanceof Map ? players.get(playerId) : players?.[playerId];
    if (info?.type === 'ai') return info.name;
    if (info?.name && info.type === 'human') return `<@${playerId}>`;
    return `<@${playerId}>`;
}

/**
 * @param {object} session
 * @returns {Map<string, object>}
 */
function playersFromSession(session) {
    const map = new Map();
    const list = session?.meta?.players;
    if (Array.isArray(list)) {
        for (const p of list) map.set(p.id, p);
    }
    return map;
}

function buildChallengeEmbed({ challenger, opponent, status }) {
    const embed = new EmbedBuilder()
        .setTitle('Tic-Tac-Toe Challenge')
        .setTimestamp();

    if (status === 'pending') {
        embed
            .setColor(0x5865f2)
            .setDescription(
                `${mention(challenger.id)} challenged ${mention(opponent.id)} to a game of Tic-Tac-Toe!\n\n` +
                    `${mention(opponent.id)}, do you accept?`,
            )
            .setFooter({
                text: `Expires in ${Math.round(CHALLENGE_TIMEOUT_MS / 1000)} seconds`,
            });
    } else if (status === 'declined') {
        embed
            .setColor(0xed4245)
            .setDescription(`${mention(opponent.id)} declined the challenge.`);
    } else if (status === 'cancelled') {
        embed
            .setColor(0xed4245)
            .setDescription(`${mention(challenger.id)} cancelled the challenge.`);
    } else if (status === 'expired') {
        embed
            .setColor(0x95a5a6)
            .setDescription('This challenge expired.');
    }

    return embed;
}

function mention(userId) {
    return `<@${userId}>`;
}

/**
 * @param {import('../games/tictactoe').TicTacToeGame} game
 * @param {Map<string, object>} players
 * @param {{ title?: string, footer?: string, color?: number, statusLine?: string }} [options]
 */
function buildGameEmbed(game, players, { title, footer, color, statusLine } = {}) {
    const xLabel = `**${MARK_LABEL[MARK.X]}:** ${formatPlayer(game.playerXId, players)}`;
    const oLabel = `**${MARK_LABEL[MARK.O]}:** ${formatPlayer(game.playerOId, players)}`;

    let description = `**Players**\n${xLabel}\n${oLabel}\n\n`;
    let embedColor = color ?? 0x5865f2;

    if (statusLine) {
        description += statusLine;
    } else if (game.status === GAME_STATUS.IN_PROGRESS) {
        description += `**Turn:** ${MARK_LABEL[game.currentMark]} ${formatPlayer(game.currentPlayerId, players)}`;
        footer =
            footer ??
            `Move timeout: ${Math.round(MOVE_TIMEOUT_MS / 1000)}s · X goes first`;
    } else if (game.status === GAME_STATUS.DRAW) {
        description += `It's a draw!`;
        embedColor = color ?? 0xfee75c;
        footer = footer ?? 'Game over';
    } else if (game.status === GAME_STATUS.WON) {
        description += `**Winner:** ${MARK_LABEL[game.getMarkForPlayer(game.winnerId)]} ${formatPlayer(game.winnerId, players)}`;
        embedColor = color ?? 0x57f287;
        footer = footer ?? 'Game over';
    }

    const embed = new EmbedBuilder()
        .setTitle(title ?? 'Tic-Tac-Toe')
        .setColor(embedColor)
        .setDescription(description)
        .setTimestamp();

    if (footer) {
        embed.setFooter({ text: footer });
    }

    return embed;
}

/**
 * @param {import('../games/tictactoe').TicTacToeGame} game
 * @param {{ disabled?: boolean }} [options]
 */
function buildBoardRows(game, { disabled = false } = {}) {
    const rows = [];
    for (let row = 0; row < 3; row++) {
        const actionRow = new ActionRowBuilder();
        for (let col = 0; col < 3; col++) {
            const index = row * 3 + col;
            const cell = game.board[index];
            const isWinning = game.winningLine?.includes(index) === true;

            let style = ButtonStyle.Secondary;
            if (cell === MARK.X) style = ButtonStyle.Danger;
            else if (cell === MARK.O) style = ButtonStyle.Primary;
            if (isWinning) style = ButtonStyle.Success;

            const buttonDisabled =
                disabled || cell !== MARK.EMPTY || game.status !== GAME_STATUS.IN_PROGRESS;

            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ttt_m_${game.id}_${index}`)
                    .setLabel(cell ? MARK_LABEL[cell] : '·')
                    .setStyle(style)
                    .setDisabled(buttonDisabled),
            );
        }
        rows.push(actionRow);
    }
    return rows;
}

function buildChallengeButtons(challengeId) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`ttt_a_${challengeId}`)
                .setLabel('Accept')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`ttt_d_${challengeId}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger),
        ),
    ];
}

/**
 * @param {import('discord.js').Client} client
 * @param {object} session
 * @param {import('../games/tictactoe').TicTacToeGame} game
 * @param {{ footer?: string, color?: number, disableBoard?: boolean, statusLine?: string, content?: string|null }} [options]
 */
async function editGameMessage(client, session, game, options = {}) {
    if (!session?.channelId || !session?.messageId) return;

    const channel = await client.channels.fetch(session.channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    const message = await channel.messages.fetch(session.messageId).catch(() => null);
    if (!message) return;

    const players = playersFromSession(session);
    const disableBoard = options.disableBoard ?? game.status !== GAME_STATUS.IN_PROGRESS;

    await message
        .edit({
            content: options.content === undefined ? message.content : options.content,
            embeds: [
                buildGameEmbed(game, players, {
                    footer: options.footer,
                    color: options.color,
                    statusLine: options.statusLine,
                }),
            ],
            components: buildBoardRows(game, { disabled: disableBoard }),
        })
        .catch(console.error);
}

/**
 * @param {import('discord.js').Client} client
 */
function createMoveTimeoutHandler(client) {
    return async ({ game, session, timedOutPlayerId, winnerId }) => {
        const players = playersFromSession(session);
        await editGameMessage(client, session, game, {
            footer: `${formatPlayer(timedOutPlayerId, players)} ran out of time. ${formatPlayer(winnerId, players)} wins!`,
            color: 0xed4245,
            disableBoard: true,
            content: null,
        });
    };
}

/**
 * Run the AI turn against the live game managed by `manager`.
 *
 * @param {import('discord.js').Client} client
 * @param {string} gameId
 * @param {import('discord.js').MessageComponentInteraction|import('discord.js').ChatInputCommandInteraction|null} interaction
 * @param {{ alreadyUpdated?: boolean }} [options]
 */
async function playAiTurn(client, gameId, interaction, { alreadyUpdated = false } = {}) {
    const game = manager.getGame(gameId);
    const session = manager.getSession(gameId);
    if (!game || !session || game.status !== GAME_STATUS.IN_PROGRESS) return;

    /** @type {import('../games/tictactoe').OllamaPlayer|undefined} */
    const aiPlayer = session.meta?.aiPlayer;
    if (!aiPlayer || game.currentPlayerId !== aiPlayer.id) return;

    const players = playersFromSession(session);

    if (!alreadyUpdated) {
        const thinkingPayload = {
            content: null,
            embeds: [
                buildGameEmbed(game, players, {
                    statusLine: '🤖 Ollama AI is thinking...',
                }),
            ],
            components: buildBoardRows(game, { disabled: true }),
        };

        if (interaction && !interaction.replied && !interaction.deferred) {
            await interaction.update(thinkingPayload);
            if (interaction.message) {
                session.messageId = interaction.message.id;
                session.channelId = interaction.channelId;
            }
        } else {
            await editGameMessage(client, session, game, {
                statusLine: '🤖 Ollama AI is thinking...',
                disableBoard: true,
                content: null,
            });
        }
    }

    const mark = game.getMarkForPlayer(aiPlayer.id);
    const move = await aiPlayer.getMove([...game.board], mark);

    // Game may have been abandoned while waiting on Ollama.
    if (!manager.getGame(gameId)) return;

    const moved = manager.makeMove(gameId, aiPlayer.id, move.position);
    if (!moved.ok) {
        // Should be rare after validation; force a random empty cell via engine if needed.
        console.error('AI move rejected by engine:', moved.error, move);
        await editGameMessage(client, session, game, {
            statusLine: '🤖 AI move failed. Making a random move.',
            disableBoard: true,
            content: null,
        });
        const fallbackBoard = manager.getGame(gameId);
        if (!fallbackBoard) return;
        const empty = fallbackBoard.board
            .map((cell, i) => (cell === MARK.EMPTY ? i : -1))
            .filter((i) => i >= 0);
        if (empty.length === 0) return;
        const retry = manager.makeMove(gameId, aiPlayer.id, empty[Math.floor(Math.random() * empty.length)]);
        if (!retry.ok) return;
        await renderAfterAiMove(client, session, retry.game, {
            notice: '🤖 AI unavailable. Making a random move.',
        });
        return;
    }

    await renderAfterAiMove(client, session, moved.game, move);
}

/**
 * @param {import('discord.js').Client} client
 * @param {object} session
 * @param {import('../games/tictactoe').TicTacToeGame} game
 * @param {{ position?: number, notice?: string, comment?: string|null, source?: string }} moveInfo
 */
async function renderAfterAiMove(client, session, game, moveInfo) {
    const players = playersFromSession(session);
    const lines = [];

    if (moveInfo.notice) {
        lines.push(moveInfo.notice);
    } else if (Number.isInteger(moveInfo.position)) {
        lines.push(`🤖 Ollama AI chose position ${moveInfo.position}`);
    }

    if (moveInfo.comment) {
        lines.push(`*${moveInfo.comment}*`);
    }

    if (game.status === GAME_STATUS.IN_PROGRESS) {
        lines.push(
            `**Turn:** ${MARK_LABEL[game.currentMark]} ${formatPlayer(game.currentPlayerId, players)}`,
        );
    } else if (game.status === GAME_STATUS.DRAW) {
        lines.push(`It's a draw!`);
    } else if (game.status === GAME_STATUS.WON) {
        lines.push(
            `**Winner:** ${MARK_LABEL[game.getMarkForPlayer(game.winnerId)]} ${formatPlayer(game.winnerId, players)}`,
        );
    }

    const ended = game.status !== GAME_STATUS.IN_PROGRESS;
    // Session may already be cleared after end — keep message ids from the captured object.
    await editGameMessage(client, session, game, {
        statusLine: lines.join('\n\n'),
        disableBoard: ended,
        content: null,
        color: ended
            ? game.status === GAME_STATUS.DRAW
                ? 0xfee75c
                : 0x57f287
            : undefined,
        footer: ended ? 'Game over' : undefined,
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tictactoe')
        .setDescription('Play Tic-Tac-Toe against a friend or Ollama AI')
        .addSubcommand((sub) =>
            sub
                .setName('challenge')
                .setDescription('Challenge another user (Human vs Human)')
                .addUserOption((option) =>
                    option
                        .setName('opponent')
                        .setDescription('The user you want to challenge')
                        .setRequired(true),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName('ai')
                .setDescription('Play against 🤖 Ollama AI')
                .addStringOption((option) =>
                    option
                        .setName('difficulty')
                        .setDescription('AI difficulty')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Easy (random)', value: DIFFICULTY.EASY },
                            { name: 'Normal (Ollama)', value: DIFFICULTY.NORMAL },
                            { name: 'Hard (Ollama)', value: DIFFICULTY.HARD },
                        ),
                ),
        ),

    async execute(interaction) {
        if (!interaction.guild) {
            return interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        }

        const sub = interaction.options.getSubcommand();
        if (sub === 'ai') {
            return startAiGame(interaction);
        }
        return startChallenge(interaction);
    },

    /**
     * @param {import('discord.js').ButtonInteraction} interaction
     * @returns {Promise<boolean>}
     */
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('ttt_')) return false;

        const parts = interaction.customId.split('_');
        const action = parts[1];

        if (action === 'a' || action === 'd') {
            const challengeId = parts.slice(2).join('_');
            return handleChallengeButton(interaction, action, challengeId);
        }

        if (action === 'm') {
            const position = Number(parts[parts.length - 1]);
            const gameId = parts.slice(2, -1).join('_');
            return handleMoveButton(interaction, gameId, position);
        }

        return false;
    },
};

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function startChallenge(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const challenger = interaction.user;

    if (opponent.bot) {
        return interaction.reply({
            content: 'You cannot challenge a bot. Use `/tictactoe ai` to play against Ollama.',
            ephemeral: true,
        });
    }

    if (opponent.id === challenger.id) {
        return interaction.reply({
            content: 'You cannot challenge yourself.',
            ephemeral: true,
        });
    }

    const opponentMember = await interaction.guild.members.fetch(opponent.id).catch(() => null);
    if (!opponentMember) {
        return interaction.reply({
            content: 'That user is not in this server.',
            ephemeral: true,
        });
    }

    const humanX = new HumanPlayer({ id: challenger.id, name: challenger.username });
    const humanO = new HumanPlayer({ id: opponent.id, name: opponent.username });

    const created = manager.createChallenge({
        challengerId: challenger.id,
        opponentId: opponent.id,
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        meta: {
            players: [humanX.toJSON(), humanO.toJSON()],
        },
        onExpire: async (challenge) => {
            try {
                const channel = await interaction.client.channels
                    .fetch(challenge.channelId)
                    .catch(() => null);
                const messageId = challenge.meta?.messageId;
                if (!channel?.isTextBased?.() || !messageId) return;

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) return;

                await message.edit({
                    embeds: [
                        buildChallengeEmbed({
                            challenger: { id: challenge.challengerId },
                            opponent: { id: challenge.opponentId },
                            status: 'expired',
                        }),
                    ],
                    components: [],
                });
            } catch (error) {
                console.error('Failed to update expired challenge message:', error);
            }
        },
    });

    if (!created.ok) {
        return interaction.reply({ content: created.error, ephemeral: true });
    }

    const { challenge } = created;
    const reply = await interaction.reply({
        content: `${mention(opponent.id)}, you have been challenged!`,
        embeds: [
            buildChallengeEmbed({
                challenger,
                opponent,
                status: 'pending',
            }),
        ],
        components: buildChallengeButtons(challenge.id),
        fetchReply: true,
    });

    challenge.meta.messageId = reply.id;
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function startAiGame(interaction) {
    const difficulty = interaction.options.getString('difficulty') || DIFFICULTY.NORMAL;
    const human = new HumanPlayer({
        id: interaction.user.id,
        name: interaction.user.username,
    });
    const ai = new OllamaPlayer({ difficulty });

    const started = manager.startGame({
        playerXId: human.id,
        playerOId: ai.id,
        guildId: interaction.guild.id,
        channelId: interaction.channelId,
        busyPlayerIds: [human.id],
        meta: {
            players: [human.toJSON(), ai.toJSON()],
            aiPlayer: ai,
            noTimeoutPlayerIds: [ai.id],
            difficulty,
        },
        onMoveTimeout: createMoveTimeoutHandler(interaction.client),
    });

    if (!started.ok) {
        return interaction.reply({ content: started.error, ephemeral: true });
    }

    const { game, session } = started;
    const players = playersFromSession(session);

    const reply = await interaction.reply({
        embeds: [buildGameEmbed(game, players)],
        components: buildBoardRows(game),
        fetchReply: true,
    });

    manager.updateSession(game.id, {
        messageId: reply.id,
        channelId: interaction.channelId,
    });
    session.messageId = reply.id;
    session.channelId = interaction.channelId;
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {'a'|'d'} action
 * @param {string} challengeId
 */
async function handleChallengeButton(interaction, action, challengeId) {
    const challenge = manager.getChallenge(challengeId);
    if (!challenge) {
        await interaction.reply({
            content: 'This challenge has ended or is no longer valid.',
            ephemeral: true,
        });
        return true;
    }

    if (action === 'a') {
        if (interaction.user.id !== challenge.opponentId) {
            await interaction.reply({
                content: 'Only the challenged player can accept.',
                ephemeral: true,
            });
            return true;
        }

        const accepted = manager.acceptChallenge(challengeId, interaction.user.id, {
            meta: challenge.meta,
            onMoveTimeout: createMoveTimeoutHandler(interaction.client),
        });

        if (!accepted.ok) {
            await interaction.reply({ content: accepted.error, ephemeral: true });
            return true;
        }

        const { game, session } = accepted;
        const players = playersFromSession(session);

        await interaction.update({
            content: null,
            embeds: [buildGameEmbed(game, players)],
            components: buildBoardRows(game),
        });

        manager.updateSession(game.id, {
            messageId: interaction.message.id,
            channelId: interaction.channelId,
        });
        session.messageId = interaction.message.id;
        session.channelId = interaction.channelId;
        return true;
    }

    const declined = manager.declineChallenge(challengeId, interaction.user.id);
    if (!declined.ok) {
        await interaction.reply({ content: declined.error, ephemeral: true });
        return true;
    }

    const status = declined.challenge.status === 'cancelled' ? 'cancelled' : 'declined';

    await interaction.update({
        content: null,
        embeds: [
            buildChallengeEmbed({
                challenger: { id: declined.challenge.challengerId },
                opponent: { id: declined.challenge.opponentId },
                status,
            }),
        ],
        components: [],
    });
    return true;
}

/**
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string} gameId
 * @param {number} position
 */
async function handleMoveButton(interaction, gameId, position) {
    if (!Number.isInteger(position) || position < 0 || position > 8) {
        await interaction.reply({ content: 'Invalid move.', ephemeral: true });
        return true;
    }

    const existing = manager.getGame(gameId);
    if (!existing) {
        await interaction.reply({
            content: 'This game has ended or is no longer valid.',
            ephemeral: true,
        });
        return true;
    }

    if (!existing.isPlayer(interaction.user.id)) {
        await interaction.reply({
            content: 'You are not a player in this game.',
            ephemeral: true,
        });
        return true;
    }

    // Block clicks while AI is thinking (board should already be disabled).
    const sessionBefore = manager.getSession(gameId);
    if (sessionBefore?.meta?.aiPlayer && existing.currentPlayerId === sessionBefore.meta.aiPlayer.id) {
        await interaction.reply({
            content: 'Wait for 🤖 Ollama AI to finish its move.',
            ephemeral: true,
        });
        return true;
    }

    const moved = manager.makeMove(gameId, interaction.user.id, position);
    if (!moved.ok) {
        await interaction.reply({ content: moved.error, ephemeral: true });
        return true;
    }

    const { game } = moved;
    const session = manager.getSession(gameId) ?? sessionBefore;
    const players = playersFromSession(session);
    const ended = game.status !== GAME_STATUS.IN_PROGRESS;
    const aiPlayer = session?.meta?.aiPlayer;
    const aiTurn = !ended && aiPlayer && game.currentPlayerId === aiPlayer.id;

    if (aiTurn) {
        // Acknowledge the human move immediately with a thinking state, then query Ollama.
        await interaction.update({
            content: null,
            embeds: [
                buildGameEmbed(game, players, {
                    statusLine: '🤖 Ollama AI is thinking...',
                }),
            ],
            components: buildBoardRows(game, { disabled: true }),
        });

        session.messageId = interaction.message.id;
        session.channelId = interaction.channelId;

        await playAiTurn(interaction.client, gameId, interaction, { alreadyUpdated: true });
        return true;
    }

    await interaction.update({
        content: null,
        embeds: [buildGameEmbed(game, players)],
        components: buildBoardRows(game, { disabled: ended }),
    });
    return true;
}
