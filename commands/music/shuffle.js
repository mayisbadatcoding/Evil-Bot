const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "No queue.", flags: 64 });

        player.queue.shuffle();
        await interaction.reply("Queue shuffled.");
    }
};