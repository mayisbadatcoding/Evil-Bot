const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove")
        .setDescription("Remove a song from the queue.")
        .addIntegerOption(option =>
            option.setName("position").setDescription("Queue position.").setRequired(true).setMinValue(1)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "No queue.", flags: 64 });

        const position = interaction.options.getInteger("position") - 1;
        const removed = player.queue.tracks.splice(position, 1)[0];

        if (!removed) return interaction.reply({ content: "Invalid position.", flags: 64 });

        await interaction.reply(`Removed **${removed.info.title}**.`);
    }
};