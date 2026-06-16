require("dotenv").config();

const {
    REST,
    Routes,
    SlashCommandBuilder
} = require("discord.js");

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

const clankerCommand = require("./commands/Funny Commands/clanker");
const fuckyouCommand = require("./commands/Funny Commands/fuckyou");
const silenceCommand = require("./commands/Funny Commands/silence");

const pingCommand = require("./commands/utility/ping");
const eightBallCommand = require("./commands/utility/8ball");
const statusCommand = require("./commands/utility/status");
const maintenanceCommand = require("./commands/utility/maintenance");
const evalCommand = require("./commands/utility/eval");
const reloadCommand = require("./commands/utility/reload");
const restartCommand = require("./commands/utility/restart");

const verifyCommand = require("./commands/verification/verify");
const verifyAllCommand = require("./commands/verification/verifyall");

const prereleaseCommand = require("./commands/prerelease/prerelease");
const customRoleCommand = require("./commands/fun/customrole");

const seekCommand = require("./commands/music/seek");
const twentyFourSevenCommand = require("./commands/music/247");
const bassBoostCommand = require("./commands/music/bassboost");
const nightcoreCommand = require("./commands/music/nightcore");

const playCommand = require("./commands/music/play");
const skipCommand = require("./commands/music/skip");
const stopCommand = require("./commands/music/stop");
const pauseCommand = require("./commands/music/pause");
const resumeCommand = require("./commands/music/resume");
const queueCommand = require("./commands/music/queue");
const nowPlayingCommand = require("./commands/music/nowplaying");
const volumeCommand = require("./commands/music/volume");
const shuffleCommand = require("./commands/music/shuffle");
const loopCommand = require("./commands/music/loop");
const loopQueueCommand = require("./commands/music/loopqueue");
const musicRemoveCommand = require("./commands/music/remove");
const jumpCommand = require("./commands/music/jump");
const autoplayCommand = require("./commands/music/autoplay");

const massNickCommand = require("./commands/utility/massnick");

const healthCommand = require("./commands/utility/health");
const dbStatsCommand = require("./commands/utility/dbstats");
const memoryCommand = require("./commands/utility/memory");

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

    playCommand.data.toJSON(),
    skipCommand.data.toJSON(),
    stopCommand.data.toJSON(),
    pauseCommand.data.toJSON(),
    resumeCommand.data.toJSON(),
    queueCommand.data.toJSON(),
    nowPlayingCommand.data.toJSON(),
    volumeCommand.data.toJSON(),
    shuffleCommand.data.toJSON(),
    loopCommand.data.toJSON(),
    loopQueueCommand.data.toJSON(),
    musicRemoveCommand.data.toJSON(),
    jumpCommand.data.toJSON(),
    autoplayCommand.data.toJSON(),
    massNickCommand.data.toJSON(),

    clankerCommand.data.toJSON(),
    fuckyouCommand.data.toJSON(),
    silenceCommand.data.toJSON(),

    pingCommand.data.toJSON(),
    eightBallCommand.data.toJSON(),
    statusCommand.data.toJSON(),
    maintenanceCommand.data.toJSON(),
    evalCommand.data.toJSON(),
    reloadCommand.data.toJSON(),
    restartCommand.data.toJSON(),

    verifyCommand.data.toJSON(),
    verifyAllCommand.data.toJSON(),
    prereleaseCommand.data.toJSON(),
    customRoleCommand.data.toJSON(),

    healthCommand.data.toJSON(),
    dbStatsCommand.data.toJSON(),
    memoryCommand.data.toJSON(),

    seekCommand.data.toJSON(),
    twentyFourSevenCommand.data.toJSON(),
    bassBoostCommand.data.toJSON(),
    nightcoreCommand.data.toJSON()
];

const names = commands.map(command => command.name);
const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

if (duplicates.length > 0) {
    console.error("Duplicate command names found:");
    console.error(duplicates);
    process.exit(1);
}

console.log("Commands being registered:");
console.log(names);

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log("Started refreshing slash commands.");

const guildIds = [
    process.env.GUILD_ID,
    "1457695660882268334"
];

for (const guildId of guildIds) {
    console.log(`Deploying commands to guild ${guildId}...`);

    await rest.put(
        Routes.applicationGuildCommands(
            process.env.CLIENT_ID,
            guildId
        ),
        { body: commands }
    );

    console.log(`Successfully deployed commands to guild ${guildId}.`);
}

        console.log("Successfully registered slash commands.");
    } catch (error) {
        console.error(error);
    }
})();