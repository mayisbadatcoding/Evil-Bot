require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Collection
} = require("discord.js");

const { initDatabase } = require("./utils/storage");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

client.commands.set("point add", addCommand);
client.commands.set("point remove", removeCommand);
client.commands.set("point checker", checkerCommand);

client.once("ready", async () => {
    try {
        await initDatabase();
        console.log("Database connected and ready.");
        console.log(`Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error("Database failed to initialize:", error);
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName !== "point") return;

    const subcommand = interaction.options.getSubcommand();
    const command = client.commands.get(`point ${subcommand}`);

    if (!command) {
        return interaction.reply({
            content: "That command does not exist.",
            flags: 64
        });
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);

        const errorMessage = {
            content: "There was an error while running this command.",
            flags: 64
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage).catch(console.error);
        } else {
            await interaction.reply(errorMessage).catch(console.error);
        }
    }
});

client.login(process.env.TOKEN);