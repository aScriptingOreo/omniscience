// index.js
const { Client, GatewayIntentBits, Collection, REST, Routes, PermissionsBitField, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');
const db = require('./src/database');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: ['CHANNEL', 'MESSAGE', 'REACTION']
});
client.commands = new Collection();

const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

const commands = [];
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

client.once('ready', async () => {
    console.log('Bot is online!');

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
    } catch (error) {
        console.error('Error refreshing application (/) commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    // Check if the user has admin permissions
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Error executing command:', error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    console.log(`Message received from ${message.author.username} in channel ${message.channel.id}`);

    db.all(`SELECT * FROM registrations WHERE channel_id = ?`, [message.channel.id], (err, rows) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return;
        }

        if (rows.length > 0) {
            const { password } = rows[0];

            db.all(`SELECT * FROM registrations WHERE password = ? AND channel_id != ?`, [password, message.channel.id], async (err, rows) => {
                if (err) {
                    console.error('Error querying database:', err.message);
                    return;
                }

                const sendMessages = rows.map(async (row) => {
                    const webhookClient = new WebhookClient({ url: row.webhook_url });
                    const content = message.content;
                    const username = `[${message.guild.name}] ${message.member.nickname || message.author.username}`;
                    const avatarURL = message.author.displayAvatarURL();

                    const embeds = message.embeds.map(embed => embed.toJSON());
                    const files = message.attachments.map(attachment => attachment.url);

                    console.log(`Sending message to webhook: ${row.webhook_url}`);
                    console.log(`Content: ${content}`);
                    console.log(`Username: ${username}`);
                    console.log(`Embeds: ${JSON.stringify(embeds)}`);
                    console.log(`Files: ${files}`);

                    try {
                        await webhookClient.send({
                            content,
                            username,
                            avatarURL,
                            embeds,
                            files
                        });
                        console.log('Message sent successfully.');
                    } catch (error) {
                        console.error('Error sending message via webhook:', error.message);
                        console.error('Webhook URL:', row.webhook_url);
                        console.error('Content:', content);
                        console.error('Username:', username);
                        console.error('Avatar URL:', avatarURL);
                        console.error('Embeds:', JSON.stringify(embeds));
                        console.error('Files:', files);
                    }
                });

                await Promise.all(sendMessages);
            });
        }
    });
});

client.login(process.env.DISCORD_TOKEN);