const {
    SlashCommandSubcommandBuilder,
    AttachmentBuilder
} = require("discord.js");

const path = require("path");

const { readPoints } = require("../../utils/storage");
const { successEmbed } = require("../../utils/embeds");

module.exports = {
    data: new SlashCommandSubcommandBuilder()
        .setName("checker")
        .setDescription("Check how many points a user has.")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("The user to check.")
                .setRequired(true)
        ),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser("user");
        const points = readPoints();
        const userPoints = points[user.id] || 0;

        const attachment = new AttachmentBuilder(
            path.join(__dirname, "../../assets/smug.gif")
        );

        const embed = successEmbed(
            "MWAHAHHAHA MAY HAS MORE POINTS!!! (or does she?)",
            `${user} currently has **${userPoints}** point(s).`
        ).setImage("attachment://smug.gif");

        await interaction.editReply({
            embeds: [embed],
            files: [attachment]
        });
    }
};