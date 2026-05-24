const {
    SlashCommandSubcommandBuilder,
    AttachmentBuilder
} = require("discord.js");

const path = require("path");

const { removePoints } = require("../../utils/storage");
const { canManagePoints } = require("../../utils/permissions");
const { successEmbed, errorEmbed, logEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("remove")
        .setDescription("Remove points from a user.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to remove points from.")
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Amount of points to remove.")
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for removing points.")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!canManagePoints(interaction.member)) {
            return interaction.reply({
                embeds: [errorEmbed("Permission Denied", "You cannot use this command.")],
                flags: 64
            });
        }

        const user = interaction.options.getUser("user");
        const amount = interaction.options.getInteger("amount");
        const reason = interaction.options.getString("reason");

        const totalPoints = await removePoints(user.id, amount);

        const replyEmbed = successEmbed(
            "Points Removed",
            `Removed **${amount}** point(s) from ${user}.\n\nThey now have **${totalPoints}** point(s).`
        );

        await interaction.reply({
            embeds: [replyEmbed]
        });

        const attachment = new AttachmentBuilder(
            path.join(__dirname, "../../assets/whywhywhy.gif")
        );

        const dmEmbed = errorEmbed(
            "we've stolen your points!!!",
            `You lost **${amount}** point(s).\n\nReason: **${reason}**\n\nYou now have **${totalPoints}** point(s). THESE POINTS GO TO MAY!!!`
        ).setImage("attachment://whywhywhy.gif");

        let dmStatus = "Sent";

        await user.send({
            embeds: [dmEmbed],
            files: [attachment]
        }).catch(error => {
            dmStatus = `Failed: ${error.message}`;
            console.error("DM failed:", error);
        });

        const logChannel = interaction.client.channels.cache.get(
            process.env.POINT_LOG_CHANNEL
        );

        if (logChannel) {
            const embed = logEmbed("Point Removed", [
                {
                    name: "User",
                    value: `${user} (\`${user.id}\`)`
                },
                {
                    name: "Amount",
                    value: `${amount}`,
                    inline: true
                },
                {
                    name: "Total Points",
                    value: `${totalPoints}`,
                    inline: true
                },
                {
                    name: "Person who TAKETH AWAY!",
                    value: `${interaction.user}`
                },
                {
                    name: "DM Status",
                    value: dmStatus
                },
                {
                    name: "Reason",
                    value: reason
                }
            ]);

            await logChannel.send({
                embeds: [embed]
            });
        }
    }
};