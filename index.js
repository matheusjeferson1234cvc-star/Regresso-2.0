require('dotenv').config(); // Puxa variáveis do .env

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
  leaveChannel: { type: String, default: null },
  leaveMessage: { type: String, default: 'O membro **{user.tag}** saiu do servidor **{server}**.' },
  leaveBanner: { type: String, default: null },
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

// Helper: Buscar ou criar configuração no MongoDB por Servidor
async function getGuildData(guildId) {
  try {
    let data = await GuildConfig.findOne({ guildId });
    if (!data) {
      data = await GuildConfig.create({ guildId });
    }
    return data;
  } catch (error) {
    console.error('[ERRO MONGO] Falha ao consultar o banco:', error);
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
  { label: 'Dark / Escuro', description: 'Tom escuro integrado ao tema do Discord', value: '#2F3136', emoji: '⬛' },
  { label: 'Digitar Código Personalizado', description: 'Informe um código Hexadecimal livre', value: 'custom_hex', emoji: '✏️' }
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
    .setName('lock')
    .setDescription('Tranca o canal mantendo a leitura do histórico liberada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Destranca o canal e libera o envio de mensagens.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens do chat com filtros avançados.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt =>
      opt.setName('quantidade')
        .setDescription('Número de mensagens a serem apagadas (1 a 100).')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    )
    .addUserOption(opt =>
      opt.setName('usuario')
        .setDescription('Apaga apenas mensagens enviadas por este usuário.')
        .setRequired(false)
    )
    .addBooleanOption(opt =>
      opt.setName('apenas_bots')
        .setDescription('Apaga apenas mensagens enviadas por bots.')
        .setRequired(false)
    )
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot inicializado como ${client.user.tag}`);  // Conectar ao MongoDB if (process.env.MONGO_URI) { try { await mongoose.connect(process.env.MONGO_URI); console.log('[BANCO DE DADOS] Conectado ao MongoDB Atlas com sucesso!'); } catch (err) { console.error('[ERRO MONGODB] Falha na conexão:', err); } } else { console.warn('[AVISO] Variável MONGO_URI não informada no arquivo .env!'); }  // Registrar Comandos if (process.env.DISCORD_TOKEN) { const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN); try { await rest.put( Routes.applicationCommands(client.user.id), { body: commands } ); console.log('[SLASH] Comandos registrados com sucesso!'); } catch (error) { console.error('[ERRO] Falha ao registrar comandos slash:', error); } } });  // Helper de Variáveis function parseVariables(text, member, guild) { if (!text) return ''; return text .replace(/{user}/g, `${member}`)
    .replace(/{user\.tag}/g, member.user ? member.user.tag : member.tag || '')
    .replace(/{user\.id}/g, member.id)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, guild.memberCount);
}

// Embed do Painel Principal
function buildPainelEmbed(guild, db) {
  const categoriesCount = db.ticketCategories ? db.ticketCategories.length : 0;

  return new EmbedBuilder()
    .setAuthor({ 
      name: `PAINEL ADMINISTRATIVO • ${guild.name.toUpperCase()}`, 
      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
    })
    .setTitle('⚡ Central de Controle & Customização')
    .setDescription(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `**Bem-vindo ao Hub de Gestão VIP.**\n` +
      `Dados salvos e sincronizados no MongoDB Cloud de forma permanente.\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { 
        name: '🎨 IDENTIDADE VISUAL', 
        value: `└ **Cor do Tema:** \`${db.themeColor || '#57F287'}\` *(Sincronizado)*`, 
        inline: false 
      },
      { 
        name: '👋 BOAS-VINDAS & AUTOROLE', 
        value: `├ **Canal:** ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Desativado`'}\n├ **Cargo:** ${db.autoRole ? `<@&${db.autoRole}>` : '`❌ Desativado`'}\n└ **Banner:** ${db.welcomeBanner ? '`✅ Ativo`' : '`❌ Sem Imagem`'}`, inline: true }, { name: '🚪 MÓDULO DE SAÍDA', value: `├ **Canal:** ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Desativado`'}\n└ **Banner:** ${db.leaveBanner ? '`✅ Ativo`' : '`❌ Sem Imagem`'}`, inline: true }, { name: '\u200B', value: '\u200B', inline: true }, { name: '🎟️ SISTEMA DE TICKETS', value: `├ **Categoria:** ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`'}\n├ **Staff:** ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : '`❌ Não definido`'}\n└ **Categorias:** \`${categoriesCount} cadastrada(s)\``, inline: true }, { name: '📜 AUDITORIA & LOGS', value: `├ **Canal:** ${db.logChannel ? `<#${db.logChannel}>` : '`❌ Desativado`'}\n└ **Eventos:** \`Deletes / Edições / Bans\``, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true }
    )
    .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Green Otimizações • Nuvem MongoDB Conectada', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_theme').setLabel('Cor do Tema').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_lock_quick').setLabel('Trancar Chat').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets & Suporte').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Central de Logs').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_unlock_quick').setLabel('Destrancar Chat').setEmoji('🔓').setStyle(ButtonStyle.Success)
  );

  return [row1, row2];
}

// Construtor /cv
function buildCvBuilderComponents(userId, defaultColor) {
  const data = cvCache.get(userId) || { title: '📌 Título do Anúncio', description: 'Escreva seu texto aqui...', color: defaultColor, image: null };

  const embedPreview = new EmbedBuilder()
    .setTitle(data.title)
    .setDescription(data.description)
    .setColor(data.color && data.color.startsWith('#') ? data.color : '#57F287')
    .setTimestamp();

  if (data.image && (data.image.startsWith('http://') || data.image.startsWith('https://'))) {
    embedPreview.setImage(data.image);
  }

  const rowButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cv_btn_title').setLabel('Título').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_desc').setLabel('Texto').setEmoji('📝').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_image').setLabel('Banner').setEmoji('🖼️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('cv_btn_send').setLabel('Enviar Embed').setEmoji('🚀').setStyle(ButtonStyle.Success)
  );

  const colorSelect = new StringSelectMenuBuilder()
    .setCustomId('cv_select_color')
    .setPlaceholder('🎨 Alterar cor desta Embed')
    .addOptions(COLOR_OPTIONS);

  return { embeds: [embedPreview], components: [new ActionRowBuilder().addComponents(colorSelect), rowButtons] };
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

// Manipulação Global de Interações
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;

    const db = await getGuildData(interaction.guild.id);
    if (!db) {
      return interaction.reply({ content: '❌ Erro de conexão com o Banco de Dados. Tente novamente em instantes.', ephemeral: true });
    }

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
          image: null
        });

        const cvPayload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.reply({
          content: '🛠️ **Construtor Visual de Embed (/cv):**',
          embeds: cvPayload.embeds,
          components: cvPayload.components,
          ephemeral: true
        });
      }

      if (interaction.commandName === 'lock') {
        await handleChannelLock(interaction.channel, interaction.guild, true);
        const lockEmbed = new EmbedBuilder()
          .setTitle('🔒 Canal Trancado')
          .setDescription('Este canal foi trancado pela equipe de administração. O histórico permanece liberado para leitura.')
          .setColor('#ED4245')
          .setTimestamp();
        return interaction.reply({ embeds: [lockEmbed] });
      }

      if (interaction.commandName === 'unlock') {
        await handleChannelLock(interaction.channel, interaction.guild, false);
        const unlockEmbed = new EmbedBuilder()
          .setTitle('🔓 Canal Destrancado')
          .setDescription('O chat foi liberado para envio de mensagens.')
          .setColor('#57F287')
          .setTimestamp();
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
          return interaction.reply({ content: `✨ Cor salva no MongoDB: \`${color}\`!`, ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Informe um Hexadecimal válido (ex: `#00FF00`).', ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_edit_welcome') {
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = interaction.fields.getTextInputValue('welcome_banner_url') || null;
        await db.save();
        return interaction.reply({ content: '✨ Configurações de **Boas-Vindas** salvas na nuvem!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_leave') {
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = interaction.fields.getTextInputValue('leave_banner_url') || null;
        await db.save();
        return interaction.reply({ content: '✨ Configurações de **Saída** salvas na nuvem!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_ticket_design') {
        db.ticketTitle = interaction.fields.getTextInputValue('ticket_custom_title');
        db.ticketDescription = interaction.fields.getTextInputValue('ticket_custom_desc');
        db.ticketColor = interaction.fields.getTextInputValue('ticket_custom_color') || db.themeColor;
        db.ticketBanner = interaction.fields.getTextInputValue('ticket_custom_banner') || null;
        await db.save();
        return interaction.reply({ content: '✨ Design do **Ticket** salvo na nuvem!', ephemeral: true });
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
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Categoria não definida nas configurações.', ephemeral: true });
        }

        const catId = interaction.customId.split(':')[1];
        const categoryObj = db.ticketCategories.find(c => c.id === catId);
        const selectedCategory = categoryObj ? categoryObj.label : 'Atendimento';

        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        const existingChannel = interaction.guild.channels.cache.find(
          c => c.name === `ticket-${interaction.user.username.toLowerCase()}`
        );

        if (existingChannel) {
          return interaction.reply({ content: `⚠️ Você já tem um atendimento ativo em ${existingChannel}!`, ephemeral: true }); }  const permissionOverwrites = [ { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] } ];  if (db.ticketSupportRole) { permissionOverwrites.push({ id: db.ticketSupportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }); }  const channel = await interaction.guild.channels.create({ name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: db.ticketCategory,
          permissionOverwrites
        });

        const ticketPanelEmbed = new EmbedBuilder()
          .setTitle(`🎟️ Atendimento: ${selectedCategory}`) .addFields( { name: '👤 Cliente', value: `${interaction.user}`, inline: true },
            { name: '📂 Categoria', value: `\`${selectedCategory}\``, inline: true },
            { name: '📌 Assunto', value: subject },
            { name: '📝 Detalhes do Pedido', value: reason },
            { name: '🛠️ Atendente Responsável', value: '`Nenhum (Aguardando Staff)`' }
          )
          .setColor(db.ticketColor && db.ticketColor.startsWith('#') ? db.ticketColor : db.themeColor)
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Assumir Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
          content: `${interaction.user}${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : ''}`, 
          embeds: [ticketPanelEmbed], 
          components: [ticketButtons] 
        });

        return interaction.reply({ content: `✅ Atendimento aberto em ${channel}!`, ephemeral: true });
      }
    }

    // 3. Botões
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_lock_quick') {
        await handleChannelLock(interaction.channel, interaction.guild, true);
        return interaction.reply({ content: `🔒 O canal <#${interaction.channel.id}> foi **trancado**. Histórico visível.`, ephemeral: true });
      }

      if (interaction.customId === 'btn_unlock_quick') {
        await handleChannelLock(interaction.channel, interaction.guild, false);
        return interaction.reply({ content: `🔓 O canal <#${interaction.channel.id}> foi **destrancado**.`, ephemeral: true }); }  if (interaction.customId === 'cv_btn_title') { const modal = new ModalBuilder().setCustomId('modal_cv_title').setTitle('Editar Título da Embed'); const data = cvCache.get(interaction.user.id) \vert{}\vert{} {}; modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cv_input_title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(data.title \vert{}\vert{} '').setRequired(true) ) ); return interaction.showModal(modal); }  if (interaction.customId === 'cv_btn_desc') { const modal = new ModalBuilder().setCustomId('modal_cv_desc').setTitle('Editar Texto da Embed'); const data = cvCache.get(interaction.user.id) \vert{}\vert{} {}; modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cv_input_desc').setLabel('Texto / Descrição').setStyle(TextInputStyle.Paragraph).setValue(data.description \vert{}\vert{} '').setRequired(true) ) ); return interaction.showModal(modal); }  if (interaction.customId === 'cv_btn_image') { const modal = new ModalBuilder().setCustomId('modal_cv_image').setTitle('URL do Banner / Imagem'); const data = cvCache.get(interaction.user.id) \vert{}\vert{} {}; modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cv_input_image').setLabel('URL da Imagem (Opcional)').setStyle(TextInputStyle.Short).setValue(data.image \vert{}\vert{} '').setRequired(false) ) ); return interaction.showModal(modal); }  if (interaction.customId === 'cv_btn_send') { const cvData = cvCache.get(interaction.user.id); if (!cvData) { return interaction.reply({ content: '❌ Sessão expirada. Digite `/cv` novamente.', ephemeral: true }); }  const finalEmbed = new EmbedBuilder() .setTitle(cvData.title) .setDescription(cvData.description) .setColor(cvData.color && cvData.color.startsWith('#') ? cvData.color : db.themeColor) .setTimestamp();  if (cvData.image && (cvData.image.startsWith('http://') \vert{}\vert{} cvData.image.startsWith('https://'))) { finalEmbed.setImage(cvData.image); }  await interaction.channel.send({ embeds: [finalEmbed] }); cvCache.delete(interaction.user.id); return interaction.update({ content: '🚀 **Embed enviada no canal com sucesso!**', embeds: [], components: [] }); }  if (interaction.customId === 'btn_theme') { const colorSelect = new StringSelectMenuBuilder() .setCustomId('select_theme_color') .setPlaceholder('🎨 Escolha uma cor para o tema do bot') .addOptions(COLOR_OPTIONS);  return interaction.reply({ content: '🎨 **Selecione abaixo a cor do tema principal:**', components: [new ActionRowBuilder().addComponents(colorSelect)], ephemeral: true }); }  if (interaction.customId === 'btn_welcome') { const channelSelect = new ChannelSelectMenuBuilder() .setCustomId('select_welcome_channel') .setPlaceholder('📌 Selecione o canal de boas-vindas') .addChannelTypes(ChannelType.GuildText);  const roleSelect = new RoleSelectMenuBuilder() .setCustomId('select_autorole') .setPlaceholder('🎭 Selecione o cargo automático (AutoRole)');  const btnEditMsg = new ButtonBuilder() .setCustomId('btn_edit_welcome_msg') .setLabel('Editar Texto & Banner') .setEmoji('✍️') .setStyle(ButtonStyle.Secondary);  const btnPreview = new ButtonBuilder() .setCustomId('btn_preview_welcome') .setLabel('👁️ Testar Prévia') .setStyle(ButtonStyle.Success);  return interaction.reply({ content: '⚙️ **Boas-Vindas & AutoRole:**', components: [ new ActionRowBuilder().addComponents(channelSelect), new ActionRowBuilder().addComponents(roleSelect), new ActionRowBuilder().addComponents(btnEditMsg, btnPreview) ], ephemeral: true }); }  if (interaction.customId === 'btn_preview_welcome') { const text = parseVariables(db.welcomeMessage, interaction.member, interaction.guild); const embed = new EmbedBuilder() .setTitle('👋 [PRÉVIA] Seja Bem-vindo(a)!') .setDescription(text) .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287') .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true })) .setTimestamp();  if (db.welcomeBanner && (db.welcomeBanner.startsWith('http://') \vert{}\vert{} db.welcomeBanner.startsWith('https://'))) { embed.setImage(db.welcomeBanner); }  return interaction.reply({ content: '🔍 **Pré-visualização de Boas-Vindas:**', embeds: [embed], ephemeral: true }); }  if (interaction.customId === 'btn_edit_welcome_msg') { const modal = new ModalBuilder() .setCustomId('modal_edit_welcome') .setTitle('Configurar Boas-Vindas');  modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user}, {server}, {members})').setStyle(TextInputStyle.Paragraph).setValue(db.welcomeMessage).setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL do Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.welcomeBanner \vert{}\vert{} '').setRequired(false) ) ); return interaction.showModal(modal); }  if (interaction.customId === 'btn_leave') { const channelSelect = new ChannelSelectMenuBuilder() .setCustomId('select_leave_channel') .setPlaceholder('📌 Selecione o canal de saída') .addChannelTypes(ChannelType.GuildText);  const btnEditMsg = new ButtonBuilder() .setCustomId('btn_edit_leave_msg') .setLabel('Editar Texto & Banner') .setEmoji('✍️') .setStyle(ButtonStyle.Secondary);  const btnPreview = new ButtonBuilder() .setCustomId('btn_preview_leave') .setLabel('👁️ Testar Prévia') .setStyle(ButtonStyle.Success);  return interaction.reply({ content: '⚙️ **Configuração de Saída:**', components: [ new ActionRowBuilder().addComponents(channelSelect), new ActionRowBuilder().addComponents(btnEditMsg, btnPreview) ], ephemeral: true }); }  if (interaction.customId === 'btn_preview_leave') { const text = parseVariables(db.leaveMessage, interaction.member, interaction.guild); const embed = new EmbedBuilder() .setTitle('🚪 [PRÉVIA] Membro Saiu') .setDescription(text) .setColor('#ED4245') .setTimestamp();  if (db.leaveBanner && (db.leaveBanner.startsWith('http://') \vert{}\vert{} db.leaveBanner.startsWith('https://'))) { embed.setImage(db.leaveBanner); }  return interaction.reply({ content: '🔍 **Pré-visualização de Saída:**', embeds: [embed], ephemeral: true }); }  if (interaction.customId === 'btn_edit_leave_msg') { const modal = new ModalBuilder() .setCustomId('modal_edit_leave') .setTitle('Configurar Mensagem de Saída');  modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user.tag}, {server})').setStyle(TextInputStyle.Paragraph).setValue(db.leaveMessage).setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL do Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.leaveBanner \vert{}\vert{} '').setRequired(false) ) ); return interaction.showModal(modal); }  if (interaction.customId === 'btn_tickets') { const categorySelect = new ChannelSelectMenuBuilder() .setCustomId('select_ticket_category') .setPlaceholder('📁 Categoria para criação dos canais') .addChannelTypes(ChannelType.GuildCategory);  const supportRoleSelect = new RoleSelectMenuBuilder() .setCustomId('select_ticket_role') .setPlaceholder('🛠️ Cargo dos Atendentes / Staff');  const btnDesign = new ButtonBuilder() .setCustomId('btn_edit_ticket_design') .setLabel('Design & Banner') .setEmoji('🎨') .setStyle(ButtonStyle.Secondary);  const btnAddCat = new ButtonBuilder() .setCustomId('btn_add_ticket_cat') .setLabel('Adicionar Categoria') .setEmoji('➕') .setStyle(ButtonStyle.Primary);  const btnRemoveCat = new ButtonBuilder() .setCustomId('btn_remove_ticket_cat') .setLabel('Remover Categoria') .setEmoji('🗑️') .setStyle(ButtonStyle.Danger);  const btnSendTicketPanel = new ButtonBuilder() .setCustomId('btn_send_ticket_panel') .setLabel('Enviar Painel de Tickets Aqui') .setEmoji('📩') .setStyle(ButtonStyle.Success);  return interaction.reply({ content: '⚙️ **Gerenciamento do Módulo de Tickets:**', components: [ new ActionRowBuilder().addComponents(categorySelect), new ActionRowBuilder().addComponents(supportRoleSelect), new ActionRowBuilder().addComponents(btnDesign, btnAddCat, btnRemoveCat), new ActionRowBuilder().addComponents(btnSendTicketPanel) ], ephemeral: true }); }  if (interaction.customId === 'btn_edit_ticket_design') { const modal = new ModalBuilder() .setCustomId('modal_edit_ticket_design') .setTitle('Design & Banner do Ticket');  modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('ticket_custom_title').setLabel('Título da Embed').setStyle(TextInputStyle.Short).setValue(db.ticketTitle).setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('ticket_custom_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(db.ticketDescription).setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('ticket_custom_color').setLabel('Cor Hexadecimal').setStyle(TextInputStyle.Short).setValue(db.ticketColor).setRequired(false) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('ticket_custom_banner').setLabel('URL do Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.ticketBanner \vert{}\vert{} '').setRequired(false) ) );  return interaction.showModal(modal); }  if (interaction.customId === 'btn_add_ticket_cat') { if (db.ticketCategories.length >= 25) { return interaction.reply({ content: '❌ Limite de 25 categorias de ticket atingido!', ephemeral: true }); }  const modal = new ModalBuilder() .setCustomId('modal_add_ticket_cat') .setTitle('Adicionar Categoria de Ticket');  modal.addComponents( new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cat_label').setLabel('Nome da Categoria').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Suporte Técnico').setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cat_desc').setLabel('Descrição Curta').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Atendimento para dúvidas').setRequired(true) ), new ActionRowBuilder().addComponents( new TextInputBuilder().setCustomId('cat_emoji').setLabel('Emoji (Opcional)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 🛠️').setRequired(false) ) );  return interaction.showModal(modal); }  if (interaction.customId === 'btn_remove_ticket_cat') { if (db.ticketCategories.length === 0) { return interaction.reply({ content: '❌ Nenhuma categoria para remover!', ephemeral: true }); }  const selectMenu = new StringSelectMenuBuilder() .setCustomId('select_delete_ticket_cat') .setPlaceholder('🗑️ Selecione a categoria para excluir') .addOptions( db.ticketCategories.map(cat => ({ label: cat.label, description: cat.description, value: cat.id, emoji: cat.emoji })) );  return interaction.reply({ content: 'Selecione abaixo a categoria que deseja **remover**:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true }); }  if (interaction.customId === 'btn_send_ticket_panel') { if (!db.ticketCategory) { return interaction.reply({ content: '❌ Defina a categoria antes de enviar o painel!', ephemeral: true }); }  if (db.ticketCategories.length === 0) { return interaction.reply({ content: '❌ Adicione pelo menos uma categoria antes!', ephemeral: true }); }  const ticketEmbed = new EmbedBuilder() .setTitle(db.ticketTitle) .setDescription(db.ticketDescription) .setColor(db.ticketColor && db.ticketColor.startsWith('#') ? db.ticketColor : db.themeColor) .setFooter({ text: 'Central de Atendimento VIP' });  if (db.ticketBanner && (db.ticketBanner.startsWith('http://') \vert{}\vert{} db.ticketBanner.startsWith('https://'))) { ticketEmbed.setImage(db.ticketBanner); }  const selectMenu = new StringSelectMenuBuilder() .setCustomId('select_ticket_type') .setPlaceholder('▼ Selecione uma opção para abrir seu ticket') .addOptions( db.ticketCategories.map(cat => ({ label: cat.label, description: cat.description, value: cat.id, emoji: cat.emoji })) );  await interaction.channel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)] }); return interaction.reply({ content: '✅ Painel enviado no canal!', ephemeral: true }); }  if (interaction.customId === 'btn_claim_ticket') { const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) \vert{}\vert{} (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));  if (!isStaff) { return interaction.reply({ content: '❌ Apenas a equipe autorizada pode assumir tickets!', ephemeral: true }); }  const embed = EmbedBuilder.from(interaction.message.embeds[0]); embed.spliceFields(4, 1, { name: '🛠️ Atendente Responsável', value: `${interaction.user}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claimed').setLabel(`Assumido por ${interaction.user.username}`).setEmoji('✅').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: `✅ Ticket assumido por ${interaction.user}!`, ephemeral: false });
      }

      if (interaction.customId === 'btn_close_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));

        if (!isStaff) {
          return interaction.reply({ content: '❌ Apenas a equipe autorizada pode fechar tickets!', ephemeral: true });
        }

        await interaction.reply({ content: '🔒 Fechando canal do ticket em 5 segundos...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }

      if (interaction.customId === 'btn_logs') {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_log_channel')
          .setPlaceholder('📜 Selecione o canal de logs gerais')
          .addChannelTypes(ChannelType.GuildText);

        return interaction.reply({
          content: '⚙️ **Configuração de Logs e Moderação:**',
          components: [new ActionRowBuilder().addComponents(channelSelect)],
          ephemeral: true
        });
      }
    }

    // 4. Select Menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'cv_select_color') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder()
            .setCustomId('modal_cv_custom_hex')
            .setTitle('Cor Hexadecimal para Embed');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('cv_input_hex').setLabel('Digite a cor Hex (Ex: #FF0055)').setStyle(TextInputStyle.Short).setRequired(true)
            )
          );
          return interaction.showModal(modal);
        }

        const cvData = cvCache.get(interaction.user.id) || { title: 'Título', description: 'Conteúdo' };
        cvData.color = selectedValue;
        cvCache.set(interaction.user.id, cvData);

        const payload = buildCvBuilderComponents(interaction.user.id, db.themeColor);
        return interaction.update({ embeds: payload.embeds, components: payload.components });
      }

      if (interaction.customId === 'select_theme_color') {
        const selectedValue = interaction.values[0];

        if (selectedValue === 'custom_hex') {
          const modal = new ModalBuilder()
            .setCustomId('modal_theme')
            .setTitle('Cor Hexadecimal Personalizada');

          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder().setCustomId('theme_color_input').setLabel('Digite a cor (Ex: #FF0055)').setStyle(TextInputStyle.Short).setValue(db.themeColor).setRequired(true)
            )
          );
          return interaction.showModal(modal);
        }

        db.themeColor = selectedValue;
        await db.save();

        const selectedObj = COLOR_OPTIONS.find(c => c.value === selectedValue);
        return interaction.update({
          content: `✨ Cor do tema salva no banco: ${selectedObj ? selectedObj.emoji : ''} **${selectedObj ? selectedObj.label : selectedValue}**!`,
          components: []
        });
      }

      if (interaction.customId === 'select_delete_ticket_cat') {
        const catId = interaction.values[0];
        const removedCat = db.ticketCategories.find(c => c.id === catId);

        db.ticketCategories = db.ticketCategories.filter(c => c.id !== catId);
        await db.save();

        return interaction.update({
          content: `🗑️ Categoria **${removedCat ? removedCat.label : 'selecionada'}** removida!`,
          components: []
        });
      }

      if (interaction.customId === 'select_ticket_type') {
        const selectedCatId = interaction.values[0];
        const category = db.ticketCategories.find(c => c.id === selectedCatId);
        const categoryName = category ? category.label : 'Atendimento';

        const modal = new ModalBuilder()
          .setCustomId(`modal_open_ticket_form:${selectedCatId}`) .setTitle(`Atendimento: ${categoryName.slice(0, 30)}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_subject').setLabel('Assunto Resumido').setStyle(TextInputStyle.Short).setPlaceholder('Digite o título do assunto...').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_reason').setLabel('Descrição Completa').setStyle(TextInputStyle.Paragraph).setPlaceholder('Detalhe a sua dúvida ou necessidade...').setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = value;
        await db.save();
        return interaction.update({ content: `✅ Canal de Boas-Vindas salvo: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_autorole') {
        db.autoRole = value;
        await db.save();
        return interaction.update({ content: `✅ Cargo AutoRole salvo: <@&${value}>`, components: [] });
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

      if (interaction.customId === 'select_ticket_role') {
        db.ticketSupportRole = value;
        await db.save();
        return interaction.update({ content: `✅ Cargo Atendente salvo: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_log_channel') {
        db.logChannel = value;
        await db.save();
        return interaction.update({ content: `✅ Canal de Logs salvo: <#${value}>`, components: [] });
      }
    }
  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// Eventos de Entradas e Saídas
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
        .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
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
        .setColor('#ED4245')
        .setTimestamp();

      if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
        embed.setImage(db.leaveBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot || !message.guild) return;
  const db = await getGuildData(message.guild.id);
  if (!db || !db.logChannel) return;

  const logChannel = message.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensagem Deletada')
    .addFields(
      { name: 'Autor', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true }, { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Conteúdo', value: message.content ? `\`\`\`${message.content}\`\`\`` : '*Sem texto*' }
    )
    .setColor('#ED4245')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || !oldMessage.guild) return;
  if (oldMessage.content === newMessage.content) return;

  const db = await getGuildData(oldMessage.guild.id);
  if (!db || !db.logChannel) return;

  const logChannel = oldMessage.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensagem Editada')
    .addFields(
      { name: 'Autor', value: `${oldMessage.author.tag} (\`${oldMessage.author.id}\`)`, inline: true }, { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: 'Antes', value: `\`\`\`${oldMessage.content || 'Vazio'}\`\`\`` },
      { name: 'Depois', value: `\`\`\`${newMessage.content || 'Vazio'}\`\`\`` }
    )
    .setColor('#FEE75C')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanAdd', async (ban) => {
  const db = await getGuildData(ban.guild.id);
  if (!db || !db.logChannel) return;

  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔨 Membro Banido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi banido do servidor.`)
    .setColor('#5865F2')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanRemove', async (ban) => {
  const db = await getGuildData(ban.guild.id);
  if (!db || !db.logChannel) return;

  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔓 Membro Desbanido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi desbanido do servidor.`)
    .setColor('#57F287')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

process.on('unhandledRejection', (reason) => console.error('UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('UncaughtException:', err));

client.login(process.env.DISCORD_TOKEN);
