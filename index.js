const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ChannelType,
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
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

// Armazenamento das configurações
const config = {
    welcomeChannel: null,
    exitChannel: null,
    autoRole: null,
    ticketCategory: null,
    tempEmbedChannel: {} // Armazena o canal temporário de cada usuário
};

client.on('ready', () => {
    console.log(`🤖 Bot online com sucesso como ${client.user.tag}`);
});

// Evento: Boas-Vindas + Cargo Automático
client.on('guildMemberAdd', async (member) => {
    try {
        if (config.autoRole) {
            const role = member.guild.roles.cache.get(config.autoRole);
            if (role) {
                await member.roles.add(role).catch(err => console.error('Erro de permissão ao adicionar cargo:', err.message));
            }
        }

        if (config.welcomeChannel) {
            const channel = member.guild.channels.cache.get(config.welcomeChannel);
            if (channel && channel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setTitle('👋 Bem-vindo(a)!')
                    .setDescription(`Olá ${member}, seja muito bem-vindo(a) ao **${member.guild.name}**!`)
                    .setColor('#00FF00')
                    .setThumbnail(member.user.displayAvatarURL());
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('Erro no evento guildMemberAdd:', err);
    }
});

// Evento: Saída
client.on('guildMemberRemove', async (member) => {
    try {
        if (config.exitChannel) {
            const channel = member.guild.channels.cache.get(config.exitChannel);
            if (channel && channel.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setTitle('👋 Até mais!')
                    .setDescription(`O membro **${member.user.tag}** saiu do servidor.`)
                    .setColor('#FF0000');
                await channel.send({ embeds: [embed] }).catch(() => {});
            }
        }
    } catch (err) {
        console.error('Erro no evento guildMemberRemove:', err);
    }
});

// Comando /painel-administrativo
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '/painel-administrativo') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Apenas administradores podem usar este painel.');
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_panel_select')
            .setPlaceholder('Selecione uma aba para configurar...')
            .addOptions([
                { label: 'Boas-Vindas & Autorole', description: 'Canal de entrada, saída e cargo automático', value: 'tab_welcome' },
                { label: 'Atendimento (Tickets)', description: 'Configurar categoria de tickets', value: 'tab_tickets' },
                { label: 'Regras', description: 'Enviar mensagem de regras no canal escolhido', value: 'tab_rules' },
                { label: 'Criar Embed', description: 'Enviar mensagem personalizada em qualquer canal', value: 'tab_embed' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel Administrativo')
            .setDescription('Selecione o módulo que deseja gerenciar no menu abaixo.')
            .setColor('#2b2d31');

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Gerenciador Principal de Interações
client.on('interactionCreate', async (interaction) => {
    try {
        // --- 1. SELEÇÃO DE ABAS NO MENU PRINCIPAL ---
        if (interaction.isStringSelectMenu() && interaction.customId === 'admin_panel_select') {
            const selected = interaction.values[0];

            if (selected === 'tab_welcome') {
                const btnWelcome = new ButtonBuilder().setCustomId('btn_open_welcome_select').setLabel('Configurar Entrada').setStyle(ButtonStyle.Primary);
                const btnExit = new ButtonBuilder().setCustomId('btn_open_exit_select').setLabel('Configurar Saída').setStyle(ButtonStyle.Danger);
                const btnRole = new ButtonBuilder().setCustomId('btn_open_role_select').setLabel('Configurar Autorole').setStyle(ButtonStyle.Success);

                const embed = new EmbedBuilder()
                    .setTitle('👋 Boas-Vindas, Saída & Autorole')
                    .setDescription(`• **Entrada:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Não configurado'}\n• **Saída:** ${config.exitChannel ? `<#${config.exitChannel}>` : 'Não configurado'}\n• **Autorole:** ${config.autoRole ? `<@&${config.autoRole}>` : 'Não configurado'}`)
                    .setColor('#2b2d31');

                await interaction.reply({
                    embeds: [embed],
                    components: [new ActionRowBuilder().addComponents(btnWelcome, btnExit, btnRole)],
                    ephemeral: true
                });
            }

            if (selected === 'tab_tickets') {
                const selectCategory = new ChannelSelectMenuBuilder()
                    .setCustomId('select_ticket_category')
                    .setPlaceholder('Selecionar Categoria para Tickets')
                    .setChannelTypes(ChannelType.GuildCategory);

                await interaction.reply({
                    content: '📁 Selecione a categoria onde os tickets serão criados:',
                    components: [new ActionRowBuilder().addComponents(selectCategory)],
                    ephemeral: true
                });
            }

            if (selected === 'tab_rules') {
                const selectChannel = new ChannelSelectMenuBuilder()
                    .setCustomId('select_rules_channel')
                    .setPlaceholder('Selecionar Canal para Regras')
                    .setChannelTypes(ChannelType.GuildText);

                await interaction.reply({
                    content: '📜 Selecione o canal onde as regras serão enviadas:',
                    components: [new ActionRowBuilder().addComponents(selectChannel)],
                    ephemeral: true
                });
            }

            if (selected === 'tab_embed') {
                const selectChannel = new ChannelSelectMenuBuilder()
                    .setCustomId('select_embed_channel')
                    .setPlaceholder('Selecionar Canal da Embed')
                    .setChannelTypes(ChannelType.GuildText);

                await interaction.reply({
                    content: '🎨 Selecione o canal onde deseja enviar a Embed personalizada:',
                    components: [new ActionRowBuilder().addComponents(selectChannel)],
                    ephemeral: true
                });
            }
        }

        // --- 2. BOTÕES AUXILIARES PARA EVITAR CONFLITO DE MENUS ---
        if (interaction.isButton()) {
            if (interaction.customId === 'btn_open_welcome_select') {
                const select = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('Escolha o canal de entrada').setChannelTypes(ChannelType.GuildText);
                await interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (interaction.customId === 'btn_open_exit_select') {
                const select = new ChannelSelectMenuBuilder().setCustomId('select_exit_channel').setPlaceholder('Escolha o canal de saída').setChannelTypes(ChannelType.GuildText);
                await interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (interaction.customId === 'btn_open_role_select') {
                const select = new RoleSelectMenuBuilder().setCustomId('select_auto_role').setPlaceholder('Escolha o cargo automático');
                await interaction.reply({ components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
            }

            if (interaction.customId.startsWith('btn_trigger_embed_modal_')) {
                const targetChannelId = interaction.customId.replace('btn_trigger_embed_modal_', '');

                const modal = new ModalBuilder()
                    .setCustomId(`modal_send_embed_${targetChannelId}`)
                    .setTitle('Criar Embed Personalizada');

                const titleInput = new TextInputBuilder().setCustomId('embed_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true);
                const descInput = new TextInputBuilder().setCustomId('embed_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true);
                const colorInput = new TextInputBuilder().setCustomId('embed_color').setLabel('Cor Hex (Ex: #00FF00 ou deixe vazio)').setStyle(TextInputStyle.Short).setRequired(false);
                const imageInput = new TextInputBuilder().setCustomId('embed_image').setLabel('Link da Imagem (URL)').setStyle(TextInputStyle.Short).setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(imageInput)
                );

                await interaction.showModal(modal);
            }

            if (interaction.customId.startsWith('btn_trigger_rules_modal_')) {
                const targetChannelId = interaction.customId.replace('btn_trigger_rules_modal_', '');

                const modal = new ModalBuilder()
                    .setCustomId(`modal_send_rules_${targetChannelId}`)
                    .setTitle('Escrever Regras');

                const contentInput = new TextInputBuilder().setCustomId('rules_text').setLabel('Texto das Regras').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(contentInput));

                await interaction.showModal(modal);
            }
        }

        // --- 3. MENUS DE SELEÇÃO DE CANAIS E CARGOS ---
        if (interaction.isChannelSelectMenu()) {
            if (interaction.customId === 'select_welcome_channel') {
                config.welcomeChannel = interaction.values[0];
                await interaction.reply({ content: `✅ Canal de entrada definido para <#${config.welcomeChannel}>!`, ephemeral: true });
            }

            if (interaction.customId === 'select_exit_channel') {
                config.exitChannel = interaction.values[0];
                await interaction.reply({ content: `✅ Canal de saída definido para <#${config.exitChannel}>!`, ephemeral: true });
            }

            if (interaction.customId === 'select_ticket_category') {
                config.ticketCategory = interaction.values[0];
                await interaction.reply({ content: `✅ Categoria de tickets definida para <#${config.ticketCategory}>!`, ephemeral: true });
            }

            if (interaction.customId === 'select_rules_channel') {
                const targetChannelId = interaction.values[0];
                const btn = new ButtonBuilder()
                    .setCustomId(`btn_trigger_rules_modal_${targetChannelId}`)
                    .setLabel('Escrever Texto das Regras')
                    .setStyle(ButtonStyle.Success);

                await interaction.reply({
                    content: `✅ Canal selecionado: <#${targetChannelId}>. Clique abaixo para abrir o formulário:`,
                    components: [new ActionRowBuilder().addComponents(btn)],
                    ephemeral: true
                });
            }

            if (interaction.customId === 'select_embed_channel') {
                const targetChannelId = interaction.values[0];
                const btn = new ButtonBuilder()
                    .setCustomId(`btn_trigger_embed_modal_${targetChannelId}`)
                    .setLabel('Abrir Formulário da Embed')
                    .setStyle(ButtonStyle.Primary);

                await interaction.reply({
                    content: `✅ Canal selecionado: <#${targetChannelId}>. Clique no botão abaixo para preencher os dados da Embed:`,
                    components: [new ActionRowBuilder().addComponents(btn)],
                    ephemeral: true
                });
            }
        }

        if (interaction.isRoleSelectMenu()) {
            if (interaction.customId === 'select_auto_role') {
                config.autoRole = interaction.values[0];
                await interaction.reply({ content: `✅ Cargo automático definido para <@&${config.autoRole}>!`, ephemeral: true });
            }
        }

        // --- 4. SUBMISSÃO DE MODAIS ---
        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('modal_send_rules_')) {
                const channelId = interaction.customId.replace('modal_send_rules_', '');
                const rulesText = interaction.fields.getTextInputValue('rules_text');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle('📜 Regras do Servidor')
                    .setDescription(rulesText)
                    .setColor('#2b2d31');

                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: '✅ Regras enviadas com sucesso!', ephemeral: true });
            }

            if (interaction.customId.startsWith('modal_send_embed_')) {
                const channelId = interaction.customId.replace('modal_send_embed_', '');
                const title = interaction.fields.getTextInputValue('embed_title');
                const desc = interaction.fields.getTextInputValue('embed_desc');
                let color = interaction.fields.getTextInputValue('embed_color').trim() || '#2b2d31';
                const image = interaction.fields.getTextInputValue('embed_image').trim();

                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) return interaction.reply({ content: '❌ Canal não encontrado.', ephemeral: true });

                if (color && !color.startsWith('#')) color = `#${color}`;
                if (!/^#[0-9A-F]{6}$/i.test(color)) color = '#2b2d31';

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(desc)
                    .setColor(color);

                if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
                    embed.setImage(image);
                }

                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: '✅ Embed enviada com sucesso!', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Erro na execução da interação:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocorreu um erro ao processar. Verifique o terminal.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login('SEU_TOKEN_AQUI');
