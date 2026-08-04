const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a user.")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("The user to ban.")
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName("reason")
                .setDescription("Reason for the ban.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(interaction) {
        const user = interaction.options.getUser("user");
        const reason = interaction.options.getString("reason");

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        await user.send({
            embeds: [errorEmbed("You Were Banned", `You were banned from **${interaction.guild.name}**.\n\n**Reason:** ${reason}`)]
        }).catch(console.error);

        if (member) {
            await member.ban({ reason });
        } else {
            await interaction.guild.members.ban(user.id, { reason });
        }

        await interaction.reply({
            embeds: [successEmbed("User Banned", `${user} has been banned.\n\n**Reason:** ${reason}`)]
        });

        const logChannel = interaction.client.channels.cache.get(
            process.env.MOD_LOG_CHANNEL || process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            await logChannel.send({
                embeds: [logEmbed("User Banned", [
                    { name: "User", value: `${user} (\`${user.id}\`)` },
                    { name: "Moderator", value: `${interaction.user}` },
                    { name: "Reason", value: reason }
                ])]
            });
        }
    }
};