const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { addWarning } = require("../../utils/storage");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Warn a user.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to warn.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the warning.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const warning = await addWarning(user.id, interaction.user.id, reason);

        await interaction.reply({
            embeds: [successEmbed("User Warned", `${user} has been warned.\n\n**Reason:** ${reason}`)]
        });

        await user.send({
            embeds: [errorEmbed("You Were Warned", `You were warned in **${interaction.guild.name}**.\n\n**Reason:** ${reason}`)]
        }).catch(console.error);

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("User Warned", [
                    { name: "User", value: `${user} (\`${user.id}\`)` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Warning ID", value: `${warning.id}` },
                    { name: "Reason", value: reason }
                ])]
            });
        }
    }
};