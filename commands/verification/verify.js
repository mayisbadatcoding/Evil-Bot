const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const {
    createVerifyUrl
} = require("../../utils/oauthServer");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("verify")
        .setDescription("Verify your Roblox account with OAuth."),

    async execute(interaction) {
        await interaction.deferReply({
            flags: 64
        });

        if (
            !process.env.ROBLOX_CLIENT_ID ||
            !process.env.ROBLOX_CLIENT_SECRET ||
            !process.env.ROBLOX_REDIRECT_URI
        ) {
            return interaction.editReply({
                content: "Roblox OAuth is not configured yet. Add the OAuth app variables in Railway first."
            });
        }

        const verifyUrl = createVerifyUrl(
            interaction.user.id,
            interaction.guild.id
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("Verify with Roblox")
                .setStyle(ButtonStyle.Link)
                .setURL(verifyUrl)
        );

        await interaction.editReply({
            content: "Click the button below to verify with Roblox.",
            components: [row]
        });
    }
};