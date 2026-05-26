require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const banCommand = require("./commands/moderation/ban");
const clearWarningsCommand = require("./commands/moderation/clearwarnings");
const muteCommand = require("./commands/moderation/mute");
const unbanCommand = require("./commands/moderation/unban");
const unmuteCommand = require("./commands/moderation/unmute");
const warnCommand = require("./commands/moderation/warn");
const warningsCommand = require("./commands/moderation/warnings");

const clankerCommand = require("./Funny Commands/clanker");
const fuckyouCommand = require("./Funny Commands/fuckyou");

const pointCommand = new SlashCommandBuilder()
    .setName("point")
    .setDescription("Point management commands.")
    .addSubcommand(addCommand.data)
    .addSubcommand(removeCommand.data)
    .addSubcommand(checkerCommand.data);

const commands = [
    pointCommand.toJSON(),

    banCommand.data.toJSON(),
    clearWarningsCommand.data.toJSON(),
    muteCommand.data.toJSON(),
    unbanCommand.data.toJSON(),
    unmuteCommand.data.toJSON(),
    warnCommand.data.toJSON(),
    warningsCommand.data.toJSON(),

    clankerCommand.data.toJSON(),
    fuckyouCommand.data.toJSON()
];

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log("Started refreshing slash commands.");

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            { body: commands }
        );

        console.log("Successfully registered slash commands.");
    } catch (error) {
        console.error(error);
    }
})();