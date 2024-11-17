// src/events/voiceStateUpdate.js
const { isUserLive } = require('../utils/liveDatabase');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        const member = newState.member;
        const userId = member.id;

        console.log(`User ${member.displayName} (${userId}) voice state changed.`);

        // Check if the user is "live"
        const aoVivo = await isUserLive(userId);
        console.log(`Live status for ${member.displayName}: ${aoVivo}`);

        // If the user is "live" and joined a new voice channel
        if (aoVivo && newState.channelId && newState.channelId !== oldState.channelId) {
            const voiceChannel = newState.channel;

            console.log(`${member.displayName} joined channel ${voiceChannel.name}`);

            // Mute all other members in the channel for 3 seconds
            for (const [_, guildMember] of voiceChannel.members) {
                if (guildMember.id !== userId) {
                    try {
                        console.log(`Muting ${guildMember.displayName}`);
                        await guildMember.voice.setMute(true, 'Staff ao vivo entrou no canal');
                        // Unmute after 3 seconds
                        setTimeout(async () => {
                            try {
                                console.log(`Unmuting ${guildMember.displayName}`);
                                await guildMember.voice.setMute(false, 'Tempo de mudo concluído');
                            } catch (unmuteError) {
                                console.error(`Error unmuting ${guildMember.displayName}:`, unmuteError);
                            }
                        }, 3000);
                    } catch (muteError) {
                        console.error(`Error muting ${guildMember.displayName}:`, muteError);
                    }
                }
            }
        }
    },
};