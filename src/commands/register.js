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
                .setRequired(true)),
    async execute(interaction) {
        const password = interaction.options.getString('password');
        const channelId = interaction.channel.id;
        const creatorId = interaction.user.id;
        const timestamp = new Date().toISOString();

        try {
            // Create a webhook for the channel
            const webhook = await interaction.channel.createWebhook({
                name: 'Channel Bridge',
                avatar: interaction.guild.iconURL(),
                reason: 'Webhook for channel bridging'
            });

            const webhookUrl = webhook.url;

            // Insert the registration into the database
            db.run(`INSERT INTO registrations (channel_id, password, webhook_url, creator_id, timestamp) VALUES (?, ?, ?, ?, ?)`, [channelId, password, webhookUrl, creatorId, timestamp], function(err) {
                if (err) {
                    return interaction.reply({ content: 'Failed to register password.', ephemeral: true });
                }
                interaction.reply({ content: 'Password registered successfully.', ephemeral: true });
            });
        } catch (error) {
            console.error('Error creating webhook:', error.message);
            interaction.reply({ content: 'Failed to create webhook.', ephemeral: true });
        }
    },
};