const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Armazenamento em memória (Para produção, considere usar um Banco de Dados)
const config = {
    welcomeChannel: null,
    exitChannel: null,
    autoRole: null,
    ticketCategory: null
};

client.on('ready', () => {
    console.log(`Bot online como ${client.user.tag}`);
});

// Evento de Boas-Vindas e Cargo Automático (Autorole)
client.on('guildMemberAdd', async (member) => {
    if (config.autoRole) {
        const role = member.guild.roles.cache.get(config.autoRole);
        if (role) await member.roles.add(role).catch(console.error);
    }

    if (config.welcomeChannel) {
        const channel = member.guild.channels.cache.get(config.welcomeChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('👋 Bem-vindo(a)!')
                .setDescription(`Olá ${member}, seja muito bem-vindo(a) ao servidor **${member.guild.name}**!`)
                .setColor('#00FF00')
                .setThumbnail(member.user.displayAvatarURL());
            await channel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// Evento de Saída de Membro
client.on('guildMemberRemove', async (member) => {
    if (config.exitChannel) {
        const channel = member.guild.channels.cache.get(config.exitChannel);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('👋 Aé mais!')
                .setDescription(`O membro **${member.user.tag}** saiu do servidor.`)
                .setColor('#FF0000');
            await channel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// Comando /painel-administrativo
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '/painel-administrativo') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('Apenas administradores podem usar este comando.');
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_panel_select')
            .setPlaceholder('Selecione um módulo para configurar...')
            .addOptions([
                {
                    label: 'Boas-Vindas & Autorole',
                    description: 'Canais de entrada, saída e cargo automático',
                    value: 'tab_welcome'
                },
                {
                    label: 'Atendimento (Tickets)',
                    description: 'Configurar categoria para suporte',
                    value: 'tab_tickets'
                },
                {
                    label: 'Regras',
                    description: 'Enviar mensagem de regras do servidor',
                    value: 'tab_rules'
                },
                {
                    label: 'Criar Embed',
                    description: 'Enviar mensagens personalizadas com imagem e cor',
                    value: 'tab_embed'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel de Configuração Geral')
            .setDescription('Escolha no menu abaixo a aba que deseja configurar.')
            .setColor('#2b2d31');

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Manipulação das Seleções e Botões
client.on('interactionCreate', async (interaction) => {
    if (interaction.isStringSelectMenu() && interaction.customId === 'admin_panel_select') {
        const selected = interaction.values[0];

        if (selected === 'tab_welcome') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_set_welcome').setLabel('Canal de Entrada').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('btn_set_exit').setLabel('Canal de Saída').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('btn_set_autorole').setLabel('Cargo Automático').setStyle(ButtonStyle.Success)
            );

            const embed = new EmbedBuilder()
                .setTitle('👋 Configuração de Entrada & Saída')
                .setDescription(`• **Entrada:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Não definido'}\n• **Saída:** ${config.exitChannel ? `<#${config.exitChannel}>` : 'Não definido'}\n• **Autorole:** ${config.autoRole ? `<@&${config.autoRole}>` : 'Não definido'}`)
                .setColor('#2b2d31');

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        if (selected === 'tab_tickets') {
            const modal = new ModalBuilder()
                .setCustomId('modal_ticket_config')
                .setTitle('Configuração de Tickets');

            const categoryInput = new TextInputBuilder()
                .setCustomId('ticket_category_id')
                .setLabel('ID da Categoria dos Tickets')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(categoryInput));
            await interaction.showModal(modal);
        }

        if (selected === 'tab_rules') {
            const modal = new ModalBuilder()
                .setCustomId('modal_rules_config')
                .setTitle('Enviar Regras');

            const channelInput = new TextInputBuilder()
                .setCustomId('rules_channel_id')
                .setLabel('ID do Canal das Regras')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const contentInput = new TextInputBuilder()
                .setCustomId('rules_text')
                .setLabel('Texto das Regras')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(channelInput),
                new ActionRowBuilder().addComponents(contentInput)
            );
            await interaction.showModal(modal);
        }

        if (selected === 'tab_embed') {
            const modal = new ModalBuilder()
                .setCustomId('modal_custom_embed')
                .setTitle('Criar Mensagem Personalizada (Embed)');

            const channelInput = new TextInputBuilder()
                .setCustomId('embed_channel_id')
                .setLabel('ID do Canal de Destino')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const titleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Título da Embed')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const descInput = new TextInputBuilder()
                .setCustomId('embed_desc')
                .setLabel('Descrição')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const colorInput = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Cor da Lateral (Ex: #00FF00)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            const imageInput = new TextInputBuilder()
                .setCustomId('embed_image')
                .setLabel('Link da Imagem (URL)')
                .setStyle(TextInputStyle.Short)
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(channelInput),
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(imageInput)
            );
            await interaction.showModal(modal);
        }
    }

    // Interações com Botões
    if (interaction.isButton()) {
        if (['btn_set_welcome', 'btn_set_exit', 'btn_set_autorole'].includes(interaction.customId)) {
            const modal = new ModalBuilder()
                .setCustomId(`modal_${interaction.customId}`)
                .setTitle('Configurar Módulo');

            const idInput = new TextInputBuilder()
                .setCustomId('input_id')
                .setLabel(interaction.customId === 'btn_set_autorole' ? 'ID do Cargo' : 'ID do Canal')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(idInput));
            await interaction.showModal(modal);
        }
    }

    // Processamento dos Modais
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_btn_set_welcome') {
            config.welcomeChannel = interaction.fields.getTextInputValue('input_id');
            await interaction.reply({ content: `✅ Canal de boas-vindas atualizado para <#${config.welcomeChannel}>!`, ephemeral: true });
        }

        if (interaction.customId === 'modal_btn_set_exit') {
            config.exitChannel = interaction.fields.getTextInputValue('input_id');
            await interaction.reply({ content: `✅ Canal de saída atualizado para <#${config.exitChannel}>!`, ephemeral: true });
        }

        if (interaction.customId === 'modal_btn_set_autorole') {
            config.autoRole = interaction.fields.getTextInputValue('input_id');
            await interaction.reply({ content: `✅ Cargo automático atualizado para <@&${config.autoRole}>!`, ephemeral: true });
        }

        if (interaction.customId === 'modal_ticket_config') {
            config.ticketCategory = interaction.fields.getTextInputValue('ticket_category_id');
            await interaction.reply({ content: `✅ Categoria de tickets configurada para ID: \`${config.ticketCategory}\`!`, ephemeral: true });
        }

        if (interaction.customId === 'modal_rules_config') {
            const channelId = interaction.fields.getTextInputValue('rules_channel_id');
            const rulesText = interaction.fields.getTextInputValue('rules_text');
            const targetChannel = interaction.guild.channels.cache.get(channelId);

            if (!targetChannel) return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('📜 Regras do Servidor')
                .setDescription(rulesText)
                .setColor('#2b2d31');

            await targetChannel.send({ embeds: [embed] });
            await interaction.reply({ content: '✅ Regras enviadas com sucesso!', ephemeral: true });
        }

        if (interaction.customId === 'modal_custom_embed') {
            const channelId = interaction.fields.getTextInputValue('embed_channel_id');
            const title = interaction.fields.getTextInputValue('embed_title');
            const desc = interaction.fields.getTextInputValue('embed_desc');
            const color = interaction.fields.getTextInputValue('embed_color') || '#2b2d31';
            const image = interaction.fields.getTextInputValue('embed_image');

            const targetChannel = interaction.guild.channels.cache.get(channelId);
            if (!targetChannel) return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });

            const
