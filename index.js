require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    Collection,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require("discord.js");

const {
    initDatabase,
    isBugReportBanned,
    banBugReporter
} = require("./utils/storage");

const addCommand = require("./commands/point/add");
const removeCommand = require("./commands/point/remove");
const checkerCommand = require("./commands/point/checker");

const prereleaseCommand = require("./commands/prerelease/prerelease");
const customRoleCommand = require("./commands/fun/customrole");

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

const verifyCommand = require("./commands/verification/verify");
const verifyAllCommand = require("./commands/verification/verifyall");

const guildMemberAddEvent = require("./events/guildMemberAdd");

const { setupMusicPlayer } = require("./utils/musicPlayer");

const { startOAuthServer } = require("./utils/oauthServer");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates
    ]
});
setupMusicPlayer(client);

client.commands = new Collection();

client.commands.set("point add", addCommand);
client.commands.set("point remove", removeCommand);
client.commands.set("point checker", checkerCommand);

client.commands.set("prerelease", prereleaseCommand);
client.commands.set("customrole", customRoleCommand);

client.commands.set("play", playCommand);
client.commands.set("skip", skipCommand);
client.commands.set("stop", stopCommand);
client.commands.set("pause", pauseCommand);
client.commands.set("resume", resumeCommand);
client.commands.set("queue", queueCommand);
client.commands.set("nowplaying", nowPlayingCommand);
client.commands.set("volume", volumeCommand);
client.commands.set("shuffle", shuffleCommand);
client.commands.set("loop", loopCommand);
client.commands.set("loopqueue", loopQueueCommand);
client.commands.set("remove", musicRemoveCommand);
client.commands.set("jump", jumpCommand);
client.commands.set("autoplay", autoplayCommand);

client.commands.set("ban", banCommand);
client.commands.set("clearwarnings", clearWarningsCommand);
client.commands.set("mute", muteCommand);
client.commands.set("unban", unbanCommand);
client.commands.set("unmute", unmuteCommand);
client.commands.set("warn", warnCommand);
client.commands.set("warnings", warningsCommand);

client.commands.set("clanker", clankerCommand);
client.commands.set("fuckyou", fuckyouCommand);
client.commands.set("silence", silenceCommand);

client.commands.set("ping", pingCommand);
client.commands.set("8ball", eightBallCommand);
client.commands.set("status", statusCommand);
client.commands.set("maintenance", maintenanceCommand);
client.commands.set("eval", evalCommand);
client.commands.set("reload", reloadCommand);
client.commands.set("restart", restartCommand);

client.commands.set("verify", verifyCommand);
client.commands.set("verifyall", verifyAllCommand);

client.once("clientReady", async () => {
    try {
        await initDatabase();
        startOAuthServer(client);

        console.log("Database connected and ready.");
        console.log("Roblox connected and ready.");
        console.log(`Logged in as ${client.user.tag}`);
    } catch (error) {
        console.error("Startup failed:", error);
    }
});

client.on("guildMemberAdd", async member => {
    await guildMemberAddEvent.execute(member);
});

client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === "open_bug_report") {
                const banned = await isBugReportBanned(interaction.user.id);

                if (banned) {
                    return interaction.reply({
                        content: "You are banned from using the verification bug report system.",
                        flags: 64
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId("verify_bug_report_modal")
                    .setTitle("Verification Bug Report");

                const robloxUsernameInput = new TextInputBuilder()
                    .setCustomId("roblox_username")
                    .setLabel("Your Roblox username")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const issueInput = new TextInputBuilder()
                    .setCustomId("issue")
                    .setLabel("What went wrong?")
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(robloxUsernameInput),
                    new ActionRowBuilder().addComponents(issueInput)
                );

                return interaction.showModal(modal);
            }

            if (interaction.customId.startsWith("bug_disregard_")) {
                const userId = interaction.customId.replace("bug_disregard_", "");

                await interaction.update({
                    content: `Bug report from <@${userId}> was disregarded by ${interaction.user}.`,
                    components: []
                });

                return;
            }

            if (interaction.customId.startsWith("bug_accept_")) {
                const userId = interaction.customId.replace("bug_accept_", "");

                const user = await interaction.client.users.fetch(userId).catch(() => null);

                if (user) {
                    await user.send(
                        "Your verification bug report was accepted. Staff will manually role you soon."
                    ).catch(() => {});
                }

                await interaction.update({
                    content: `Bug report from <@${userId}> was accepted by ${interaction.user}.`,
                    components: []
                });

                return;
            }

            if (interaction.customId.startsWith("bug_ban_")) {
                const userId = interaction.customId.replace("bug_ban_", "");

                await banBugReporter(userId);

                const user = await interaction.client.users.fetch(userId).catch(() => null);

                if (user) {
                    await user.send(
                        "You have been banned from using the verification bug report system."
                    ).catch(() => {});
                }

                await interaction.update({
                    content: `<@${userId}> was banned from verification bug reports by ${interaction.user}.`,
                    components: []
                });

                return;
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === "verify_bug_report_modal") {
                const robloxUsername = interaction.fields.getTextInputValue("roblox_username");
                const issue = interaction.fields.getTextInputValue("issue");

                const guild = await interaction.client.guilds.fetch(
                    process.env.BUG_REPORT_SERVER_ID
                );

                const channel = await guild.channels.fetch(
                    process.env.BUG_REPORT_CHANNEL_ID
                );

                const embed = new EmbedBuilder()
                    .setTitle("Verification Bug Report")
                    .setColor(0xffcc00)
                    .addFields(
                        {
                            name: "Discord User",
                            value: `${interaction.user} (\`${interaction.user.id}\`)`
                        },
                        {
                            name: "Roblox Username",
                            value: robloxUsername
                        },
                        {
                            name: "Issue",
                            value: issue
                        }
                    )
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`bug_disregard_${interaction.user.id}`)
                        .setLabel("Disregard")
                        .setStyle(ButtonStyle.Secondary),

                    new ButtonBuilder()
                        .setCustomId(`bug_accept_${interaction.user.id}`)
                        .setLabel("Accept as Real Bug")
                        .setStyle(ButtonStyle.Success),

                    new ButtonBuilder()
                        .setCustomId(`bug_ban_${interaction.user.id}`)
                        .setLabel("Ban From Reports")
                        .setStyle(ButtonStyle.Danger)
                );

                await channel.send({
                    embeds: [embed],
                    components: [row]
                });

                return interaction.reply({
                    content: "Your bug report has been sent to staff.",
                    flags: 64
                });
            }
        }

        if (!interaction.isChatInputCommand()) return;

        let command;

        if (interaction.commandName === "point") {
            const subcommand = interaction.options.getSubcommand();
            command = client.commands.get(`point ${subcommand}`);
        } else {
            command = client.commands.get(interaction.commandName);
        }

        if (!command) {
            return interaction.reply({
                content: "That command does not exist.",
                flags: 64
            });
        }

        if (
            global.maintenanceMode &&
            !["maintenance", "status", "restart"].includes(interaction.commandName)
        ) {
            return interaction.reply({
                content: "The bot is currently in maintenance mode.",
                flags: 64
            });
        }

        await command.execute(interaction);
    } catch (error) {
        console.error("INTERACTION ERROR:", error);

        const errorReply = {
            content: "There was an error while running this interaction.",
            flags: 64
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorReply).catch(console.error);
        } else {
            await interaction.reply(errorReply).catch(console.error);
        }
    }
});

client.on("error", error => {
    console.error("CLIENT ERROR:", error);
});

process.on("unhandledRejection", error => {
    console.error("UNHANDLED PROMISE REJECTION:", error);
});

process.on("uncaughtException", error => {
    console.error("UNCAUGHT EXCEPTION:", error);
});

client.login(process.env.TOKEN);