// commands/register.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('register')
        .setDescription('Register a password for this channel.')
        .addStringOption(option =>
            option.setName('password')
                .setDescription('The password to register.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('guildname')
                .setDescription('The name of the guild to display in the webhook sender.')
                .setRequired(true)),
    async execute(interaction) {
        const password = interaction.options.getString('password');
        const guildname = interaction.options.getString('guildname');
        const channelId = interaction.channel.id;
        const creatorId = interaction.user.id;
        const timestamp = new Date().toISOString();

        try {
            // Check if the channel is already registered
            db.get(`SELECT * FROM registrations WHERE channel_id = ?`, [channelId], async (err, row) => {
                if (err) {
                    console.error('Error querying database:', err.message);
                    return interaction.reply({ content: 'An error occurred while checking the registration.', ephemeral: true });
                }

                if (row) {
                    return interaction.reply({ content: 'This channel is already registered. Please use /unregister to remove the existing registration before registering again.', ephemeral: true });
                }

                // Create a webhook for the channel
                const webhook = await interaction.channel.createWebhook({
                    name: 'Channel Bridge',
                    avatar: interaction.guild.iconURL(),
                    reason: 'Webhook for channel bridging'
                });

                const webhookUrl = webhook.url;

                // Insert the registration into the database
                db.run(`INSERT INTO registrations (channel_id, password, webhook_url, creator_id, timestamp, guildname) VALUES (?, ?, ?, ?, ?, ?)`, [channelId, password, webhookUrl, creatorId, timestamp, guildname], function(err) {
                    if (err) {
                        return interaction.reply({ content: 'Failed to register password.', ephemeral: true });
                    }
                    interaction.reply({ content: 'Password registered successfully.', ephemeral: true });
                });
            });
        } catch (error) {
            console.error('Error creating webhook:', error.message);
            interaction.reply({ content: 'Failed to create webhook.', ephemeral: true });
        }
    },
};