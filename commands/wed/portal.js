const { SlashCommandBuilder } = require('discord.js');
module.exports={data:new SlashCommandBuilder().setName('wedportal').setDescription('Get the Wes Evil Development operations portal.'),async execute(interaction){await interaction.reply({content:`WED operations portal: ${process.env.BASE_URL || 'Website URL not configured.'}`,flags:64});}};
