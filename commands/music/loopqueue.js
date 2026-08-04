const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("loopqueue").setDescription("Loop the queue."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        player.repeatMode = player.repeatMode === "queue" ? "off" : "queue";
        await interaction.reply(`Queue loop is now **${player.repeatMode === "queue" ? "enabled" : "disabled"}**.`);
    }
};