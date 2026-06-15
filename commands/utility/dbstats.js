const { SlashCommandBuilder } = require("discord.js");
const { infoEmbed } = require("../../utils/embeds");
const { getDatabaseStats } = require("../../utils/storage");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("dbstats")
        .setDescription("View database statistics."),

    async execute(interaction) {
        const stats = await getDatabaseStats();

        const embed = infoEmbed(
            "Database Statistics",
            "PostgreSQL status and usage."
        ).addFields(
            {
                name: "Connection",
                value: stats.connected ? "🟢 Connected" : "🔴 Disconnected",
                inline: true
            },
            {
                name: "Database Ping",
                value: stats.connected ? `${stats.ping}ms` : "N/A",
                inline: true
            },
            {
                name: "Points Users",
                value: String(stats.points || 0),
                inline: true
            },
            {
                name: "Warnings",
                value: String(stats.warnings || 0),
                inline: true
            },
            {
                name: "Roblox Links",
                value: String(stats.links || 0),
                inline: true
            },
            {
                name: "Custom Roles",
                value: String(stats.customRoles || 0),
                inline: true
            }
        );

        await interaction.reply({
            embeds: [embed]
        });
    }
};