// src/commands/validate.js
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { validationChannelId, ledgerChannelId, staffRoleId, emoji } = require('../../config');
const { logValidationRequest, updateValidationRequest } = require('../utils/validationDatabase');
const { fetch } = require('undici');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('validar')
        .setDescription('Submete uma validação para aprovação.')
        .addAttachmentOption(option =>
            option.setName('screenshot')
                .setDescription('Anexe uma captura de tela.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('membros')
                .setDescription('Mencione os membros envolvidos (ex: <@123456789012345678>).')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('descrição')
                .setDescription('Descrição da validação.')
                .setRequired(true)),
    async execute(interaction) {
        // Corrected attachment name without space
        const screenshot = interaction.options.getAttachment('screenshot');

        // Check if the screenshot attachment exists
        if (!screenshot) {
            console.log('No screenshot attachment received.');
            return interaction.reply({ content: 'Por favor, anexe uma captura de tela válida.', ephemeral: true });
        }

        // Debug: Log attachment details
        console.log('--- Received Screenshot Attachment ---');
        console.log(`Content Type: ${screenshot.contentType}`);
        console.log(`Filename: ${screenshot.filename}`);
        console.log(`URL: ${screenshot.url}`);
        console.log(`Size: ${screenshot.size} bytes`);
        console.log('--------------------------------------');

        const members = interaction.options.getString('membros');
        const descricao = interaction.options.getString('descrição');
        const issuerId = interaction.user.id;
        const issuerUsername = interaction.user.username;

        // Define valid image MIME types and file extensions
        const validImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'image/webp'];
        const validExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
        const fileExtension = path.extname(screenshot.filename).toLowerCase();

        // Validate that the attachment is an image
        const isValidImage =
            (screenshot.contentType && validImageTypes.includes(screenshot.contentType)) ||
            (!screenshot.contentType && validExtensions.includes(fileExtension));

        if (!isValidImage) {
            console.log('Invalid image attachment.');
            return interaction.reply({
                content: 'A captura de tela deve ser uma imagem válida (PNG, JPEG, GIF, BMP, WEBP).',
                ephemeral: true
            });
        }

        try {
            // Download the attachment using undici's fetch
            const response = await fetch(screenshot.url);
            if (!response.ok) {
                throw new Error('Falha ao baixar a captura de tela.');
            }
            const buffer = Buffer.from(await response.arrayBuffer());

            // Create a new attachment to send to the validation channel
            const attachment = new AttachmentBuilder(buffer, { name: screenshot.filename });

            // Log the validation request in the database with a placeholder URL
            const validationId = await logValidationRequest(issuerId, 'PLACEHOLDER_URL', members, descricao, issuerUsername);

            // Create the embed message without the image URL for now
            const embed = new EmbedBuilder()
                .setTitle('Novo Pedido de Validação')
                .setDescription(descricao)
                .addFields(
                    { name: 'Membros', value: members },
                    { name: 'Solicitado por', value: `<@${issuerId}>` }
                )
                .setTimestamp()
                .setColor(0x00AE86);

            // Create the buttons
            const approveButton = new ButtonBuilder()
                .setCustomId(`approve_${validationId}`)
                .setLabel('Aprovar')
                .setStyle(ButtonStyle.Success);
            const denyButton = new ButtonBuilder()
                .setCustomId(`deny_${validationId}`)
                .setLabel('Negar')
                .setStyle(ButtonStyle.Danger);
            const row = new ActionRowBuilder().addComponents(approveButton, denyButton);

            // Send the embed message with the attachment and buttons to the validation channel
            const validationChannel = interaction.guild.channels.cache.get(validationChannelId);
            if (validationChannel) {
                const sentMessage = await validationChannel.send({
                    embeds: [embed],
                    components: [row],
                    files: [attachment]
                });

                // Get the URL of the uploaded attachment
                const uploadedAttachment = sentMessage.attachments.first();
                const uploadedUrl = uploadedAttachment ? uploadedAttachment.url : null;

                if (uploadedUrl) {
                    // Update the validation request with the actual message ID and attachment URL
                    await updateValidationRequest(validationId, sentMessage.id, uploadedUrl);
                    console.log(`Validation request ${validationId} updated with URL: ${uploadedUrl}`);

                    // Optionally, send a message to the ledger channel with the image URL
                    const ledgerChannel = interaction.guild.channels.cache.get(ledgerChannelId);
                    if (ledgerChannel) {
                        const ledgerEmbed = new EmbedBuilder()
                            .setTitle('Validação Registrada')
                            .setDescription(`Validação ID: ${validationId}`)
                            .addFields(
                                { name: 'Membros', value: members },
                                { name: 'Descrição', value: descricao },
                                { name: 'URL da Captura de Tela', value: `[Clique aqui](${uploadedUrl})` }
                            )
                            .setImage(uploadedUrl)
                            .setTimestamp()
                            .setColor(0x00AE86);
                        await ledgerChannel.send({ embeds: [ledgerEmbed] });
                    } else {
                        console.error('Canal do ledger não encontrado.');
                    }
                } else {
                    console.error('Nenhum anexo encontrado na mensagem enviada.');
                    await interaction.reply({ content: 'Erro: Nenhum anexo encontrado na mensagem enviada.', ephemeral: true });
                }

                await interaction.reply({ content: 'Seu pedido de validação foi enviado para aprovação.', ephemeral: true });
            } else {
                console.error('Canal de validação não encontrado.');
                await interaction.reply({ content: 'Não foi possível encontrar o canal de validação.', ephemeral: true });
            }
        } catch (error) {
            console.error('Error executing validar command:', error);
            // Reply with detailed error for debugging
            await interaction.reply({ content: `Ocorreu um erro: ${error.message}`, ephemeral: true });
        }
    },
};