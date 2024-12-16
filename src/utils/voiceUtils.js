const { 
    joinVoiceChannel, 
    VoiceConnectionStatus,
    createAudioPlayer,
    createAudioResource,
    NoSubscriberBehavior,
    StreamType,
    entersState,
    EndBehaviorType
} = require('@discordjs/voice');
const { ActivityType } = require('discord.js');
const path = require('path');
const database = require('../database');  // Update import to use direct export

const activeConnections = new Map();
const voicePlayers = new Map();
const sfxPlayers = new Map();
const activeStreams = new Map();
const connectedUsers = new Map(); // Track users per guild

// Sound effect paths
const joinSoundPath = path.join(__dirname, '..', 'sfx', 'join.mp3');
const leaveSoundPath = path.join(__dirname, '..', 'sfx', 'leave.mp3');

async function playSoundEffect(guildId, soundPath) {
    try {
        const connection = activeConnections.get(guildId);
        if (!connection) return;

        if (!sfxPlayers.has(guildId)) {
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            sfxPlayers.set(guildId, player);
            connection.subscribe(player);
        }

        const player = sfxPlayers.get(guildId);
        const resource = createAudioResource(soundPath, {
            inputType: StreamType.Arbitrary,
            inlineVolume: true
        });
        
        resource.volume?.setVolume(0.3);
        player.play(resource);
    } catch (error) {
        console.error('Error playing sound effect:', error);
    }
}

async function createAudioBridge(sourceGuildId, targetGuildId) {
    const sourceConn = activeConnections.get(sourceGuildId);
    const targetConn = activeConnections.get(targetGuildId);
    
    if (!sourceConn || !targetConn) return;

    if (!voicePlayers.has(targetGuildId)) {
        voicePlayers.set(targetGuildId, new Map());
    }

    if (!activeStreams.has(targetGuildId)) {
        activeStreams.set(targetGuildId, new Map());
    }

    const receiver = sourceConn.receiver;
    receiver.speaking.on('start', userId => {
        if (!activeStreams.get(targetGuildId).has(userId)) {
            const audioStream = receiver.subscribe(userId, {
                end: { 
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 200
                }
            });
            
            const player = createAudioPlayer({
                behaviors: { noSubscriber: NoSubscriberBehavior.Play }
            });
            
            const resource = createAudioResource(audioStream, {
                inputType: StreamType.Opus,
                inlineVolume: true
            });
            
            resource.volume?.setVolume(1);
            player.play(resource);
            targetConn.subscribe(player);
            
            voicePlayers.get(targetGuildId).set(userId, player);
            activeStreams.get(targetGuildId).set(userId, audioStream);

            audioStream.on('end', () => {
                const player = voicePlayers.get(targetGuildId)?.get(userId);
                if (player) {
                    player.stop();
                    voicePlayers.get(targetGuildId)?.delete(userId);
                }
                activeStreams.get(targetGuildId)?.delete(userId);
            });

            player.on('error', error => {
                console.error('Player error:', error);
                player.stop();
                voicePlayers.get(targetGuildId)?.delete(userId);
                activeStreams.get(targetGuildId)?.delete(userId);
            });
        }
    });
}

async function ensureVoiceConnection(client, guildId, channelId) {
    try {
        let connection = activeConnections.get(guildId);
        
        if (!connection || connection.state.status === VoiceConnectionStatus.Disconnected) {
            if (connection) {
                cleanupGuildResources(guildId);
                connection.destroy();
            }

            connection = joinVoiceChannel({
                channelId: channelId,
                guildId: guildId,
                adapterCreator: (await client.guilds.fetch(guildId)).voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false
            });

            connection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
                        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
                    ]);
                } catch (error) {
                    connection.destroy();
                    voicePlayers.get(guildId)?.forEach(player => player.stop());
                    voicePlayers.delete(guildId);
                    activeConnections.delete(guildId);
                }
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30000);
            activeConnections.set(guildId, connection);

            // Initialize voice players map for this guild
            voicePlayers.set(guildId, new Map());

            // Initialize user tracking for this guild
            if (!connectedUsers.has(guildId)) {
                connectedUsers.set(guildId, new Set());
            }

            // Get current users in the channel
            const guild = await client.guilds.fetch(guildId);
            const channel = await guild.channels.fetch(channelId);
            const users = connectedUsers.get(guildId);
            
            channel.members.forEach(member => {
                if (!member.user.bot) {
                    users.add(member.id);
                }
            });

            await updatePresence(client);

            // Create bridges with other channels sharing the same password
            const channelData = await database.get(
                'SELECT password FROM voice_channels WHERE guild_id = ?', 
                [guildId]
            );

            if (channelData) {
                const targets = await database.all(
                    'SELECT guild_id FROM voice_channels WHERE password = ? AND guild_id != ?',
                    [channelData.password, guildId]
                );

                for (const target of targets) {
                    await createAudioBridge(guildId, target.guild_id);
                    await createAudioBridge(target.guild_id, guildId);
                }
            }
        }

        return connection;
    } catch (error) {
        console.error('Connection error:', error);
        return null;
    }
}

async function reconnectAllVoiceChannels(client) {
    try {
        const rows = await database.all('SELECT guild_id, channel_id FROM voice_channels');
        for (const row of rows) {
            await ensureVoiceConnection(client, row.guild_id, row.channel_id);
        }
    } catch (error) {
        console.error('Reconnection error:', error);
    }
}

async function updatePresence(client) {
    try {
        let totalUsers = 0;
        let channelCount = 0;
        
        for (const [guildId, users] of connectedUsers) {
            if (users.size > 0) {
                totalUsers += users.size;
                channelCount++;
            }
        }

        const status = channelCount > 0 
            ? `${totalUsers} users in ${channelCount} channels` 
            : 'No active voice chats';

        await client.user.setActivity(status, { type: ActivityType.Watching });
    } catch (error) {
        console.error('Failed to update presence:', error);
    }
}

const handleVoiceStateUpdate = async (oldState, newState) => {
    // Handle bot being moved
    if (oldState.member.id === oldState.client.user.id) {
        try {
            const row = await database.get('SELECT channel_id FROM voice_channels WHERE guild_id = ?', 
                [oldState.guild.id]);
            if (row && row.channel_id !== newState.channelId) {
                await ensureVoiceConnection(oldState.client, oldState.guild.id, row.channel_id);
            }
        } catch (err) {
            console.error('Database error:', err);
        }
        return;
    }

    // Initialize user tracking for guilds if needed
    if (!connectedUsers.has(oldState.guild.id)) {
        connectedUsers.set(oldState.guild.id, new Set());
    }

    const users = connectedUsers.get(oldState.guild.id);
    const isInRegisteredChannel = async (channelId) => {
        if (!channelId) return false;
        const row = await database.get(
            'SELECT 1 FROM voice_channels WHERE channel_id = ?', 
            [channelId]
        );
        return !!row;
    };

    const checkVoiceChannel = async (channelId, isJoining) => {
        if (!channelId) return;
        
        const row = await database.get(
            'SELECT password FROM voice_channels WHERE channel_id = ?', 
            [channelId]
        );
        if (row) {
            const targets = await database.all(
                'SELECT guild_id FROM voice_channels WHERE password = ?',
                [row.password]
            );
            for (const target of targets) {
                await playSoundEffect(target.guild_id, 
                    isJoining ? joinSoundPath : leaveSoundPath);
            }
        }
    };

    // Handle user movements
    if (await isInRegisteredChannel(oldState.channelId) && !await isInRegisteredChannel(newState.channelId)) {
        // User left a registered channel
        users.delete(oldState.member.id);
        await checkVoiceChannel(oldState.channelId, false);
    } else if (!await isInRegisteredChannel(oldState.channelId) && await isInRegisteredChannel(newState.channelId)) {
        // User joined a registered channel
        users.add(newState.member.id);
        await checkVoiceChannel(newState.channelId, true);
    }

    // Update presence after user changes
    await updatePresence(oldState.client);
};

function cleanupGuildResources(guildId) {
    const streams = activeStreams.get(guildId);
    if (streams) {
        for (const stream of streams.values()) {
            stream.destroy();
        }
        activeStreams.delete(guildId);
    }

    const players = voicePlayers.get(guildId);
    if (players) {
        for (const player of players.values()) {
            player.stop();
        }
        voicePlayers.delete(guildId);
    }

    const sfxPlayer = sfxPlayers.get(guildId);
    if (sfxPlayer) {
        sfxPlayer.stop();
        sfxPlayers.delete(guildId);
    }

    connectedUsers.delete(guildId);
}

module.exports = {
    ensureVoiceConnection,
    reconnectAllVoiceChannels,
    getActiveConnections: () => activeConnections,
    handleVoiceStateUpdate,
    cleanupGuildResources,
    updatePresence
};
