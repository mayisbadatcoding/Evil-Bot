const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { clearWarnings } = require("../../utils/storage");
const { successEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clearwarnings")
        .setDescription("Clear all warnings from a user.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to clear warnings from.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const amount = await clearWarnings(user.id);

        await interaction.reply({
            embeds: [successEmbed("Warnings Cleared", `Cleared **${amount}** warning(s) from ${user}.`)]
        });

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("Warnings Cleared", [
                    { name: "User", value: `${user} (\`${user.id}\`)` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Warnings Cleared", value: `${amount}` }
                ])]
            });
        }
    }
};