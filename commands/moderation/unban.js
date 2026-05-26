const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { successEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user by Discord user ID.")
        .addStringOption(option =>
            option.setName("userid")
                .setDescription("The user ID to unban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the unban.")
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const userId = interaction.options.getString("userid");
        const reason = interaction.options.getString("reason") || "No reason provided.";

        await interaction.guild.members.unban(userId, reason);

        await interaction.reply({
            embeds: [successEmbed("User Unbanned", `User ID \`${userId}\` has been unbanned.\n\n**Reason:** ${reason}`)]
        });

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("User Unbanned", [
                    { name: "User ID", value: `\`${userId}\`` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Reason", value: reason }
                ])]
            });
        }
    }
};