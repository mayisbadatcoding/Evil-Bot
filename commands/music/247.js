const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("247").setDescription("Keep the bot in voice 24/7."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Start music first.", flags: 64 });

        player.customData = player.customData || {};
        player.customData.twentyFourSeven = !player.customData.twentyFourSeven;

        await interaction.reply(`24/7 mode is now **${player.customData.twentyFourSeven ? "enabled" : "disabled"}**.`);
    }
};