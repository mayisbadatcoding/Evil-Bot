module.exports = {
    async execute(member) {
        const welcomeChannel = member.guild.channels.cache.get(
            process.env.WELCOME_CHANNEL_ID
        );

        if (welcomeChannel) {
            await welcomeChannel.send(
                `Welcome ${member}! Please verify using /verify.`
            ).catch(console.error);
        }

        await member.send(
            "Welcome! Please verify your Roblox account using /verify."
        ).catch(console.error);
    }
};