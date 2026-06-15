const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("loop").setDescription("Loop the current song."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        player.repeatMode = player.repeatMode === "track" ? "off" : "track";
        await interaction.reply(`Song loop is now **${player.repeatMode === "track" ? "enabled" : "disabled"}**.`);
    }
};