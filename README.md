# Discord Bot Test

A feature-rich Discord bot built with **Discord.js v14**, featuring YouTube music playback, local AI integration (via Ollama), interactive vote kicks, Tic-Tac-Toe, automated reminders, server moderation commands, and customizable presence settings.

---

## 🚀 Features

### 🎵 Music Playback (`/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/shuffle`, `/loop`, `/remove`, `/leave`)
- **YouTube streaming:** Play music from a YouTube URL or search term.
- **Queue support:** Songs are queued and played in order. Each server has its own queue and player.
- **Playlists & Mixes:** A link with `list=` queues up to 25 songs, starting from the video you clicked (works for playlists and YouTube Mixes). Private or invalid lists fall back to the single video.
- **Queue controls:** Loop the current song or the whole queue, shuffle Up Next, or remove a song by its number in `/queue`. `/skip` still moves on while a song is looping.
- **Auto-leave:** The bot leaves the voice channel 60 seconds after the last human member leaves.
- **Powered by yt-dlp:** Audio is streamed via [yt-dlp](https://github.com/yt-dlp/yt-dlp) and transcoded to Opus for Discord voice. The binary downloads automatically to `bin/` on first play and updates to the latest release each time the bot starts. On macOS the bot uses yt-dlp's unpacked build (`bin/yt-dlp_macos/`), which starts in ~0.2 s instead of ~7.5 s; other platforms use the single-file `bin/yt-dlp` (or set `YT_DLP_PATH` to use a system install, which you must keep up to date yourself). Node.js is passed to yt-dlp as its JavaScript runtime, which YouTube now requires.

### 🤖 Local AI Chat (`/chat`)
- **Interactive AI Chat:** Have conversations directly with a local AI model (defaults to `llama3`) running on your machine via [Ollama](https://ollama.com/).
- **Context Awareness:** Remembers the last 10 messages per channel for natural back-and-forth dialogue.
- **Easy Reset:** Includes a button on each response to quickly clear the conversation memory for that channel.

### 🗳️ Interactive Vote Kick (`/votekick`)
- **Democratic Moderation:** Allows members to start a vote to kick a user.
- **Smart Voting Logic:** Automatically calculates required votes (passes when at least 1/3 of non-bot, eligible server members vote "Yes").
- **Dynamic Embeds:** Real-time updates to the voting panel showing voters, counts, and remaining time.
- **Auto-Cleanup:** Votes automatically expire and clear out after 1 hour if not resolved.

### ⭕ Tic-Tac-Toe (`/tictactoe`)
- **Human vs Human:** `/tictactoe challenge opponent:@user` — Accept / Decline challenge flow.
- **Human vs AI:** `/tictactoe ai [difficulty]` — play against **🤖 Ollama AI** (starts immediately).
- **Difficulty:** `easy` (random, no Ollama), `normal` (Ollama picks the move), `hard` (minimax — unbeatable; Ollama only adds an in-character comment).
- **Interactive board:** Buttons with turn validation, win/draw detection, and a 60-second move timeout (humans only).
- **Resilient AI:** On `normal`, invalid Ollama replies are retried, then fall back to a random legal move so games never stall. `hard` never needs a fallback since minimax always returns a valid move.
- **Concurrent games:** Multiple games at once; each human may only be in one challenge or game at a time.
- **Modular engine:** Discord-agnostic core in `games/tictactoe/`; AI is an `OllamaPlayer` extension, not a fork of the engine.

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
Create a `.env` file in the project root with your credentials:
```env
# Bot Credentials
BOT_TOKEN=your_discord_bot_token_here
CLIENT_ID=your_discord_client_id_here

# Bot Activity Status (online, idle, dnd, invisible)
BOT_STATUS=online

# Activity Type (PLAYING, STREAMING, LISTENING, WATCHING, COMPETING)
ACTIVITY_TYPE=WATCHING
ACTIVITY_NAME="over the server"

# Optional: path to a system yt-dlp binary (defaults to the auto-downloaded copy in bin/)
# YT_DLP_PATH=/usr/local/bin/yt-dlp
```
> **How to get credentials:**
> - Go to the [Discord Developer Portal](https://discord.com/developers/applications).
> - Create a new application and add a **Bot** user.
> - Grab your **Token** from the Bot tab (this is `BOT_TOKEN`).
> - Grab your **Application ID** from the General Information tab (this is `CLIENT_ID`).
> - Under **Privileged Gateway Intents**, enable **Guild Members**, **Guild Messages**, and **Message Content** intents.
> - Invite the bot with **Connect** and **Speak** permissions if you plan to use music commands.

### 3. Start Local AI (Ollama)
If you wish to use the `/chat` command, verify Ollama is running and has the `llama3` model pulled:
```bash
# Pull the default llama3 model
ollama pull llama3

# Verify Ollama is running locally on port 11434 (default)
```
*Note: If you want to use a different model, edit the model name in [commands/chat.js].*

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

On the first `/play` command, the bot will download yt-dlp into `bin/` (`bin/yt-dlp_macos/` on macOS, `bin/yt-dlp` elsewhere). It is gitignored, and the bot checks for a newer release on every start.

---

## 📂 Project Structure

```
├── commands/
│   ├── ban.js             # /ban command (requires Ban Members permissions)
│   ├── chat.js            # /chat command (Ollama AI interaction)
│   ├── help.js            # /help command (dynamic command list)
│   ├── kick.js            # /kick command (requires Kick Members permissions)
│   ├── leave.js           # /leave command (disconnect from voice)
│   ├── loop.js            # /loop command (repeat song or queue)
│   ├── nowplaying.js      # /nowplaying command (current song, time, loop mode)
│   ├── pause.js           # /pause command (pause playback)
│   ├── ping.js            # /ping command (bot latency stats)
│   ├── play.js            # /play command (YouTube music)
│   ├── queue.js           # /queue command (show current queue)
│   ├── remind.js          # /remind command (set individual reminders)
│   ├── remove.js          # /remove command (remove a song from Up Next)
│   ├── resume.js          # /resume command (resume playback)
│   ├── shuffle.js         # /shuffle command (shuffle Up Next)
│   ├── skip.js            # /skip command (skip current song)
│   ├── stop.js            # /stop command (stop and clear queue)
│   ├── tictactoe.js       # /tictactoe command (Human vs Human)
│   └── votekick.js        # /votekick command (vote to kick a user)
├── games/
│   └── tictactoe/
│       ├── constants.js   # Marks, statuses, timeouts, difficulty
│       ├── Game.js        # Discord-agnostic board engine
│       ├── GameManager.js # Challenges, direct games, cleanup
│       ├── minimax.js     # Unbeatable move search for hard difficulty
│       ├── prompts.js     # Ollama move / retry / comment prompts
│       ├── index.js       # Public exports
│       └── players/
│           ├── Player.js       # Shared player shape
│           ├── HumanPlayer.js  # Discord human
│           └── OllamaPlayer.js # AI opponent (reuses ../ollama.js)
├── utils/
│   ├── autoLeave.js       # Auto-leave voice channel when empty
│   ├── voice.js           # Voice channel connection helpers
│   └── youtube.js         # YouTube search & streaming (yt-dlp + ffmpeg)
├── bin/
│   ├── yt-dlp_macos/      # yt-dlp unpacked build, macOS (auto-downloaded, gitignored)
│   └── yt-dlp             # yt-dlp single-file binary, other platforms (auto-downloaded, gitignored)
├── index.js               # Main entry point & event handlers
├── memory.js              # In-memory storage for AI chat conversations
├── musicManager.js        # Per-server music queues and audio players
├── ollama.js              # Ollama API client configuration
├── polyfills.js           # Node.js polyfills
└── package.json           # Dependencies and project scripts
```

---

## 🤖 Slash Commands Reference

| Command | Description | Permissions Required |
| :--- | :--- | :--- |
| `/play <query>` | Play music from a YouTube URL or search term. Playlist/Mix links queue up to 25 songs from the clicked video. | None (must be in a voice channel) |
| `/pause` | Pause the current song. | None |
| `/resume` | Resume playback. | None |
| `/skip` | Skip the current song. | None |
| `/stop` | Stop playback and clear the queue. | None |
| `/queue` | Show the current song and upcoming queue. | None |
| `/nowplaying` | Show the current song, time played, requester and loop mode. | None |
| `/shuffle` | Shuffle the songs in Up Next. | None |
| `/loop <mode>` | Repeat nothing (`off`), the current `song`, or the whole `queue`. | None |
| `/remove <position>` | Remove a song from Up Next by its number in `/queue`. | None |
| `/leave` | Stop music and leave the voice channel. | None |
| `/chat <message>` | Interacts with a local LLM via Ollama. | None |
| `/votekick <target> [reason]` | Initiates a vote to kick a user from the server. | None |
| `/tictactoe challenge <opponent>` | Challenge a user to Tic-Tac-Toe (Accept / Decline). | None |
| `/tictactoe ai [difficulty]` | Play against 🤖 Ollama AI (`easy` / `normal` / `hard`, unbeatable). | None |
| `/remind <when> <message>` | Set a reminder (Choices: 5m, 15m, 30m, 1h, 2h, 4h, 8h, 12h, 1d). | None |
| `/kick <target> [reason]` | Kicks the target member from the server. | Kick Members |
| `/ban <target> [reason]` | Bans the target member from the server. | Ban Members |
| `/help [command]` | Lists all slash commands by category, or details for one command. | None |
| `/ping` | Displays bot latency and API latency. | None |
