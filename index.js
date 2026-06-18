require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const deployCommands = async () => {
    // Deploy Command Logic
    try {
        const commands = [];
        const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.log(`[WARNING] The command at ./commands/${file} is missing a required "data" or "execute" property.`);
            }
        }
        const res = new REST().setToken(process.env.BOT_TOKEN);
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
    
        const data = await res.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error deploying commands:', error);
    } 


}

const {
    Client,
    GatewayIntentBits,
    Partials,
    Collection,
    ActivityType,
    PresenceUpdateStatus,
    Events
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember
    ]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);

    // Deploy Commands
    await deployCommands();
    console.log('Commands deployed globally.');

    const statusType = process.env.BOT_STATUS || 'online';
    const activityType = process.env.ACTIVITY_TYPE || 'PLAYING';
    const activityName = process.env.ACTIVITY_NAME || 'Discord';

    const activityTypeMap = {
        'PLAYING': ActivityType.Playing,
        'STREAMING': ActivityType.Streaming,
        'LISTENING': ActivityType.Listening,
        'WATCHING': ActivityType.Watching,
        'COMPETING': ActivityType.Competing
    };

    const statusMap = {
        'online': PresenceUpdateStatus.Online,
        'idle': PresenceUpdateStatus.Idle,
        'dnd': PresenceUpdateStatus.DoNotDisturb,
        'invisible': PresenceUpdateStatus.Invisible
    };

    client.user.setPresence({
        status: statusMap[statusType],
        activities: [{
            name: activityName,
            type: activityTypeMap[activityType]
        }]
    });

    console.log(`Bot status set to: ${statusType}`);
    console.log(`Bot activity set to: ${activityType} ${activityName}`);
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'reset_chat_memory') {
            const chatMemory = require("./memory"); // Path to your memory.js
            const channelId = interaction.channelId;

            if (chatMemory.has(channelId)) {
                chatMemory.delete(channelId);
                return await interaction.reply({ 
                    content: `🧹 Memory cleared by ${interaction.user.username}! I've forgotten previous messages in this channel.`, 
                    ephemeral: false 
                });
            } else {
                return await interaction.reply({ 
                    content: "Memory is already empty.", 
                    ephemeral: true 
                });
            }
        }

        
        const votekick = client.commands.get('votekick');
        if (votekick?.handleButton) {
            try {
                const handled = await votekick.handleButton(interaction);
                if (handled) return;
            } catch (error) {
                console.error(error);
                const payload = { content: 'There was an error processing your vote.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(payload).catch(() => {});
                } else {
                    await interaction.reply(payload).catch(() => {});
                }
                return;
            }
        }
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        // console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if(interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.login(process.env.BOT_TOKEN);