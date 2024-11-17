// commands/refresh.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refresh')
        .setDescription('Refresh the application commands.'),
    async execute(interaction) {
        const botOwnerId = process.env.BOT_OWNER_ID;

        if (interaction.user.id !== botOwnerId) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const commandsPath = path.join(__dirname, '../commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        const commands = [];
        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            const command = require(filePath);
            commands.push(command.data.toJSON());
        }

        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

        try {
            console.log('Started refreshing application (/) commands.');

            // Fetch all existing commands
            const existingCommands = await rest.get(
                Routes.applicationCommands(process.env.CLIENT_ID)
            );

            // Delete all existing commands
            for (const command of existingCommands) {
                await rest.delete(
                    Routes.applicationCommand(process.env.CLIENT_ID, command.id)
                );
            }

            console.log('Successfully deleted all existing application (/) commands.');

            // Register new commands
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );

            console.log('Successfully reloaded application (/) commands.');
            interaction.reply({ content: 'Application commands refreshed successfully.', ephemeral: true });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'Failed to refresh application commands.', ephemeral: true });
        }
    },
};