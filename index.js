// index.js
const { Client, GatewayIntentBits, Collection, REST, Routes, PermissionsBitField, WebhookClient } = require('discord.js');
const fs = require('fs');
const path = require('path');
const database = require('./src/database');  // Update import
require('dotenv').config();
const { reconnectAllVoiceChannels } = require('./src/utils/voiceUtils');
const Scheduler = require('./src/scheduler');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates  // Add voice states intent
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

    // Initialize scheduler
    const scheduler = new Scheduler(client);
    await scheduler.start();

    // Reconnect to all voice channels
    try {
        await reconnectAllVoiceChannels(client);
    } catch (error) {
        console.error('Failed to reconnect to voice channels:', error);
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

    database.all(`SELECT * FROM registrations WHERE channel_id = ?`, [message.channel.id])
        .then(rows => {
            if (rows.length > 0) {
                const { password, guildname } = rows[0];

                database.all(`SELECT * FROM registrations WHERE password = ? AND channel_id != ?`, [password, message.channel.id])
                    .then(async rows => {
                        const sendMessages = rows.map(async (row) => {
                            const webhookClient = new WebhookClient({ url: row.webhook_url });
                            const content = message.content;
                            const username = `[${guildname}] ${message.member.nickname || message.author.username}`;
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
                    })
                    .catch(err => {
                        console.error('Error querying database:', err.message);
                    });
            }
        })
        .catch(err => {
            console.error('Error querying database:', err.message);
        });
});

// Update voiceStateUpdate handler
client.on('voiceStateUpdate', (oldState, newState) => {
    const { handleVoiceStateUpdate } = require('./src/utils/voiceUtils');
    handleVoiceStateUpdate(oldState, newState);
});

client.login(process.env.DISCORD_TOKEN);