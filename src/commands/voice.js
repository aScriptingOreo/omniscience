const { SlashCommandBuilder } = require('@discordjs/builders');
const { ensureVoiceConnection } = require('../utils/voiceUtils');
const { EmbedBuilder } = require('discord.js');
const database = require('../database');  // Update import

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Voice channel management commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('register')
                .setDescription('Register a voice channel for linking')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The voice channel to register')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('password')
                        .setDescription('Password to link channels')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('visualizer')
                .setDescription('Show current voice channel status')),

    async execute(interaction) {
        if (interaction.options.getSubcommand() === 'register') {
            const channel = interaction.options.getChannel('channel');
            const password = interaction.options.getString('password');

            if (channel.type !== 2) {
                return interaction.reply({ content: 'Please select a voice channel!', ephemeral: true });
            }

            try {
                await new Promise((resolve, reject) => {
                    database.run(`
                        INSERT INTO voice_channels (channel_id, guild_id, password, creator_id, timestamp)
                        VALUES (?, ?, ?, ?, datetime('now'))
                    `, [channel.id, interaction.guildId, password, interaction.user.id], 
                    err => err ? reject(err) : resolve());
                });

                await ensureVoiceConnection(interaction.client, interaction.guild.id, channel.id);
                await interaction.reply({ 
                    content: `Voice channel registered with password: ${password}`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Registration error:', error);
                await interaction.reply({ 
                    content: 'Failed to register voice channel. It might already be registered.', 
                    ephemeral: true 
                });
            }
        } else if (interaction.options.getSubcommand() === 'visualizer') {
            try {
                const channelData = await new Promise((resolve, reject) => {
                    database.get('SELECT password FROM voice_channels WHERE guild_id = ?',
                        [interaction.guildId], (err, row) => err ? reject(err) : resolve(row));
                });

                if (!channelData) {
                    return interaction.reply({ 
                        content: 'No registered voice channels found in this server.',
                        ephemeral: true 
                    });
                }

                const connectedChannels = await new Promise((resolve, reject) => {
                    database.all('SELECT vc.channel_id, vc.guild_id, COUNT(vc2.user_id) as user_count ' +
                        'FROM voice_channels vc ' +
                        'LEFT JOIN voice_callers vc2 ON vc.channel_id = vc2.channel_id ' +
                        'WHERE vc.password = ? ' +
                        'GROUP BY vc.channel_id',
                        [channelData.password], (err, rows) => err ? reject(err) : resolve(rows));
                });

                const embed = new EmbedBuilder()
                    .setColor('#0099ff')
                    .setTitle('Voice Channel Network')
                    .setDescription('Currently connected voice channels')
                    .setTimestamp();

                for (const channel of connectedChannels) {
                    const guild = await interaction.client.guilds.fetch(channel.guild_id);
                    const voiceChannel = await guild.channels.fetch(channel.channel_id);
                    embed.addFields({
                        name: `${guild.name} - ${voiceChannel.name}`,
                        value: `Users connected: ${channel.user_count || 0}`,
                        inline: true
                    });
                }

                await interaction.reply({ embeds: [embed] });
            } catch (error) {
                console.error('Visualizer error:', error);
                await interaction.reply({ 
                    content: 'Failed to generate voice channel status.',
                    ephemeral: true 
                });
            }
        }
    },
};
