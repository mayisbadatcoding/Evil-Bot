const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("volume")
        .setDescription("Set volume.")
        .addIntegerOption(option =>
            option.setName("amount").setDescription("1-100").setRequired(true).setMinValue(1).setMaxValue(100)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Nothing is playing.", flags: 64 });

        const volume = interaction.options.getInteger("amount");
        await player.setVolume(volume);

        await interaction.reply(`Volume set to **${volume}%**.`);
    }
};