const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("autoplay").setDescription("Toggle autoplay."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        player.customData = player.customData || {};
        player.customData.autoplay = !player.customData.autoplay;

        await interaction.reply(`Autoplay is now **${player.customData.autoplay ? "enabled" : "disabled"}**.`);
    }
};