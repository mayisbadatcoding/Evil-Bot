const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Timeout a user.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to mute.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName("minutes")
                .setDescription("How many minutes to mute them.")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(40320)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the mute.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const member = interaction.options.getMember("user");
        const minutes = interaction.options.getInteger("minutes");
        const reason = interaction.options.getString("reason");

        if (!member) {
            return interaction.reply({
                embeds: [errorEmbed("Error", "That user is not in this server.")],
                flags: 64
            });
        }

        await member.timeout(minutes * 60 * 1000, reason);

        await interaction.reply({
            embeds: [successEmbed("User Muted", `${member} has been muted for **${minutes}** minute(s).\n\n**Reason:** ${reason}`)]
        });

        await member.user.send({
            embeds: [errorEmbed("You Were Muted", `You were muted in **${interaction.guild.name}** for **${minutes}** minute(s).\n\n**Reason:** ${reason}`)]
        }).catch(console.error);

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("User Muted", [
                    { name: "User", value: `${member.user} (\`${member.id}\`)` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Duration", value: `${minutes} minute(s)` },
                    { name: "Reason", value: reason }
                ])]
            });
        }
    }
};