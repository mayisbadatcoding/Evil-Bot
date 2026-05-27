const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Shows bot latency and uptime."),

    async execute(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;

        const uptimeMs = interaction.client.uptime;

        const days = Math.floor(uptimeMs / 86400000);
        const hours = Math.floor(uptimeMs / 3600000) % 24;
        const minutes = Math.floor(uptimeMs / 60000) % 60;
        const seconds = Math.floor(uptimeMs / 1000) % 60;

        const embed = new EmbedBuilder()
            .setTitle("🏓 Pong!")
            .setColor("Green")
            .addFields(
                {
                    name: "Latency",
                    value: `${latency}ms`,
                    inline: true
                },
                {
                    name: "API Ping",
                    value: `${Math.round(interaction.client.ws.ping)}ms`,
                    inline: true
                },
                {
                    name: "Uptime",
                    value: `${days}d ${hours}h ${minutes}m ${seconds}s`
                },
                {
                    name: "Server Status",
                    value: "🟢 Operational"
                }
            )
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};