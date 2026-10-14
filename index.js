const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    SlashCommandBuilder, 
    REST, 
    Routes,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

// Manipulação de Dados Locais
const configPath = path.join(__dirname, 'data', 'config.json');
const ticketsPath = path.join(__dirname, 'data', 'tickets.json');

function loadJSON(filePath) {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify({}, null, 2));
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return {};
    }
}

function saveJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Função auxiliar para gerar a Embed do Painel Administrativo com Status Ativo/Inativo
function buildAdminPanelEmbed(guild, config) {
    const formatStatus = (id, mention = '') => {
        if (!id) return '🔴 **Não Configurado**';
        return `🟢 **Ativado** — ${mention || 'ID:'} \`${id}\``;
    };

    const welcomeChannel = config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '';
    const leaveChannel = config.leaveChannelId ? `<#${config.leaveChannelId}>` : '';
    const autoRole = config.autoRoleId ? `<@&${config.autoRoleId}>` : '';
    const ticketCategory = config.ticketCategoryId ? `<#${config.ticketCategoryId}>` : '';
    const logsChannel = config.logsChannelId ? `<#${config.logsChannelId}>` : '';

    return new EmbedBuilder()
        .setTitle('⚙️ Painel Administrativo do Bot')
        .setDescription('Gerencie as configurações e selecione os canais/cargos utilizando os menus interativos abaixo.')
        .setColor('#2F3136')
        .addFields(
            { name: '👋 Canal de Boas-Vindas', value: formatStatus(config.welcomeChannelId, welcomeChannel), inline: true },
            { name: '🚪 Canal de Saída', value: formatStatus(config.leaveChannelId, leaveChannel), inline: true },
            { name: '🎭 Cargo Automático (Auto-Role)', value: formatStatus(config.autoRoleId, autoRole), inline: false },
            { name: '🎫 Categoria de Tickets', value: formatStatus(config.ticketCategoryId, ticketCategory), inline: true },
            { name: '📜 Canal de Logs', value: formatStatus(config.logsChannelId, logsChannel), inline: true }
        )
        .setFooter({ text: 'Selecione uma das opções abaixo para atualizar o sistema.' })
        .setTimestamp();
}

// Registro de Comandos Slash
const commands = [
    new SlashCommandBuilder()
        .setName('painel-administrativo')
        .setDescription('Abre o painel de configuração do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('setar-ticket')
        .setDescription('Envia o painel de abertura de tickets no canal atual')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`[BOT ONLINE] Autenticado como: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('[BOT] Comandos Slash registrados com sucesso!');
    } catch (error) {
        console.error('[ERRO] Falha ao registrar comandos:', error);
    }
});

// Evento: Entrada de Membro
client.on('guildMemberAdd', async (member) => {
    const config = loadJSON(configPath);
    
    // Auto-Role
    if (config.autoRoleId) {
        try {
            const role = member.guild.roles.cache.get(config.autoRoleId) || await member.guild.roles.fetch(config.autoRoleId);
            if (role) await member.roles.add(role);
        } catch (err) {
            console.error(`[ERRO] Atribuição de cargo falhou:`, err.message);
        }
    }

    // Canal de Boas-Vindas
    if (config.welcomeChannelId) {
        try {
            const channel = member.guild.channels.cache.get(config.welcomeChannelId) || await member.guild.channels.fetch(config.welcomeChannelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(config.welcomeTitle || 'Bem-vindo(a)!')
                    .setDescription((config.welcomeDesc || 'Seja bem-vindo(a) ao servidor, {user}!').replace(/{user}/g, member.toString()))
                    .setColor(config.welcomeColor || '#00FF00');

                if (config.welcomeImageUrl) embed.setImage(config.welcomeImageUrl);

                await channel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[ERRO] Mensagem de boas-vindas falhou:', err.message);
        }
    }
});

// Evento: Saída de Membro
client.on('guildMemberRemove', async (member) => {
    const config = loadJSON(configPath);

    if (config.leaveChannelId) {
        try {
            const channel = member.guild.channels.cache.get(config.leaveChannelId) || await member.guild.channels.fetch(config.leaveChannelId);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle(config.leaveTitle || 'Até logo!')
                    .setDescription((config.leaveDesc || '{user} saiu do servidor.').replace(/{user}/g, member.user.tag))
                    .setColor(config.leaveColor || '#FF0000');

                if (config.leaveImageUrl) embed.setImage(config.leaveImageUrl);

                await channel.send({ embeds: [embed] });
            }
        } catch (err) {
            console.error('[ERRO] Mensagem de saída falhou:', err.message);
        }
    }
});

// Interações (Comandos, Menus, Botões e Modais)
client.on('interactionCreate', async (interaction) => {

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'painel-administrativo') {
            const config = loadJSON(configPath);

            const rowSelects = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_channels')
                    .setPlaceholder('📌 Selecione um Canal (Boas-Vindas / Saída / Logs)')
                    .setChannelTypes([ChannelType.GuildText])
            );

            const rowCategory = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('select_ticket_category')
                    .setPlaceholder('📂 Selecione a Categoria para Tickets')
                    .setChannelTypes([ChannelType.GuildCategory])
            );

            const rowRole = new ActionRowBuilder().addComponents(
                new RoleSelectMenuBuilder()
                    .setCustomId('select_autorole')
                    .setPlaceholder('🎭 Selecione o Cargo Automático (Auto-Role)')
            );

            const rowButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_welcome_msg').setLabel('Texto Boas-Vindas').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cfg_leave_msg').setLabel('Texto Saída').setStyle(ButtonStyle.Secondary)
            );

            const embed = buildAdminPanelEmbed(interaction.guild, config);

            await interaction.reply({
                embeds: [embed],
                components: [rowSelects, rowCategory, rowRole, rowButtons],
                ephemeral: true
            });
        }

        if (interaction.commandName === 'setar-ticket') {
            const embed = new EmbedBuilder()
                .setTitle('🎫 Suporte via Ticket')
                .setDescription('Clique no botão abaixo para abrir um ticket de atendimento privado.')
                .setColor('#5865F2');

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Abrir Ticket')
                    .setEmoji('📩')
                    .setStyle(ButtonStyle.Primary)
            );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: 'Painel de tickets enviado com sucesso!', ephemeral: true });
        }
    }

    // 2. Select Menus (Nativos do Discord v14)
    if (interaction.isChannelSelectMenu()) {
        const config = loadJSON(configPath);
        const selectedId = interaction.values[0];

        if (interaction.customId === 'select_ticket_category') {
            config.ticketCategoryId = selectedId;
            saveJSON(configPath, config);
            const embed = buildAdminPanelEmbed(interaction.guild, config);
            await interaction.update({ embeds: [embed] });
        }

        if (interaction.customId === 'select_channels') {
            // Sub-menu ou atribuição rápida
            config.welcomeChannelId = selectedId; // Define como padrão o primeiro módulo selecionado
            saveJSON(configPath, config);
            const embed = buildAdminPanelEmbed(interaction.guild, config);
            await interaction.update({ embeds: [embed] });
        }
    }

    if (interaction.isRoleSelectMenu()) {
        if (interaction.customId === 'select_autorole') {
            const config = loadJSON(configPath);
            config.autoRoleId = interaction.values[0];
            saveJSON(configPath, config);

            const embed = buildAdminPanelEmbed(interaction.guild, config);
            await interaction.update({ embeds: [embed] });
        }
    }

    // 3. Cliques em Botões
    if (interaction.isButton()) {
        const config = loadJSON(configPath);

        if (interaction.customId === 'cfg_welcome_msg') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Configurar Texto Boas-Vindas');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(config.welcomeTitle || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição ({user} p/ mencionar)').setStyle(TextInputStyle.Paragraph).setValue((config.welcomeDesc || '').slice(0, 4000))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.welcomeImageUrl || ''))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_leave_msg') {
            const modal = new ModalBuilder().setCustomId('modal_leave').setTitle('Configurar Texto de Saída');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(config.leaveTitle || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue((config.leaveDesc || '').slice(0, 4000))),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.leaveImageUrl || ''))
            );
            await interaction.showModal(modal);
        }

        // Criar Ticket
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
                    type: ChannelType.GuildText,
                    parent: config.ticketCategoryId || null,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ]
                });

                const tickets = loadJSON(ticketsPath);
                if (!Array.isArray(tickets.list)) tickets.list = [];
                tickets.list.push({ channelId: ticketChannel.id, userId: user.id, createdAt: new Date().toISOString() });
                saveJSON(ticketsPath, tickets);

                const embed = new EmbedBuilder()
                    .setTitle(`Ticket de ${user.username}`)
                    .setDescription('Aguarde o atendimento de um administrador. Clique no botão abaixo para fechar.')
                    .setColor('#2F3136');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
                await interaction.reply({ content: `Seu ticket foi criado com sucesso: ${ticketChannel}`, ephemeral: true });
            } catch (err) {
                console.error('[ERRO] Ao criar ticket:', err);
                await interaction.reply({ content: 'Erro ao criar o ticket. Verifique se a categoria está configurada no `/painel-administrativo` e se o bot possui permissão de Gerenciar Canais.', ephemeral: true });
            }
        }

        // Fechar Ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('Este ticket será encerrado e apagado em 5 segundos...');
            setTimeout(async () => {
                const tickets = loadJSON(ticketsPath);
                if (Array.isArray(tickets.list)) {
                    tickets.list = tickets.list.filter(t => t.channelId !== interaction.channel.id);
                    saveJSON(ticketsPath, tickets);
                }
                await interaction.channel.delete().catch(err => console.error('[ERRO] Ao apagar canal de ticket:', err.message));
            }, 5000);
        }
    }

    // 4. Modais
    if (interaction.isModalSubmit()) {
        const config = loadJSON(configPath);

        if (interaction.customId === 'modal_welcome') {
            config.welcomeTitle = interaction.fields.getTextInputValue('title');
            config.welcomeDesc = interaction.fields.getTextInputValue('desc');
            config.welcomeImageUrl = interaction.fields.getTextInputValue('img').trim();
            saveJSON(configPath, config);
            await interaction.reply({ content: '✅ Textos de Boas-Vindas atualizados com sucesso!', ephemeral: true });
        }

        if (interaction.customId === 'modal_leave') {
            config.leaveTitle = interaction.fields.getTextInputValue('title');
            config.leaveDesc = interaction.fields.getTextInputValue('desc');
            config.leaveImageUrl = interaction.fields.getTextInputValue('img').trim();
            saveJSON(configPath, config);
            await interaction.reply({ content: '✅ Textos de Saída atualizados com sucesso!', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
