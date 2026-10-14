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
    Routes 
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

// Arquivos de dados
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

// Registro dos Comandos Slash
const commands = [
    new SlashCommandBuilder()
        .setName('painel-administrativo')
        .setDescription('Abre o painel de configuração do bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
        .setName('setar-ticket')
        .setDescription('Envia a mensagem com o botão de criação de ticket no canal atual')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(`Bot online como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Comandos Slash registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
});

// Evento de Boas-Vindas
client.on('guildMemberAdd', async (member) => {
    const config = loadJSON(configPath);
    
    // Cargo Automático
    if (config.autoRoleId) {
        const role = member.guild.roles.cache.get(config.autoRoleId);
        if (role) await member.roles.add(role).catch(err => console.error('Erro ao dar cargo:', err));
    }

    // Canal de Boas-Vindas
    if (config.welcomeChannelId) {
        const channel = member.guild.channels.cache.get(config.welcomeChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(config.welcomeTitle || 'Bem-vindo(a)!')
                .setDescription((config.welcomeDesc || 'Seja bem-vindo(a) ao servidor, {user}!').replace('{user}', member.toString()))
                .setColor(config.welcomeColor || '#00FF00');

            if (config.welcomeImageUrl) embed.setImage(config.welcomeImageUrl);

            await channel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// Evento de Saída
client.on('guildMemberRemove', async (member) => {
    const config = loadJSON(configPath);

    if (config.leaveChannelId) {
        const channel = member.guild.channels.cache.get(config.leaveChannelId);
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle(config.leaveTitle || 'Até logo!')
                .setDescription((config.leaveDesc || '{user} saiu do servidor.').replace('{user}', member.user.tag))
                .setColor(config.leaveColor || '#FF0000');

            if (config.leaveImageUrl) embed.setImage(config.leaveImageUrl);

            await channel.send({ embeds: [embed] }).catch(console.error);
        }
    }
});

// Tratamento de Interações
client.on('interactionCreate', async (interaction) => {
    
    // 1. Comandos Slash
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'painel-administrativo') {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_welcome').setLabel('Boas-Vindas').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cfg_leave').setLabel('Saída').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('cfg_autorole').setLabel('Cargo Auto').setStyle(ButtonStyle.Success)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cfg_ticket').setLabel('Config Categoria Ticket').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('cfg_logs').setLabel('Config Canal Logs').setStyle(ButtonStyle.Danger)
            );

            const embed = new EmbedBuilder()
                .setTitle('⚙️ Painel Administrativo')
                .setDescription('Selecione abaixo o módulo que deseja configurar:')
                .setColor('#2F3136');

            await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
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

    // 2. Botões
    if (interaction.isButton()) {
        const config = loadJSON(configPath);

        if (interaction.customId === 'cfg_welcome') {
            const modal = new ModalBuilder().setCustomId('modal_welcome').setTitle('Configurar Boas-Vindas');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ch_id').setLabel('ID do Canal').setStyle(TextInputStyle.Short).setValue(config.welcomeChannelId || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(config.welcomeTitle || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição ({user} p/ mencionar)').setStyle(TextInputStyle.Paragraph).setValue(config.welcomeDesc || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.welcomeImageUrl || ''))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_leave') {
            const modal = new ModalBuilder().setCustomId('modal_leave').setTitle('Configurar Mensagem de Saída');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ch_id').setLabel('ID do Canal').setStyle(TextInputStyle.Short).setValue(config.leaveChannelId || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(config.leaveTitle || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(config.leaveDesc || '')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('img').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setRequired(false).setValue(config.leaveImageUrl || ''))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_autorole') {
            const modal = new ModalBuilder().setCustomId('modal_autorole').setTitle('Cargo Automático');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role_id').setLabel('ID do Cargo para novos membros').setStyle(TextInputStyle.Short).setValue(config.autoRoleId || ''))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_ticket') {
            const modal = new ModalBuilder().setCustomId('modal_ticket').setTitle('Configurar Categoria de Tickets');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_id').setLabel('ID da Categoria').setStyle(TextInputStyle.Short).setValue(config.ticketCategoryId || ''))
            );
            await interaction.showModal(modal);
        }

        if (interaction.customId === 'cfg_logs') {
            const modal = new ModalBuilder().setCustomId('modal_logs').setTitle('Configurar Canal de Logs');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('logs_id').setLabel('ID do Canal de Logs').setStyle(TextInputStyle.Short).setValue(config.logsChannelId || ''))
            );
            await interaction.showModal(modal);
        }

        // Criar Ticket
        if (interaction.customId === 'create_ticket') {
            const guild = interaction.guild;
            const user = interaction.user;

            try {
                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
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
                tickets.list.push({ channelId: ticketChannel.id, userId: user.id, status: 'open' });
                saveJSON(ticketsPath, tickets);

                const embed = new EmbedBuilder()
                    .setTitle(`Ticket de ${user.username}`)
                    .setDescription('Aguarde o atendimento. Clique no botão abaixo para fechar o ticket.')
                    .setColor('#2F3136');

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
                );

                await ticketChannel.send({ content: `${user}`, embeds: [embed], components: [row] });
                await interaction.reply({ content: `Seu ticket foi criado: ${ticketChannel}`, ephemeral: true });
            } catch (err) {
                console.error('Erro ao criar ticket:', err);
                await interaction.reply({ content: 'Ocorreu um erro ao criar o ticket. Verifique as permissões do bot ou se o ID da categoria está correto.', ephemeral: true });
            }
        }

        // Fechar Ticket
        if (interaction.customId === 'close_ticket') {
            await interaction.reply('Este ticket será fechado em 5 segundos...');
            setTimeout(async () => {
                const tickets = loadJSON(ticketsPath);
                if (Array.isArray(tickets.list)) {
                    tickets.list = tickets.list.filter(t => t.channelId !== interaction.channel.id);
                    saveJSON(ticketsPath, tickets);
                }
                await interaction.channel.delete().catch(err => console.error('Erro ao deletar canal:', err));
            }, 5000);
        }
    }

    // 3. Modais
    if (interaction.isModalSubmit()) {
        const config = loadJSON(configPath);

        if (interaction.customId === 'modal_welcome') {
            config.welcomeChannelId = interaction.fields.getTextInputValue('ch_id');
            config.welcomeTitle = interaction.fields.getTextInputValue('title');
            config.welcomeDesc = interaction.fields.getTextInputValue('desc');
            config.welcomeImageUrl = interaction.fields.getTextInputValue('img');
            saveJSON(configPath, config);
            await interaction.reply({ content: 'Configuração de Boas-Vindas salva!', ephemeral: true });
        }

        if (interaction.customId === 'modal_leave') {
            config.leaveChannelId = interaction.fields.getTextInputValue('ch_id');
            config.leaveTitle = interaction.fields.getTextInputValue('title');
            config.leaveDesc = interaction.fields.getTextInputValue('desc');
            config.leaveImageUrl = interaction.fields.getTextInputValue('img');
            saveJSON(configPath, config);
            await interaction.reply({ content: 'Configuração de Saída salva!', ephemeral: true });
        }

        if (interaction.customId === 'modal_autorole') {
            config.autoRoleId = interaction.fields.getTextInputValue('role_id');
            saveJSON(configPath, config);
            await interaction.reply({ content: 'Cargo automático salvo!', ephemeral: true });
        }

        if (interaction.customId === 'modal_ticket') {
            config.ticketCategoryId = interaction.fields.getTextInputValue('cat_id');
            saveJSON(configPath, config);
            await interaction.reply({ content: 'Categoria de Tickets salva!', ephemeral: true });
        }

        if (interaction.customId === 'modal_logs') {
            config.logsChannelId = interaction.fields.getTextInputValue('logs_id');
            saveJSON(configPath, config);
            await interaction.reply({ content: 'Canal de Logs salvo!', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
