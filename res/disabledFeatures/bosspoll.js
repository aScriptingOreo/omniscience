const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, StringSelectMenuBuilder, PermissionsBitField, ButtonStyle } = require('discord.js');
const { logVote, getVote, confirmVote, logVoteStake, getVoteStakes } = require('../utils/voteDatabase');
const { updateMorale } = require('../utils/updateMorale');
const { getMorale } = require('../utils/getMorale')
const { emoji } = require('../../config');

const bossOptions = [
    'Morkus', 'Excavator', 'Chernobog', 'Malakar', 'Talus', 'Ahzreil', 'Cornelius',
    'Adentus', 'Aridus', 'Grand Aelon', 'Junobote', 'Kowazan', 'Minezerok', 'Nirma'
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bosspoll')
        .setDescription('Cria uma nova votação para escolher um boss.')
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Duração da votação em minutos.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('public')
                .setDescription('Permite tornar os resultados da votação públicos a qualquer momento.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('thread')
                .setDescription('Anexar um tópico à votação?')
                .setRequired(false))
        .setDMPermission(false),

    async execute(interaction) {
        const duration = interaction.options.getInteger('duration');
        const endTime = new Date(Date.now() + duration * 60000);
        const viewVotes = interaction.options.getBoolean('public');
        const createThread = interaction.options.getBoolean('thread');

        const optionEmojis = bossOptions.map((option, index) => ({
            label: option,
            value: option,
            emoji: String.fromCodePoint(0x1F1E6 + index), // regional_indicator_a to regional_indicator_z
        }));

        const selectionMenu = new ActionRowBuilder()
            .addComponents(new StringSelectMenuBuilder()
                .setCustomId('poll')
                .setPlaceholder('Selecione um boss!')
                .addOptions(optionEmojis),
            );

        const confirmButton = new ButtonBuilder()
            .setCustomId('confirm_vote')
            .setLabel('Confirmar')
            .setStyle(ButtonStyle.Success);

        const cancelButton = new ButtonBuilder()
            .setCustomId('cancel_vote')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Danger);

        const buttonRow = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

        const embed = new EmbedBuilder()
            .setColor('#ff6633')
            .setTitle('Escolha um boss para fazer')
            .setTimestamp();

        try {
            await interaction.reply({
                embeds: [embed],
                components: [selectionMenu, buttonRow],
            });
        } catch (error) {
            console.error('Erro ao enviar a mensagem de votação:', error);
            await interaction.reply({
                content: 'Houve um erro ao criar a votação. Por favor, tente novamente.',
                ephemeral: true,
            });
            return;
        }

        const message = await interaction.fetchReply();
        await logVote(message.id, 'Escolha um boss para fazer', bossOptions, endTime, interaction.user.id);

        if (createThread) {
            try {
                await interaction.channel.threads.create({
                    startMessage: message.id,
                    name: 'Escolha um boss para fazer',
                    autoArchiveDuration: 1440,
                    reason: 'Criando um tópico para a votação.',
                });
            } catch (error) {
                console.error('Erro ao criar tópico:', error);
                const threadEmbed = new EmbedBuilder()
                    .setColor('#ff6633')
                    .setTitle('Erro ao criar tópico')
                    .setDescription('Não foi possível criar um tópico para a votação.')
                    .setTimestamp();
                await interaction.followUp({
                    embeds: [threadEmbed],
                    ephemeral: true,
                });
            }
        }

        const filter = (interaction) => interaction.customId === 'poll' && !interaction.user.bot;
        const collector = message.createMessageComponentCollector({ filter, time: duration * 60000 });

        collector.on('collect', async (interaction) => {
            const selectedOption = interaction.values[0];
            const morale = await getMorale(interaction.user.id);

            if (morale < 10) {
                await interaction.reply({
                    content: 'Você não tem moral suficiente para votar.',
                    ephemeral: true,
                });
                return;
            }

            await updateMorale(interaction.user.id, morale - 10);
            const vote = await getVote(message.id);
            await logVoteStake(vote.id, interaction.user.id, selectedOption, 10);

            const voteStakes = await getVoteStakes(vote.id);
            const totalStakes = voteStakes.reduce((sum, stake) => sum + stake.morale_staked, 0);

            const embed = EmbedBuilder.from(message.embeds[0]);
            embed.fields = bossOptions.map((option, index) => {
                const optionStakes = voteStakes.filter(stake => stake.option === option).reduce((sum, stake) => sum + stake.morale_staked, 0);
                const percentage = totalStakes > 0 ? (optionStakes / totalStakes) * 100 : 0;
                return {
                    name: `${String.fromCodePoint(0x1F1E6 + index)} ${option}`,
                    value: `${emoji} ${optionStakes} (${percentage.toFixed(2)}%)`,
                    inline: true,
                };
            });

            await message.edit({ embeds: [embed] });
            await interaction.deferUpdate();
        });

        collector.on('end', async () => {
            const vote = await getVote(message.id);
            if (vote) {
                await confirmVote(message.id);
                await message.edit({ components: [] });
                await interaction.followUp({ content: 'Votação encerrada.', ephemeral: true });
            }
        });
    }
};