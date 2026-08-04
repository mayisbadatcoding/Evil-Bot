const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, parseTime } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("seek")
        .setDescription("Seek to a timestamp.")
        .addStringOption(option =>
            option.setName("time").setDescription("Example: 1:30 or 90").setRequired(true)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        const ms = parseTime(interaction.options.getString("time"));
        if (ms === null) return interaction.reply({ content: "Invalid time.", flags: 64 });

        await player.seek(ms);
        await interaction.reply(`Seeked to **${interaction.options.getString("time")}**.`);
    }
};