const { SlashCommandBuilder } = require("discord.js");
const { getPlayer } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("jump")
        .setDescription("Jump to a song in the queue.")
        .addIntegerOption(option =>
            option.setName("position").setDescription("Queue position.").setRequired(true).setMinValue(1)
        ),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "No queue.", flags: 64 });

        const position = interaction.options.getInteger("position") - 1;
        const track = player.queue.tracks[position];

        if (!track) return interaction.reply({ content: "Invalid position.", flags: 64 });

        player.queue.tracks.splice(0, position);
        await player.skip();

        await interaction.reply(`Jumped to **${track.info.title}**.`);
    }
};