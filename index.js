const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
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

// Instância do Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Banco de dados em memória (substitua por um banco real se necessário)
const db = {
  welcomeChannel: null,
  welcomeBanner: null,
  leaveChannel: null,
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
    console.log('Registrando comandos Slash...');
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
          { name: '📜 Logs Gerais', value: db.logChannel ? `<#${db.logChannel}>` : 'Não configurado', inline: true }
        )
        .setColor('#00FF00')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas & AutoRole').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs').setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    if (interaction.commandName === 'cv') {
      const modal = new ModalBuilder()
        .setCustomId('modal_cv')
        .setTitle('Criar Embed Personalizada');

      const titleInput = new TextInputBuilder()
        .setCustomId('cv_title')
        .setLabel('Título da Embed')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('cv_description')
        .setLabel('Descrição / Conteúdo')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const imageInput = new TextInputBuilder()
        .setCustomId('cv_image')
        .setLabel('URL da Imagem / Banner (Opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const colorInput = new TextInputBuilder()
        .setCustomId('cv_color')
        .setLabel('Cor Hexadecimal (Ex: #00FF00)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(imageInput),
        new ActionRowBuilder().addComponents(colorInput)
      );

      return interaction.showModal(modal);
    }
  }

  // Envio de Formulário Modal (/cv)
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
    return interaction.reply({ content: 'Embed criada e enviada com sucesso neste canal!', ephemeral: true });
  }

  // Interações de Botões do Painel
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_welcome') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_welcome_channel')
        .setPlaceholder('Selecione o canal de boas-vindas')
        .addChannelTypes(ChannelType.GuildText);

      const roleSelect = new RoleSelectMenuBuilder()
        .setCustomId('select_autorole')
        .setPlaceholder('Selecione o cargo automático (AutoRole)');

      return interaction.reply({
        content: 'Configure as Boas-Vindas e o AutoRole:',
        components: [
          new ActionRowBuilder().addComponents(channelSelect),
          new ActionRowBuilder().addComponents(roleSelect)
        ],
        ephemeral: true
      });
    }

    if (interaction.customId === 'btn_leave') {
      const channelSelect = new ChannelSelectMenuBuilder()
        .setCustomId('select_leave_channel')
        .setPlaceholder('Selecione o canal de saída')
        .addChannelTypes(ChannelType.GuildText);

      return interaction.reply({
        content: 'Configure o canal de saídas:',
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        ephemeral: true
      });
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
        .setPlaceholder('Selecione o canal de logs gerais')
        .addChannelTypes(ChannelType.GuildText);

      return interaction.reply({
        content: 'Configure o canal para enviar os logs gerais de mensagens:',
        components: [new ActionRowBuilder().addComponents(channelSelect)],
        ephemeral: true
      });
    }
  }

  // Interações de Select Menus
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
      return interaction.update({ content: `✅ Canal de Logs Gerais alterado para: <#${value}>`, components: [] });
    }
  }
});

// ==========================================
// EVENTOS (Boas-Vindas, Saída e Logs)
// ==========================================

// Entrou no Servidor
client.on('guildMemberAdd', async (member) => {
  // AutoRole
  if (db.autoRole) {
    try {
      await member.roles.add(db.autoRole);
    } catch (err) {
      console.error('Erro ao adicionar AutoRole:', err);
    }
  }

  // Boas-Vindas
  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('👋 Bem-vindo(a)!')
        .setDescription(`Olá ${member}, seja muito bem-vindo(a) ao servidor **${member.guild.name}**!`)
        .setColor('#00FF00')
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      channel.send({ embeds: [embed] });
    }
  }
});

// Saiu do Servidor (Mensagem no canal configurado, sem log de auditoria)
client.on('guildMemberRemove', async (member) => {
  if (db.leaveChannel) {
    const channel = member.guild.channels.cache.get(db.leaveChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(`O membro **${member.user.tag}** saiu do servidor.`)
        .setColor('#FF0000')
        .setTimestamp();

      channel.send({ embeds: [embed] });
    }
  }
});

// Log de Mensagem Apagada
client.on('messageDelete', (message) => {
  if (message.author?.bot || !db.logChannel) return;

  const logChannel = message.guild?.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensagem Apagada')
    .addFields(
      { name: 'Autor', value: `${message.author.tag} (${message.author.id})`, inline: true },
      { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Conteúdo', value: message.content || '*Sem texto (imagem/embed)*' }
    )
    .setColor('#FF4500')
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

// Log de Mensagem Editada
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

// ==========================================
// CAPTURA GLOBAL DE ERROS (process.on)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error(' [Erro Não Tratado - Rejeição de Promise]:', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error(' [Erro Não Tratado - Exceção]:', error, origin);
});

// Inicialização do Bot
client.login(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
