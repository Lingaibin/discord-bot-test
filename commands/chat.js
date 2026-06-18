const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ollama = require("../ollama");
const chatMemory = require("../memory");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Talk with local AI")
    .addStringOption(option =>
      option.setName("message").setDescription("Your message").setRequired(true)
    ),

  async execute(interaction) {
    const message = interaction.options.getString("message");
    const channelId = interaction.channelId;

    await interaction.deferReply();

    // 1. Manage Memory
    if (!chatMemory.has(channelId)) {
      chatMemory.set(channelId, []);
    }
    const history = chatMemory.get(channelId);
    history.push({ role: "user", content: message });

    try {
      // 2. Get AI Response
      const response = await ollama.chat({
        model: "llama3", 
        messages: history,
      });

      const reply = response.message.content || "No response generated.";
      history.push({ role: "assistant", content: reply });

      if (history.length > 10) history.shift();

      // 3. Create the Reset Button
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('reset_chat_memory') // This ID is important for index.js
          .setLabel('Clear Conversation')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️')
      );

      // 4. Format the final text (Question + Answer)
      const fullResponse = `**${interaction.user.username} asked:** ${message}\n\n${reply}`;

      // 5. Send it
      await interaction.editReply({
        content: fullResponse.slice(0, 2000),
        components: [row]
      });

    } catch (error) {
      console.error(error);
      history.pop();
      await interaction.editReply("Error connecting to Ollama.");
    }
  },
};