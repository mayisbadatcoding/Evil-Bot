const { SlashCommandBuilder } = require("discord.js");
const { successEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("health")
        .setDescription("View the bot's current health."),

    async execute(interaction) {
        const uptime = process.uptime();

        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const embed = successEmbed(
            "Bot Health",
            "Current operational status."
        ).addFields(
            {
                name: "Status",
                value: "🟢 Online",
                inline: true
            },
            {
                name: "Latency",
                value: `${interaction.client.ws.ping}ms`,
                inline: true
            },
            {
                name: "Uptime",
                value: `${days}d ${hours}h ${minutes}m`,
                inline: true
            }
        );

        await interaction.reply({
            embeds: [embed]
        });
    }
};