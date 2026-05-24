require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const pointCommand = new SlashCommandBuilder()
    .setName("point")
    .setDescription("Point management commands.")
    .addSubcommand(addCommand.data)
    .addSubcommand(removeCommand.data)
    .addSubcommand(checkerCommand.data);

const commands = [
    pointCommand.toJSON()
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