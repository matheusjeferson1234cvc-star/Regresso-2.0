const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  REST,
  Routes
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Banco de dados em memória
const db = {
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  leaveChannel: null,
  leaveMessage: 'O membro **{user}** saiu do servidor.',
  leaveBanner: null,
  autoRole: null,
  ticketCategory: null,
  logChannel: null
};

// ==========================================
// REGISTRO DE COMANDOS SLASH (/cv e /painel)
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo de configurações.'),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar uma embed personalizada.')
];

client.once('ready', async () => {
  console.log(`Bot online como ${client.user.tag} (Atualização v15)`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('Comandos registrados com sucesso!');
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
});

// ==========================================
// MANIPULAÇÃO DE INTERAÇÕES
// ==========================================
client.on('interactionCreate', async (interaction) => {
  // Comandos Slash
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'painel') {
      const embed = new EmbedBuilder()
        .setTitle('⚙️ Painel de Configuração - Green Otimizações')
        .setDescription('Selecione abaixo o sistema que deseja configurar no servidor:')
        .addFields(
          { name: '👋 Boas-Vindas', value: db.welcomeChannel ? `<#${db.welcomeChannel}>` : 'Não configurado', inline: true },
          { name: '🚪 Saída', value: db.leaveChannel ? `<#${db.leaveChannel}>` : 'Não configurado', inline: true },
          { name: '🎭 AutoRole', value: db.autoRole ? `<@&${db.autoRole}>` : 'Não configurado', inline: true },
          { name: '🎟️ Categoria de Tickets', value: db.ticketCategory ? `<#${db.ticketCategory}>` : 'Não configurada', inline: true },
          { name: '📜 Logs Gerais & Bans', value: db.logChannel ? `<#${db.logChannel}>` : 'Não configurado', inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas & AutoRole').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs & Bans').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.commandName === 'cv') {
      const modal = new ModalBuilder()
        .setCustomId('modal_cv')
        .setTitle('Criar Embed Personalizada');

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cv_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cv_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cv_image').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setRequired(false)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setRequired(false)
        )
      );

      return interaction.showModal(modal);
    }
  }

  // Formulário Modal /cv
  if (interaction.isModalSubmit() && interaction.customId === 'modal_cv') {
    const title = interaction.fields.getTextInputValue('cv_title');
    const description = interaction.fields.getTextInputValue('cv_description');
    const image = interaction.fields.getTextInputValue('cv_image');
    const color = interaction.fields.getTextInputValue('cv_color') || '#00FF00';

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(color.startsWith('#') ? color : '#00FF00')
      .setTimestamp();

    if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
      embed.setImage(image);
    }

    await interaction.channel.send({ embeds: [embed] });
    return interaction.reply({ content: 'Embed enviada com sucesso!', ephemeral: true });
  }

  // Modais de Edição de Mensagem
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_edit_welcome') {
      db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
      return interaction.reply({ content: '✅ Mensagem de boas-vindas atualizada com sucesso!', ephemeral: true });
    }

    if (interaction.customId === 'modal_edit_leave') {
      db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
      return interaction.reply({ content: '✅ Mensagem de saída atualizada com sucesso!', ephemeral: true });
    }
  }

  // Botões do Painel
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_welcome') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_welcome_channel')
        .setPlaceholder('Selecione o canal de boas-vindas')
        .addChannelTypes(ChannelType.GuildText);

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('select_autorole')
        .setPlaceholder('Selecione o cargo automático (AutoRole)');

      const btnEditMsg = new ButtonBuilder()
        .setCustomId('btn_edit_welcome_msg')
        .setLabel('✍️ Editar Texto de Boas-Vindas')
        .setStyle(ButtonStyle.Secondary);

      return interaction.reply({
        content: 'Configure as Boas-Vindas, AutoRole e a mensagem personalizada:',
        components: [
          new ActionRowBuilder().addComponents(channelSelect),
          new ActionRowBuilder().addComponents(roleSelect),
          new ActionRowBuilder().addComponents(btnEditMsg)
        ],
        ephemeral: true
      });
    }

    if (interaction.customId === 'btn_edit_welcome_msg') {
      const modal = new ModalBuilder()
        .setCustomId('modal_edit_welcome')
        .setTitle('Editar Mensagem de Boas-Vindas');

      const msgInput = new TextInputBuilder()
        .setCustomId('welcome_msg_text')
        .setLabel('Texto (Use {user} e {server})')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(db.welcomeMessage)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_leave') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_leave_channel')
        .setPlaceholder('Selecione o canal de saída')
        .addChannelTypes(ChannelType.GuildText);

      const btnEditMsg = new ButtonBuilder()
        .setCustomId('btn_edit_leave_msg')
        .setLabel('✍️ Editar Texto de Saída')
        .setStyle(ButtonStyle.Secondary);

      return interaction.reply({
        content: 'Configure o canal e a mensagem de saída:',
        components: [
          new ActionRowBuilder().addComponents(channelSelect),
          new ActionRowBuilder().addComponents(btnEditMsg)
        ],
        ephemeral: true
      });
    }

    if (interaction.customId === 'btn_edit_leave_msg') {
      const modal = new ModalBuilder()
        .setCustomId('modal_edit_leave')
        .setTitle('Editar Mensagem de Saída');

      const msgInput = new TextInputBuilder()
        .setCustomId('leave_msg_text')
        .setLabel('Texto (Use {user} e {server})')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(db.leaveMessage)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'btn_tickets') {
      const categorySelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_category')
        .setPlaceholder('Selecione a categoria dos tickets')
        .addChannelTypes(ChannelType.GuildCategory);

      return interaction.reply({
        content: 'Configure onde os tickets serão criados:',
        components: [new ActionRowBuilder().addComponents(categorySelect)],
        ephemeral: true
      });
    }

    if (interaction.customId === 'btn_logs') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_log_channel')
        .setPlaceholder('Selecione o canal de logs gerais e bans')
        .addChannelTypes(ChannelType.GuildText);

      return interaction.reply({
        content: 'Configure o canal para enviar os logs de mensagens e banimentos:',
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        ephemeral: true
      });
    }
  }

  // Select Menus
  if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
    const value = interaction.values[0];

    if (interaction.customId === 'select_welcome_channel') {
      db.welcomeChannel = value;
      return interaction.update({ content: `✅ Canal de Boas-Vindas alterado para: <#${value}>`, components: [] });
    }

    if (interaction.customId === 'select_autorole') {
      db.autoRole = value;
      return interaction.update({ content: `✅ Cargo de AutoRole alterado para: <@&${value}>`, components: [] });
    }

    if (interaction.customId === 'select_leave_channel') {
      db.leaveChannel = value;
      return interaction.update({ content: `✅ Canal de Saída alterado para: <#${value}>`, components: [] });
    }

    if (interaction.customId === 'select_ticket_category') {
      db.ticketCategory = value;
      return interaction.update({ content: `✅ Categoria de Tickets definida para: <#${value}>`, components: [] });
    }

    if (interaction.customId === 'select_log_channel') {
      db.logChannel = value;
      return interaction.update({ content: `✅ Canal de Logs alterado para: <#${value}>`, components: [] });
    }
  }
});

// ==========================================
// EVENTOS DE MEMBROS E LOGS
// ==========================================

// Entrada de Membro
client.on('guildMemberAdd', async (member) => {
  if (db.autoRole) {
    try {
      await member.roles.add(db.autoRole);
    } catch (err) {
      console.error('Erro ao aplicar AutoRole:', err);
    }
  }

  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = db.welcomeMessage
        .replace(/{user}/g, `${member}`)
        .replace(/{server}/g, member.guild.name);

      const embed = new EmbedBuilder()
        .setTitle('👋 Bem-vindo(a)!')
        .setDescription(text)
        .setColor('#00FF00')
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      channel.send({ embeds: [embed] });
    }
  }
});

// Saída de Membro
client.on('guildMemberRemove', async (member) => {
  if (db.leaveChannel) {
    const channel = member.guild.channels.cache.get(db.leaveChannel);
    if (channel) {
      const text = db.leaveMessage
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name);

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(text)
        .setColor('#FF0000')
        .setTimestamp();

      channel.send({ embeds: [embed] });
    }
  }
});

// Logs de Mensagem Apagada / Editada
client.on('messageDelete', (message) => {
  if (message.author?.bot || !db.logChannel) return;
  const logChannel = message.guild?.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensagem Apagada')
    .addFields(
      { name: 'Autor', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Conteúdo', value: message.content || '*Sem conteúdo de texto*' }
    )
    .setColor('#FF4500')
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || !db.logChannel) return;
  if (oldMessage.content === newMessage.content) return;
  const logChannel = oldMessage.guild?.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensagem Editada')
    .addFields(
      { name: 'Autor', value: `${oldMessage.author.tag} (${oldMessage.author.id})`, inline: true },
      { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: 'Antes', value: oldMessage.content || '*Vazio*' },
      { name: 'Depois', value: newMessage.content || '*Vazio*' }
    )
    .setColor('#FFA500')
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

// Sistema de Logs de Banimento
client.on('guildBanAdd', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔨 Membro Banido')
    .setDescription(`O utilizador **${ban.user.tag}** (${ban.user.id}) foi banido do servidor.`)
    .setColor('#8B0000')
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

client.on('guildBanRemove', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔓 Membro Desbanido')
    .setDescription(`O utilizador **${ban.user.tag}** (${ban.user.id}) foi desbanido do servidor.`)
    .setColor('#00FF7F')
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

// Tratamento global de erros
process.on('unhandledRejection', (reason, promise) => {
  console.error(' [Erro Não Tratado - Rejeição]:', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error(' [Erro Não Tratado - Exceção]:', error, origin);
});

client.login(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
