// commands/unregister.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unregister')
        .setDescription('Unregister the password for this channel.')
        .addStringOption(option =>
            option.setName('password')
                .setDescription('The password to unregister.')
                .setRequired(true)),
    async execute(interaction) {
        const password = interaction.options.getString('password');
        const channelId = interaction.channel.id;

        db.run(`DELETE FROM registrations WHERE channel_id = ? AND password = ?`, [channelId, password], function(err) {
            if (err || this.changes === 0) {
                return interaction.reply({ content: 'Failed to unregister password. Ensure the password is correct.', ephemeral: true });
            }
            interaction.reply({ content: 'Password unregistered successfully.', ephemeral: true });
        });
    },
};