const { SlashCommandBuilder } = require("discord.js");
const { infoEmbed } = require("../../utils/embeds");

function mb(value) {
    return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("memory")
        .setDescription("View memory usage."),

    async execute(interaction) {
        const memory = process.memoryUsage();

        const embed = infoEmbed(
            "Memory Usage",
            "Current Node.js resource consumption."
        ).addFields(
            {
                name: "Heap Used",
                value: mb(memory.heapUsed),
                inline: true
            },
            {
                name: "Heap Total",
                value: mb(memory.heapTotal),
                inline: true
            },
            {
                name: "RSS",
                value: mb(memory.rss),
                inline: true
            },
            {
                name: "External",
                value: mb(memory.external),
                inline: true
            },
            {
                name: "Node Version",
                value: process.version,
                inline: true
            },
            {
                name: "Platform",
                value: process.platform,
                inline: true
            }
        );

        await interaction.reply({
            embeds: [embed]
        });
    }
};