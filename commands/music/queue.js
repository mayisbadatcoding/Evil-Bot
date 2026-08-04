const { SlashCommandBuilder } = require("discord.js");
const { getPlayer, formatTrack } = require("../../utils/musicHelpers");

module.exports = {
    data: new SlashCommandBuilder().setName("queue").setDescription("View the queue."),

    async execute(interaction) {
        const player = getPlayer(interaction.client, interaction.guildId);
        if (!player) return interaction.reply({ content: "Queue is empty.", flags: 64 });

        const current = player.queue.current ? `Now: ${formatTrack(player.queue.current)}\n\n` : "";
        const tracks = player.queue.tracks.slice(0, 10);

        if (!tracks.length) {
            return interaction.reply(`${current}No upcoming songs.`);
        }

        await interaction.reply(
            `${current}${tracks.map((track, i) => formatTrack(track, i + 1)).join("\n")}`
        );
    }
};