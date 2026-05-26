const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a user's timeout.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to unmute.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the unmute.")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const member = interaction.options.getMember("user");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        if (!member) {
            return interaction.reply({
                embeds: [errorEmbed("Error", "That user is not in this server.")],
                flags: 64
            });
        }

        await member.timeout(null, reason);

        await interaction.reply({
            embeds: [successEmbed("User Unmuted", `${member} has been unmuted.\n\n**Reason:** ${reason}`)]
        });

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("User Unmuted", [
                    { name: "User", value: `${member.user} (\`${member.id}\`)` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Reason", value: reason }
                ])]
            });
        }
    }
};