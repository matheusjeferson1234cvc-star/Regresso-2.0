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

client.once('ready', async
Description('Painel de controle central do bot')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  ];
  await client.application.commands.set(commands);
});

async function getEntityDisplay(guild, type, id) {
  if (!id) return '`Não configurado`';
  try {
    if (type === 'channel') {
      const channel = await guild.channels.fetch(id).catch(() => null);
      return channel ? `**${channel.name}**\n\`ID: ${channel.id}\`` : '`Não encontrado`';
    } else if (type === 'role') {
      const role = await guild.roles.fetch(id).catch(() => null);
      return role ? `**${role.name}**\n\`ID: ${role.id}\`` : '`Não encontrado`';
    }
  } catch {
    return '`Erro ao carregar`';
  }
  return '`Não configurado`';
}

async function sendServerLog(guild, embed) {
  if (!config.serverLogChannelId) return;
  const logChannel = guild.channels.cache.get(config.serverLogChannelId);
  if (logChannel) {
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  }
}

// Logs de Cargos e Apelidos
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  if (oldMember.nickname !== newMember.nickname) {
    const embed = new EmbedBuilder()
      .setTitle('📝 Apelido Alterado')
      .setColor(0xfee75c)
      .addFields(
        { name: 'Membro', value: `${newMember.user.tag}`, inline: true },
        { name: 'Antes', value: oldMember.nickname || '`Nenhum`', inline: true },
        { name: 'Depois', value: newMember.nickname || '`Nenhum`', inline: true }
      )
      .setTimestamp();
    sendServerLog(newMember.guild, embed);
  }

  const addedRoles = newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id));
  const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));

  if (addedRoles.size > 0 || removedRoles.size > 0) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Cargos Atualizados')
      .setColor(0x5865f2)
      .addFields({ name: 'Membro', value: `${newMember.user.tag}` })
      .setTimestamp();
    if (addedRoles.size > 0) embed.addFields({ name: 'Adicionados', value: addedRoles.map(r => r.name).join('\n') });
    if (removedRoles.size > 0) embed.addFields({ name: 'Removidos', value: removedRoles.map(r => r.name).join('\n') });
    sendServerLog(newMember.guild, embed);
  }
});

// Logs de Mensagens Deletadas
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensagem Deletada')
    .setColor(0xed4245)
    .addFields(
      { name: 'Autor', value: `${message.author.tag}`, inline: true },
      { name: 'Canal', value: `${message.channel.name}`, inline: true },
      { name: 'Conteúdo', value: message.content ? message.content.substring(0, 1024) : '`Sem texto`' }
    )
    .setTimestamp();
  sendServerLog(message.guild, embed);
});

// Logs de Mensagens Editadas
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensagem Editada')
    .setColor(0xfee75c)
    .addFields(
      { name: 'Autor', value: `${oldMessage.author.tag}` },
      { name: 'Canal', value: `${oldMessage.channel.name}` },
      { name: 'Antes', value: oldMessage.content ? oldMessage.content.substring(0, 1024) : '`Não indexado`' },
      { name: 'Depois', value: newMessage.content ? newMessage.content.substring(0, 1024) : '`Não indexado`' }
    )
    .setTimestamp();
  sendServerLog(oldMessage.guild, embed);
});

// Interações (Comandos, Botões e Modais)
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'painel-administrativo') {
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Painel Administrativo')
        .setDescription('Gerencie as configurações do servidor e tickets.')
        .setColor(0x2b2d31)
        .addFields(
          { name: '🎫 Categoria Tickets', value: await getEntityDisplay(interaction.guild, 'channel', config.ticketCategoryId), inline: true },
          { name: '📋 Canal Logs Tickets', value: await getEntityDisplay(interaction.guild, 'channel', config.logChannelId), inline: true },
          { name: '📊 Logs Gerais', value: await getEntityDisplay(interaction.guild, 'channel', config.serverLogChannelId), inline: true }
        );

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('admin_config_tickets').setLabel('Configurar Tickets').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('admin_config_logs').setLabel('Configurar Logs Gerais').setStyle(ButtonStyle.Secondary)
      );

      await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'admin_config_logs') {
      const modal = new ModalBuilder()
        .setCustomId('modal_config_logs')
        .setTitle('Configurar Logs Gerais');
      const input = new TextInputBuilder()
        .setCustomId('server_log_channel_id')
        .setLabel('ID do Canal de Logs')
        .setStyle(TextInputStyle.Short)
        .setValue(config.serverLogChannelId || '')
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await interaction.showModal(modal);
    }

    if (interaction.customId === 'admin_config_tickets') {
      const modal = new ModalBuilder()
        .setCustomId('modal_config_tickets')
        .setTitle('Configurar Tickets');
      const catInput = new TextInputBuilder()
        .setCustomId('category_id')
        .setLabel('ID da Categoria dos Tickets')
        .setStyle(TextInputStyle.Short)
        .setValue(config.ticketCategoryId || '')
        .setRequired(true);
      const logInput = new TextInputBuilder()
        .setCustomId('log_id')
        .setLabel('ID do Canal de Logs dos Tickets')
        .setStyle(TextInputStyle.Short)
        .setValue(config.logChannelId || '')
        .setRequired(true);
      modal.addComponents(
        new ActionRowBuilder().addComponents(catInput),
        new ActionRowBuilder().addComponents(logInput)
      );
      await interaction.showModal(modal);
    }

    if (interaction.customId === 'create_ticket') {
      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${interaction.member.user.username}`,
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId || undefined,
        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
        ],
      });
      tickets.push({ channelId: ticketChannel.id, userId: interaction.member.id, status: 'open' });
      saveTickets();
      await ticketChannel.send(`Ticket criado por ${interaction.member}`);
      await interaction.reply({ content: `Ticket criado: ${ticketChannel}`, ephemeral: true });
    }
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_config_logs') {
      config.serverLogChannelId = interaction.fields.getTextInputValue('server_log_channel_id');
      saveConfig();
      await interaction.reply({ content: '✅ Canal de Logs Gerais configurado!', ephemeral: true });
    }
    if (interaction.customId === 'modal_config_tickets') {
      config.ticketCategoryId = interaction.fields.getTextInputValue('category_id');
      config.logChannelId = interaction.fields.getTextInputValue('log_id');
      saveConfig();
      await interaction.reply({ content: '✅ Configurações de Tickets atualizadas!', ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
