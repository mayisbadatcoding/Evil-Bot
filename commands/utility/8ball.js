const {
    SlashCommandBuilder
} = require("discord.js");

const responses = [
    "Yes.",
    "No.",
    "Maybe.",
    "Absolutely.",
    "Absolutely not.",
    "Probably.",
    "Probably not.",
    "Without a doubt.",
    "Ask again later.",
    "The voices say yes.",
    "The voices say no.",
    "Signs point to yes.",
    "Very unlikely.",
    "I think so."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("8ball")
        .setDescription("Ask the magical 8ball.")
        .addStringOption(option =>
            option
                .setName("question")
                .setDescription("Your question.")
                .setRequired(true)
        ),

    async execute(interaction) {
        const question = interaction.options.getString("question");

        const response =
            responses[Math.floor(Math.random() * responses.length)];

        await interaction.reply({
            content:
                `🎱 **Question:** ${question}\n\n` +
                `**Answer:** ${response}`
        });
    }
};