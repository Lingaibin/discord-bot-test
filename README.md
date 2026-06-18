# Discord Bot Test

A feature-rich Discord bot built with **Discord.js v14**, featuring local AI integration (via Ollama), interactive vote kicks, automated reminders, server moderation commands, and customizable presence settings.

---

## 🚀 Features

### 🤖 Local AI Chat (`/chat`)
- **Interactive AI Chat:** Have conversations directly with a local AI model (defaults to `llama3`) running on your machine via [Ollama](https://ollama.com/).
- **Context Awareness:** Remembers the last 10 messages per channel for natural back-and-forth dialogue.
- **Easy Reset:** Includes a button on each response to quickly clear the conversation memory for that channel.

### 🗳️ Interactive Vote Kick (`/votekick`)
- **Democratic Moderation:** Allows members to start a vote to kick a user.
- **Smart Voting Logic:** Automatically calculates required votes (passes when at least 1/3 of non-bot, eligible server members vote "Yes").
- **Dynamic Embeds:** Real-time updates to the voting panel showing voters, counts, and remaining time.
- **Auto-Cleanup:** Votes automatically expire and clear out after 1 hour if not resolved.

### ⏰ Self Reminders (`/remind`)
- **Timed Notifications:** Schedule reminders with pre-configured intervals ranging from 5 minutes up to 1 day.
- **Relative Timestamps:** Uses Discord's dynamic timestamp syntax so you can see exactly when you will be reminded in relative time (e.g., *in 15 minutes*).

### 🛠️ Server Moderation & Utilities
- **Kick/Ban (`/kick`, `/ban`):** Perform quick, permission-checked moderation actions with reasons directly through slash commands.
- **Latency Check (`/ping`):** View bot latency and Discord API gateway ping times.
- **Custom Presence:** Configure bot status (online, idle, dnd, invisible) and activity (Playing, Watching, Listening, etc.) dynamically via configuration.

---

## 🛠️ Prerequisites

Before you start, make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v16.11.0 or higher recommended)
- [Ollama](https://ollama.com/) (for AI chat features)
- A Discord Developer Account to create and register your bot application.

---

## ⚙️ Setup & Installation

### 1. Clone & Install Dependencies
Navigate to your project directory and install the required packages:
```bash
npm install
```

### 2. Configure Environment Variables
Copy the `.env.example` file to create your own configuration file:
```bash
cp .env.example .env
```
Open `.env` and fill in your credentials:
```env
# Bot Credentials
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Bot Activity Status (online, idle, dnd, invisible)
BOT_STATUS=online

# Activity Type (PLAYING, STREAMING, LISTENING, WATCHING, COMPETING)
ACTIVITY_TYPE=WATCHING
ACTIVITY_NAME="over the server"
```
> **How to get credentials:**
> - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
> - Create a new application and add a **Bot** user.
> - Grab your **Token** from the Bot tab (this is `BOT_TOKEN`).
> - Grab your **Application ID** from the General Information tab (this is `CLIENT_ID`).
> - Under **Privileged Gateway Intents**, enable **Guild Members**, **Guild Messages**, and **Message Content** intents.

### 3. Start Local AI (Ollama)
If you wish to use the `/chat` command, verify Ollama is running and has the `llama3` model pulled:
```bash
# Pull the default llama3 model
ollama pull llama3

# Verify Ollama is running locally on port 11434 (default)
```
*Note: If you want to use a different model, edit the model name in [commands/chat.js](file:///Users/edison/frontend-project/discord-bot-test/commands/chat.js#L29).*

---

## 💻 Running the Bot

To start the bot, run the following command:
```bash
npm start
```

Upon launching, the bot will:
1. Log in to Discord.
2. Automatically deploy/register the slash commands globally to Discord.
3. Update its status and presence based on your `.env` configuration.

---

## 📂 Project Structure

```
├── commands/
│   ├── ban.js             # /ban command (requires Ban Members permissions)
│   ├── chat.js            # /chat command (Ollama AI interaction)
│   ├── kick.js            # /kick command (requires Kick Members permissions)
│   ├── ping.js            # /ping command (bot latency stats)
│   ├── remind.js          # /remind command (set individual reminders)
│   └── votekick.js        # /votekick command (vote to kick a user)
├── .env.example           # Reference environment variables
├── index.js               # Main entry point & event handlers
├── memory.js              # In-memory storage for AI chat conversations
├── ollama.js              # Ollama API client configuration
└── package.json           # Dependencies and project scripts
```

---

## 🤖 Slash Commands Reference

| Command | Description | Permissions Required |
| :--- | :--- | :--- |
| `/chat <message>` | Interacts with a local LLM via Ollama. | None |
| `/votekick <target> [reason]` | Initiates a vote to kick a user from the server. | None |
| `/remind <when> <message>` | Set a reminder (Choices: 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d). | None |
| `/kick <target> [reason]` | Kicks the target member from the server. | Kick Members |
| `/ban <target> [reason]` | Bans the target member from the server. | Ban Members |
| `/ping` | Displays bot latency and API latency. | None |
