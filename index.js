require('dotenv').config();

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
  PermissionFlagsBits,
  REST,
  Routes
} = require('discord.js');
const mongoose = require('mongoose');

// Instância do Bot
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildBans
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

// 📌 SCHEMA DO BANCO DE DADOS (MONGOOSE)
const GuildConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  themeColor: { type: String, default: '#57F287' },
  welcomeChannel: { type: String, default: null },
  welcomeMessage: { type: String, default: 'Olá {user}, seja bem-vindo(a) ao **{server}**! Atualmente somos **{members}** membros.' },
  welcomeBanner: { type: String, default: null },
  welcomeColor: { type: String, default: '#57F287' },
  leaveChannel: { type: String, default: null },
  leaveMessage: { type: String, default: 'O membro **{user.tag}** saiu do servidor **{server}**.' },
  leaveBanner: { type: String, default: null },
  leaveColor: { type: String, default: '#ED4245' },
  autoRole: { type: String, default: null },
  ticketCategory: { type: String, default: null },
  ticketSupportRole: { type: String, default: null },
  ticketTitle: { type: String, default: '🎟️ Central de Atendimento & Suporte' },
  ticketDescription: { type: String, default: 'Selecione abaixo o departamento desejado para abrir seu atendimento privado.' },
  ticketColor: { type: String, default: '#57F287' },
  ticketBanner: { type: String, default: null },
  ticketCategories: {
    type: Array,
    default: [
      { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Tire suas dúvidas sobre o servidor ou serviços.', emoji: '❓' },
      { id: 'cat_compras', label: 'Atendimento / Compras', description: 'Suporte dedicado para vendas e orçamentos.', emoji: '📦' }
    ]
  },
  logChannel: { type: String, default: null }
});

const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);

// Cache temporário para o /cv
const cvCache = new Map();

// Helper: Buscar ou criar configuração no MongoDB
async function getGuildData(guildId) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        guildId,
        themeColor: '#57F287',
        welcomeColor: '#57F287',
        leaveColor: '#ED4245',
        ticketColor: '#57F287',
        ticketCategories: [],
        save: async () => {}
      };
    }
    let data = await GuildConfig.findOne({ guildId });
    if (!data) {
      data = await GuildConfig.create({ guildId });
    }
    return data;
  } catch (error) {
    console.error('[ERRO MONGO] Falha ao consultar banco:', error.message);
    return null;
  }
}

// Lista de Cores Predefinidas
const COLOR_OPTIONS = [
  { label: 'Verde Esmeralda', description: 'Tom verde vivo e moderno', value: '#57F287', emoji: '🟢' },
  { label: 'Azul Elétrico', description: 'Padrão clássico do Discord', value: '#5865F2', emoji: '🔵' },
  { label: 'Roxo Cyberpunk', description: 'Tom roxo destacado e elegante', value: '#9B59B6', emoji: '🟣' },
  { label: 'Vermelho Carmim', description: 'Tom vermelho forte e marcante', value: '#ED4245', emoji: '🔴' },
  { label: 'Amarelo Ouro', description: 'Tom amarelo brilhante', value: '#FEE75C', emoji: '🟡' },
  { label: 'Laranja Vivo', description: 'Tom laranja vibrante', value: '#E67E22', emoji: '🟠' },
  { label: 'Branco Minimalista', description: 'Aparência limpa e clara', value: '#FFFFFF', emoji: '⚪' },
  { label: 'Dark / Escuro', description: 'Tom escuro integrado ao tema', value: '#2F3136', emoji: '⬛' },
  { label: 'Código Personalizado (Hex)', description: 'Informe um código Hexadecimal livre', value: 'custom_hex', emoji: '✏️' }
];

// Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo avançado do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o construtor interativo de embed personalizada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banir um usuário do servidor com motivo.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário a ser banido.').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do banimento.').setRequired(false)),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Tranca o canal mantendo o histórico liberado.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Destranca o canal e libera o envio de mensagens.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens do chat com filtros.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Número de mensagens (1 a 100).').setMinValue(1).setMaxValue(100).setRequired(true))
    .addUserOption(opt => opt.setName('usuario').setDescription('Filtrar por usuário.').setRequired(false))
    .addBooleanOption(opt => opt.setName('apenas_bots').setDescription('Apagar apenas mensagens de bots.').setRequired(false))
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);

  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('[BANCO DE DADOS] Conectado ao MongoDB Atlas com sucesso!');
    } catch (err) {
      console.error('[ERRO MONGO] Falha ao conectar:', err.message);
    }
  }

  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('[SLASH] Comandos registrados com sucesso!');
    } catch (error) {
      console.error('[ERRO SLASH] Falha ao registrar comandos:', error.message);
    }
  }
});

// Helper de Variáveis
function parseVariables(text, member, guild) {
  if (!text) return '';
  return text
    .replace(/{user}/g, `${member}`)
    .replace(/{user\.tag}/g, member.user ? member.user.tag : member.tag || '')
    .replace(/{user\.id}/g, member.id)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, guild.memberCount);
}

// 👑 EMBED DO PAINEL PRINCIPAL (DESIGN PROFISSIONAL REFORMULADO)
function buildPainelEmbed(guild, db) {
  const categoriesCount = db.ticketCategories ? db.ticketCategories.length : 0;
  const isMongoConnected = mongoose.connection.readyState === 1;

  return new EmbedBuilder()
    .setAuthor({ 
      name: `SISTEMA DE GESTÃO • ${guild.name.toUpperCase()}`, 
      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
    })
    .setTitle('⚡ Painel de Controle Principal')
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Gerenciamento Central do Servidor**\n` +
      `Utilize os botões interativos abaixo para personalizar e administrar os módulos ativos.\n\n` +
      `**Status do Banco:** ${isMongoConnected ? '🟢 `Sincronizado (MongoDB Atlas)`' : '🔴 `Offline (Modo Temporário)`'}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { 
        name: '🎨 IDENTIDADE VISUAL', 
        value: `└ **Cor do Tema:** \`${db.themeColor || '#57F287'}\``, 
        inline: false 
      },
      { 
        name: '👋 MÓDULO BOAS-VINDAS', 
        value: `├ **Canal:** ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Desativado`'}\n├ **Cor Embed:** \`${db.welcomeColor || '#57F287'}\` \n└ **AutoRole:** ${db.autoRole ? `<@&${db.autoRole}>` : '`❌ Desativado`'}`, 
        inline: true 
      },
      { 
        name: '🚪 MÓDULO SAÍDA', 
        value: `├ **Canal:** ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Desativado`'}\n└ **Cor Embed:** \`${db.leaveColor || '#ED4245'}\``, 
        inline: true 
      },
      { 
        name: '🎟️ CENTRAL DE TICKETS', 
        value: `├ **Categoria:** ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`'}\n├ **Atendentes:** ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : '`❌ Não definido`'}\n├ **Cor Embed:** \`${db.ticketColor || '#57F287'}\` \n└ **Departamentos:** \`${categoriesCount} cadastrado(s)\``, 
        inline: false 
      },
      { 
        name: '📜 AUDITORIA & LOGS', 
        value: `└ **Canal de Registros:** ${db.logChannel ? `<#${db.logChannel}>` : '`❌ Desativado`'}`, 
        inline: false 
      }
    )
    .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
    .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
    .setFooter({ text: `${client.user.username} • Painel Administrativo Pro`, iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const rowConfig = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_theme').setLabel('Tema').setEmoji('🎨').setStyle(ButtonStyle.Secondary)
  );

  const rowQuickActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_lock_quick').setLabel('Trancar Chat').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_unlock_quick').setLabel('Destrancar Chat').setEmoji('🔓').setStyle(ButtonStyle.Success)
  );

  return [rowConfig, rowQuickActions];
}

// Construtor Visual /cv
function buildCvBuilderComponents(userId, defaultColor) {
  const data = cvCache.get(userId) || { title: '📌 Título do Anúncio', description: 'Escreva seu texto aqui...', color: defaultColor, image: null, targetChannel: null };

  const embedPreview = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(data.color && data.color.startsWith('#') ? data.color : '#57F287')
    .setFooter({ text: data.targetChannel ? `Canal de destino selecionado` : `Nenhum canal selecionado (enviará no canal atual)` })
    .setTimestamp();

  if (data.image && (data.image.startsWith('http://') || data.image.startsWith('https://'))) {
    embedPreview.setImage(data.image);
  }

  const rowChannel = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('cv_select_target_channel')
      .setPlaceholder('📢 Selecionar canal onde a mensagem será enviada')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  const colorSelect = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cv_select_color')
      .setPlaceholder('🎨 Escolher cor desta mensagem')
      .addOptions(COLOR_OPTIONS)
  );

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cv_btn_title').setLabel('Título').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_desc').setLabel('Texto').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_image').setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_send').setLabel('Enviar Anúncio').setEmoji('🚀').setStyle(ButtonStyle.Success)
  );

  return { embeds: [embedPreview], components: [rowChannel, colorSelect, rowButtons] };
}

// Helper Lock/Unlock
async function handleChannelLock(channel, guild, lock = true) {
  await channel.permissionOverwrites.edit(guild.roles.everyone, {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: !lock,
    SendMessagesInThreads: !lock,
    CreatePublicThreads: !lock,
    CreatePrivateThreads: !lock,
    AddReactions: !lock
  });
}

// Evento Global de Interações
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    const db = await getGuildData(interaction.guild.id);

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        const embed = buildPainelEmbed(interaction.guild, db);
        const components = buildPainelButtons();
        return interaction.reply({ embeds: [embed], components, ephemeral: true });
      }

      if (interaction.commandName === 'cv') {
        cvCache.set(interaction.user.id, {
          title: '📌 Novo Anúncio',
          description: 'Escreva a mensagem personalizada aqui usando os botões abaixo.',
          color: db.themeColor,
          image: null,
          targetChannel: null
        });

        const cvPayload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.reply({
          content: '🛠️ **Construtor Visual de Embed (/cv):**',
          embeds: cvPayload.embeds,
          components: cvPayload.components,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'ban') {
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Sem motivo informado';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) {
          return interaction.reply({ content: '❌ Usuário não encontrado no servidor.', ephemeral: true });
        }

        if (!member.bannable) {
          return interaction.reply({ content: '❌ Não tenho permissão para banir este usuário.', ephemeral: true });
        }

        await member.ban({ reason: `${reason} \vert{} Por:${interaction.user.tag}` });

        if (db.logChannel) {
          const logChan = interaction.guild.channels.cache.get(db.logChannel);
          if (logChan) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔨 Membro Banido')
              .addFields(
                { name: '👤 Usuário Banido', value: `${targetUser.tag} (\`${targetUser.id}\`)` },
                { name: '🛡️ Autor do Ban', value: `${interaction.user}` },
                { name: '📌 Motivo', value: reason }
              )
              .setColor('#ED4245')
              .setTimestamp();
            logChan.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return interaction.reply({ content: `✅ O usuário **${targetUser.tag}** foi banido com sucesso! Motivo: \`${reason}\`` });
      }

      if (interaction.commandName === 'lock') {
        await handleChannelLock(interaction.channel, interaction.guild, true);
        const lockEmbed = new EmbedBuilder().setTitle('🔒 Canal Trancado').setDescription('Este canal foi trancado pela moderação. Histórico liberado.').setColor('#ED4245').setTimestamp();
        return interaction.reply({ embeds: [lockEmbed] });
      }

      if (interaction.commandName === 'unlock') {
        await handleChannelLock(interaction.channel, interaction.guild, false);
        const unlockEmbed = new EmbedBuilder().setTitle('🔓 Canal Destrancado').setDescription('O chat foi liberado para envio de mensagens.').setColor('#57F287').setTimestamp();
        return interaction.reply({ embeds: [unlockEmbed] });
      }

      if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('quantidade');
        const targetUser = interaction.options.getUser('usuario');
        const onlyBots = interaction.options.getBoolean('apenas_bots');

        await interaction.deferReply({ ephemeral: true });

        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        let filteredMessages = Array.from(messages.values());

        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        filteredMessages = filteredMessages.filter(msg => msg.createdTimestamp > fourteenDaysAgo);

        if (targetUser) filteredMessages = filteredMessages.filter(msg => msg.author.id === targetUser.id);
        if (onlyBots) filteredMessages = filteredMessages.filter(msg => msg.author.bot);

        const messagesToDelete = filteredMessages.slice(0, amount);
        if (messagesToDelete.length === 0) {
          return interaction.editReply({ content: '❌ Nenhuma mensagem recente encontrada dentro do critério.' });
        }

        const deleted = await interaction.channel.bulkDelete(messagesToDelete, true);
        return interaction.editReply({ content: `🧹 **${deleted.size}** mensagem(ns) foram apagadas!` });
      }
    }

    // 2. Modais
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_cv_title') {
        const cvData = cvCache.get(interaction.user.id) || { color: db.themeColor };
        cvData.title = interaction.fields.getTextInputValue('cv_input_title');
        cvCache.set(interaction.user.id, cvData);
        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'modal_cv_desc') {
        const cvData = cvCache.get(interaction.user.id) || { color: db.themeColor };
        cvData.description = interaction.fields.getTextInputValue('cv_input_desc');
        cvCache.set(interaction.user.id, cvData);
        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'modal_cv_image') {
        const cvData = cvCache.get(interaction.user.id) || { color: db.themeColor };
        cvData.image = interaction.fields.getTextInputValue('cv_input_image') || null;
        cvCache.set(interaction.user.id, cvData);
        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'modal_cv_custom_hex') {
        const color = interaction.fields.getTextInputValue('cv_input_hex');
        const cvData = cvCache.get(interaction.user.id) || { color: db.themeColor };
        if (color.startsWith('#')) {
          cvData.color = color;
          cvCache.set(interaction.user.id, cvData);
        }
        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'modal_theme') {
        const color = interaction.fields.getTextInputValue('theme_color_input');
        if (color.startsWith('#')) {
          db.themeColor = color;
          await db.save();
          return interaction.reply({ content: `✨ Cor do Tema salva: \`${color}\`!`, ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Informe um Hexadecimal válido (ex: `#00FF00`).', ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_welcome_custom_hex') {
        const color = interaction.fields.getTextInputValue('hex_input');
        if (color.startsWith('#')) {
          db.welcomeColor = color;
          await db.save();
          return interaction.reply({ content: `✨ Cor de **Boas-Vindas** salva: \`${color}\`!`, ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_leave_custom_hex') {
        const color = interaction.fields.getTextInputValue('hex_input');
        if (color.startsWith('#')) {
          db.leaveColor = color;
          await db.save();
          return interaction.reply({ content: `✨ Cor de **Saída** salva: \`${color}\`!`, ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_ticket_custom_hex') {
        const color = interaction.fields.getTextInputValue('hex_input');
        if (color.startsWith('#')) {
          db.ticketColor = color;
          await db.save();
          return interaction.reply({ content: `✨ Cor do **Ticket** salva: \`${color}\`!`, ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_edit_welcome') {
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = interaction.fields.getTextInputValue('welcome_banner_url') || null;
        await db.save();
        return interaction.reply({ content: '✨ Configurações de **Boas-Vindas** salvas!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_leave') {
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = interaction.fields.getTextInputValue('leave_banner_url') || null;
        await db.save();
        return interaction.reply({ content: '✨ Configurações de **Saída** salvas!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_ticket_design') {
        db.ticketTitle = interaction.fields.getTextInputValue('ticket_custom_title');
        db.ticketDescription = interaction.fields.getTextInputValue('ticket_custom_desc');
        db.ticketBanner = interaction.fields.getTextInputValue('ticket_custom_banner') || null;
        await db.save();
        return interaction.reply({ content: '✨ Design do **Ticket** salvo!', ephemeral: true });
      }

      if (interaction.customId === 'modal_add_ticket_cat') {
        const label = interaction.fields.getTextInputValue('cat_label');
        const desc = interaction.fields.getTextInputValue('cat_desc');
        const emoji = interaction.fields.getTextInputValue('cat_emoji') || '📂';

        db.ticketCategories.push({ id: `cat_${Date.now()}`, label, description: desc, emoji });
        await db.save();
        return interaction.reply({ content: `✅ Categoria **${label}** salva!`, ephemeral: true });
      }

      if (interaction.customId.startsWith('modal_open_ticket_form:')) {
        if (!db.ticketCategory) return interaction.reply({ content: '❌ Categoria não definida.', ephemeral: true });

        const catId = interaction.customId.split(':')[1];
        const categoryObj = db.ticketCategories.find(c => c.id === catId);
        const selectedCategory = categoryObj ? categoryObj.label : 'Atendimento';

        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existingChannel) return interaction.reply({ content: `⚠️ Você já tem um atendimento ativo em ${existingChannel}!`, ephemeral: true });

        const permissionOverwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        if (db.ticketSupportRole) {
          permissionOverwrites.push({ id: db.ticketSupportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] });
        }

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: db.ticketCategory,
          permissionOverwrites
        });

        const ticketPanelEmbed = new EmbedBuilder()
          .setTitle(`🎟️ Atendimento: ${selectedCategory}`)
          .addFields(
            { name: '👤 Cliente', value: `${interaction.user}`, inline: true },
            { name: '📂 Categoria', value: `\`${selectedCategory}\``, inline: true },
            { name: '📌 Assunto', value: subject },
            { name: '📝 Detalhes', value: reason },
            { name: '🛠️ Atendente', value: '`Nenhum (Aguardando Staff)`' }
          )
          .setColor(db.ticketColor || db.themeColor)
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Assumir Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user} ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : ''}`, embeds: [ticketPanelEmbed], components: [ticketButtons] });
        return interaction.reply({ content: `✅ Atendimento aberto em ${channel}!`, ephemeral: true });
      }
    }

    // 3. Botões
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_lock_quick') {
        await handleChannelLock(interaction.channel, interaction.guild, true);
        return interaction.reply({ content: `🔒 Canal <#${interaction.channel.id}> **trancado**.`, ephemeral: true });
      }

      if (interaction.customId === 'btn_unlock_quick') {
        await handleChannelLock(interaction.channel, interaction.guild, false);
        return interaction.reply({ content: `🔓 Canal <#${interaction.channel.id}> **destrancado**.`, ephemeral: true });
      }

      if (interaction.customId === 'cv_btn_title') {
        const modal = new ModalBuilder().setCustomId('modal_cv_title').setTitle('Editar Título');
        const data = cvCache.get(interaction.user.id) || {};
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_input_title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(data.title || '').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'cv_btn_desc') {
        const modal = new ModalBuilder().setCustomId('modal_cv_desc').setTitle('Editar Texto');
        const data = cvCache.get(interaction.user.id) || {};
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_input_desc').setLabel('Texto').setStyle(TextInputStyle.Paragraph).setValue(data.description || '').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'cv_btn_image') {
        const modal = new ModalBuilder().setCustomId('modal_cv_image').setTitle('URL do Banner');
        const data = cvCache.get(interaction.user.id) || {};
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_input_image').setLabel('URL da Imagem').setStyle(TextInputStyle.Short).setValue(data.image || '').setRequired(false)));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'cv_btn_send') {
        const cvData = cvCache.get(interaction.user.id);
        if (!cvData) return interaction.reply({ content: '❌ Sessão expirada. Digite `/cv` novamente.', ephemeral: true });

        const targetChan = cvData.targetChannel ? interaction.guild.channels.cache.get(cvData.targetChannel) : interaction.channel;
        if (!targetChan) return interaction.reply({ content: '❌ Canal de destino inválido ou não encontrado.', ephemeral: true });

        const finalEmbed = new EmbedBuilder()
          .setTitle(cvData.title)
          .setDescription(cvData.description)
          .setColor(cvData.color || db.themeColor)
          .setTimestamp();

        if (cvData.image && (cvData.image.startsWith('http://') || cvData.image.startsWith('https://'))) {
          finalEmbed.setImage(cvData.image);
        }

        await targetChan.send({ embeds: [finalEmbed] });
        cvCache.delete(interaction.user.id);
        return interaction.update({ content: `🚀 **Anúncio enviado em ${targetChan}!**`, embeds: [], components: [] });
      }

      if (interaction.customId === 'btn_theme') {
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_theme_color').setPlaceholder('🎨 Escolha a cor do Tema').addOptions(COLOR_OPTIONS);
        return interaction.reply({ content: '🎨 **Selecione a cor do Tema Principal:**', components: [new ActionRowBuilder().addComponents(colorSelect)], ephemeral: true });
      }

      if (interaction.customId === 'btn_welcome') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('📌 Selecionar canal de boas-vindas').addChannelTypes(ChannelType.GuildText);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('🎭 Selecionar cargo AutoRole');
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_welcome_color').setPlaceholder('🎨 Cor da Embed de Boas-Vindas').addOptions(COLOR_OPTIONS);

        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_welcome_msg').setLabel('Texto & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);
        const btnPreview = new ButtonBuilder().setCustomId('btn_preview_welcome').setLabel('Testar Prévia').setEmoji('👁️').setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Boas-Vindas & AutoRole:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(colorSelect),
            new ActionRowBuilder().addComponents(btnEditMsg, btnPreview)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_preview_welcome') {
        const text = parseVariables(db.welcomeMessage, interaction.member, interaction.guild);
        const embed = new EmbedBuilder()
          .setTitle('👋 [PRÉVIA] Seja Bem-vindo(a)!')
          .setDescription(text)
          .setColor(db.welcomeColor || db.themeColor)
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        if (db.welcomeBanner && (db.welcomeBanner.startsWith('http://') || db.welcomeBanner.startsWith('https://'))) {
          embed.setImage(db.welcomeBanner);
        }

        return interaction.reply({ content: '🔍 **Pré-visualização de Boas-Vindas:**', embeds: [embed], ephemeral: true });
      }

      if (interaction.customId === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_welcome').setTitle('Configurar Boas-Vindas');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user}, {server}, {members})').setStyle(TextInputStyle.Paragraph).setValue(db.welcomeMessage).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.welcomeBanner || '').setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_leave') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_leave_channel').setPlaceholder('📌 Selecionar canal de saída').addChannelTypes(ChannelType.GuildText);
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_leave_color').setPlaceholder('🎨 Cor da Embed de Saída').addOptions(COLOR_OPTIONS);

        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_leave_msg').setLabel('Texto & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);
        const btnPreview = new ButtonBuilder().setCustomId('btn_preview_leave').setLabel('Testar Prévia').setEmoji('👁️').setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Configuração de Saída:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(colorSelect),
            new ActionRowBuilder().addComponents(btnEditMsg, btnPreview)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_preview_leave') {
        const text = parseVariables(db.leaveMessage, interaction.member, interaction.guild);
        const embed = new EmbedBuilder()
          .setTitle('🚪 [PRÉVIA] Membro Saiu')
          .setDescription(text)
          .setColor(db.leaveColor || '#ED4245')
          .setTimestamp();

        if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
          embed.setImage(db.leaveBanner);
        }

        return interaction.reply({ content: '🔍 **Pré-visualização de Saída:**', embeds: [embed], ephemeral: true });
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Configurar Saída');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user.tag}, {server})').setStyle(TextInputStyle.Paragraph).setValue(db.leaveMessage).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.leaveBanner || '').setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        const categorySelect = new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('📁 Categoria para novos canais').addChannelTypes(ChannelType.GuildCategory);
        const supportRoleSelect = new RoleSelectMenuBuilder().setCustomId('select_ticket_role').setPlaceholder('🛠️ Cargo dos Atendentes / Staff');
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_ticket_color').setPlaceholder('🎨 Cor da Embed de Ticket').addOptions(COLOR_OPTIONS);

        const btnDesign = new ButtonBuilder().setCustomId('btn_edit_ticket_design').setLabel('Design & Banner').setEmoji('🎨').setStyle(ButtonStyle.Secondary);
        const btnAddCat = new ButtonBuilder().setCustomId('btn_add_ticket_cat').setLabel('Adicionar Opção').setEmoji('➕').setStyle(ButtonStyle.Primary);
        const btnRemoveCat = new ButtonBuilder().setCustomId('btn_remove_ticket_cat').setLabel('Remover Opção').setEmoji('🗑️').setStyle(ButtonStyle.Danger);
        const btnSendTicketPanel = new ButtonBuilder().setCustomId('btn_send_ticket_panel').setLabel('Enviar Painel Aqui').setEmoji('📩').setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Gerenciamento de Tickets:**',
          components: [
            new ActionRowBuilder().addComponents(categorySelect),
            new ActionRowBuilder().addComponents(supportRoleSelect),
            new ActionRowBuilder().addComponents(colorSelect),
            new ActionRowBuilder().addComponents(btnDesign, btnAddCat, btnRemoveCat),
            new ActionRowBuilder().addComponents(btnSendTicketPanel)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_edit_ticket_design') {
        const modal = new ModalBuilder().setCustomId('modal_edit_ticket_design').setTitle('Design do Ticket');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_custom_title').setLabel('Título da Embed').setStyle(TextInputStyle.Short).setValue(db.ticketTitle).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_custom_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(db.ticketDescription).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_custom_banner').setLabel('URL Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.ticketBanner || '').setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_add_ticket_cat') {
        if (db.ticketCategories.length >= 25) return interaction.reply({ content: '❌ Limite de 25 opções atingido!', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_add_ticket_cat').setTitle('Adicionar Opção de Ticket');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_label').setLabel('Nome da Opção').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Suporte Técnico').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_desc').setLabel('Descrição Curta').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Atendimento para dúvidas').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cat_emoji').setLabel('Emoji (Opcional)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 🛠️').setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_remove_ticket_cat') {
        if (db.ticketCategories.length === 0) return interaction.reply({ content: '❌ Nenhuma opção para remover!', ephemeral: true });

        const selectMenu = new StringSelectMenuBuilder().setCustomId('select_delete_ticket_cat').setPlaceholder('🗑️ Selecione a opção para excluir')
          .addOptions(db.ticketCategories.map(cat => ({ label: cat.label, description: cat.description, value: cat.id, emoji: cat.emoji })));

        return interaction.reply({ content: 'Selecione abaixo a opção que deseja **remover**:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        if (!db.ticketCategory) return interaction.reply({ content: '❌ Defina a categoria antes de enviar!', ephemeral: true });
        if (db.ticketCategories.length === 0) return interaction.reply({ content: '❌ Adicione pelo menos uma opção antes!', ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(db.ticketTitle)
          .setDescription(db.ticketDescription)
          .setColor(db.ticketColor || db.themeColor)
          .setFooter({ text: 'Central de Atendimento' });

        if (db.ticketBanner && (db.ticketBanner.startsWith('http://') || db.ticketBanner.startsWith('https://'))) {
          ticketEmbed.setImage(db.ticketBanner);
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_ticket_type')
          .setPlaceholder('▼ Selecione uma opção para abrir seu ticket')
          .addOptions(db.ticketCategories.map(cat => ({ label: cat.label, description: cat.description, value: cat.id, emoji: cat.emoji })));

        await interaction.channel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        return interaction.reply({ content: '✅ Painel de Tickets enviado no canal!', ephemeral: true });
      }

      if (interaction.customId === 'btn_claim_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));
        if (!isStaff) return interaction.reply({ content: '❌ Apenas a equipe autorizada pode assumir tickets!', ephemeral: true });

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(4, 1, { name: '🛠️ Atendente', value: `${interaction.user}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claimed').setLabel(`Assumido por ${interaction.user.username}`).setEmoji('✅').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: `✅ Ticket assumido por ${interaction.user}!`, ephemeral: false });
      }

      if (interaction.customId === 'btn_close_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));
        if (!isStaff) return interaction.reply({ content: '❌ Apenas a equipe autorizada pode fechar tickets!', ephemeral: true });

        await interaction.reply({ content: '🔒 Fechando canal do ticket em 5 segundos...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }

      if (interaction.customId === 'btn_logs') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_log_channel').setPlaceholder('📜 Selecionar canal de logs').addChannelTypes(ChannelType.GuildText);
        return interaction.reply({ content: '⚙️ **Configuração de Logs e Moderação:**', components: [new ActionRowBuilder().addComponents(channelSelect)], ephemeral: true });
      }
    }

    // 4. Select Menus
    if (interaction.isChannelSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'cv_select_target_channel') {
        const cvData = cvCache.get(interaction.user.id) || { title: 'Título', description: 'Texto' };
        cvData.targetChannel = value;
        cvCache.set(interaction.user.id, cvData);

        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = value;
        await db.save();
        return interaction.update({ content: `✅ Canal de Boas-Vindas salvo: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_leave_channel') {
        db.leaveChannel = value;
        await db.save();
        return interaction.update({ content: `✅ Canal de Saída salvo: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_category') {
        db.ticketCategory = value;
        await db.save();
        return interaction.update({ content: `✅ Categoria de Tickets salva: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_log_channel') {
        db.logChannel = value;
        await db.save();
        return interaction.update({ content: `✅ Canal de Logs salvo: <#${value}>`, components: [] });
      }
    }

    if (interaction.isRoleSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'select_autorole') {
        db.autoRole = value;
        await db.save();
        return interaction.update({ content: `✅ Cargo AutoRole salvo: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_role') {
        db.ticketSupportRole = value;
        await db.save();
        return interaction.update({ content: `✅ Cargo Atendente salvo: <@&${value}>`, components: [] });
      }
    }

    if (interaction.isStringSelectMenu()) {
      const selectedValue = interaction.values[0];

      if (interaction.customId === 'cv_select_color') {
        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder().setCustomId('modal_cv_custom_hex').setTitle('Cor Hexadecimal');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_input_hex').setLabel('Cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }

        const cvData = cvCache.get(interaction.user.id) || { title: 'Título', description: 'Texto' };
        cvData.color = selectedValue;
        cvCache.set(interaction.user.id, cvData);

        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'select_theme_color') {
        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder().setCustomId('modal_theme').setTitle('Cor Hexadecimal');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('theme_color_input').setLabel('Cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }

        db.themeColor = selectedValue;
        await db.save();
        return interaction.update({ content: `✨ Cor do **Tema** salva: \`${selectedValue}\`!`, components: [] });
      }

      if (interaction.customId === 'select_welcome_color') {
        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder().setCustomId('modal_welcome_custom_hex').setTitle('Cor Hexadecimal');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hex_input').setLabel('Cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }

        db.welcomeColor = selectedValue;
        await db.save();
        return interaction.update({ content: `✨ Cor de **Boas-Vindas** salva: \`${selectedValue}\`!`, components: [] });
      }

      if (interaction.customId === 'select_leave_color') {
        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder().setCustomId('modal_leave_custom_hex').setTitle('Cor Hexadecimal');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hex_input').setLabel('Cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }

        db.leaveColor = selectedValue;
        await db.save();
        return interaction.update({ content: `✨ Cor de **Saída** salva: \`${selectedValue}\`!`, components: [] });
      }

      if (interaction.customId === 'select_ticket_color') {
        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder().setCustomId('modal_ticket_custom_hex').setTitle('Cor Hexadecimal');
          modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('hex_input').setLabel('Cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)));
          return interaction.showModal(modal);
        }

        db.ticketColor = selectedValue;
        await db.save();
        return interaction.update({ content: `✨ Cor do **Ticket** salva: \`${selectedValue}\`!`, components: [] });
      }

      if (interaction.customId === 'select_delete_ticket_cat') {
        const catId = interaction.values[0];
        const removedCat = db.ticketCategories.find(c => c.id === catId);
        db.ticketCategories = db.ticketCategories.filter(c => c.id !== catId);
        await db.save();
        return interaction.update({ content: `🗑️ Opção **${removedCat ? removedCat.label : 'selecionada'}** removida!`, components: [] });
      }

      if (interaction.customId === 'select_ticket_type') {
        const selectedCatId = interaction.values[0];
        const category = db.ticketCategories.find(c => c.id === selectedCatId);
        const categoryName = category ? category.label : 'Atendimento';

        const modal = new ModalBuilder().setCustomId(`modal_open_ticket_form:${selectedCatId}`).setTitle(`Atendimento: ${categoryName.slice(0, 30)}`);
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_subject').setLabel('Assunto Resumido').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ticket_reason').setLabel('Descrição Completa').setStyle(TextInputStyle.Paragraph).setRequired(true))
        );
        return interaction.showModal(modal);
      }
    }
  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// Eventos de Entrada e Saída de Membros
client.on('guildMemberAdd', async (member) => {
  const db = await getGuildData(member.guild.id);
  if (!db) return;

  if (db.autoRole) {
    await member.roles.add(db.autoRole).catch(() => {});
  }

  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = parseVariables(db.welcomeMessage, member, member.guild);

      const embed = new EmbedBuilder()
        .setTitle('👋 Seja Bem-vindo(a)!')
        .setDescription(text)
        .setColor(db.welcomeColor || db.themeColor)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      if (db.welcomeBanner && (db.welcomeBanner.startsWith('http://') || db.welcomeBanner.startsWith('https://'))) {
        embed.setImage(db.welcomeBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const db = await getGuildData(member.guild.id);
  if (!db) return;

  if (db.leaveChannel) {
    const channel = member.guild.channels.cache.get(db.leaveChannel);
    if (channel) {
      const text = parseVariables(db.leaveMessage, member, member.guild);

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(text)
        .setColor(db.leaveColor || '#ED4245')
        .setTimestamp();

      if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
        embed.setImage(db.leaveBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

// Proteção contra quedas
process.on('unhandledRejection', (reason) => console.error('[UNHANDLED REJECTION]:', reason));
process.on('uncaughtException', (err) => console.error('[UNCAUGHT EXCEPTION]:', err));

client.login(process.env.DISCORD_TOKEN);
