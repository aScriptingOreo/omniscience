// src/commands/live.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { staffRoleId } = require('../../config');
const { updateLiveStatus } = require('../utils/liveDatabase');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('live')
        .setDescription('Atualiza o status de "ao vivo" do usuário.')
        .addBooleanOption(option =>
            option.setName('ao_vivo')
                .setDescription('Definir status de "ao vivo".')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Verifica se o usuário tem o papel de staff
        if (!interaction.member.roles.cache.has(staffRoleId)) {
            await interaction.reply({ content: 'Você não tem permissão para usar este comando.', ephemeral: true });
            return;
        }

        const aoVivo = interaction.options.getBoolean('ao_vivo');
        const userId = interaction.user.id;

        try {
            await updateLiveStatus(userId, aoVivo);
            console.log(`Updated live status for ${interaction.user.username} to ${aoVivo}`);
            await interaction.reply({ content: `Seu status de "ao vivo" foi atualizado para **${aoVivo ? 'ativo' : 'inativo'}**.`, ephemeral: true });
        } catch (error) {
            console.error('Error updating live status:', error);
            await interaction.reply({ content: 'Ocorreu um erro ao atualizar seu status.', ephemeral: true });
        }
    },
};