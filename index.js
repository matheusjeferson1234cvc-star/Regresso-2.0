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
  Routes,
  Events,
  AttachmentBuilder
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
  welcomeMessage: { type: String, default: 'Olá {user}, seja bem-vindo(a) ao **{server}**!' },
  welcomeBanner: { type: String, default: null },
  welcomeColor: { type: String, default: '#57F287' },
  leaveChannel: { type: String, default: null },
  leaveMessage: { type: String, default: 'O membro **{user.tag}** saiu do servidor.' },
  leaveBanner: { type: String, default: null },
  leaveColor: { type: String, default: '#ED4245' },
  autoRole: { type: String, default: null },
  ticketChannel: { type: String, default: null },
  ticketCategory: { type: String, default: null },
  ticketSupportRole: { type: String, default: null },
  ticketTitle: { type: String, default: '🎟️ Central de Atendimento & Suporte' },
  ticketDescription: { type: String, default: 'Selecione a opção desejada abaixo para abrir seu atendimento.' },
  ticketColor: { type: String, default: '#57F287' },
  ticketCategories: {
    type: Array,
    default: [
      { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Tire suas dúvidas com a equipe.', emoji: '❓' },
      { id: 'cat_suporte', label: 'Suporte Técnico', description: 'Atendimento e suporte técnico.', emoji: '🛠️' }
    ]
  },
  logChannel: { type: String, default: null }
}, { timestamps: true });

const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);

// Helper para buscar ou criar registro no MongoDB com garantia de reconexão
async function getGuildData(guildId) {
  try {
    if (mongoose.connection.readyState !== 1 && process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI);
    }
    let data = await GuildConfig.findOne({ guildId });
    if (!data) data = await GuildConfig.create({ guildId });
    return data;
  } catch (error) {
    console.error('[ERRO MONGO]:', error.message);
    return null;
  }
}

// Opções de Cores Predefinidas
const COLOR_OPTIONS = [
  { label: 'Verde Esmeralda', description: 'Tom verde vivo', value: '#57F287', emoji: '🟢' },
  { label: 'Azul Elétrico', description: 'Padrão Discord', value: '#5865F2', emoji: '🔵' },
  { label: 'Roxo Cyberpunk', description: 'Tom roxo destacado', value: '#9B59B6', emoji: '🟣' },
  { label: 'Vermelho Carmim', description: 'Tom vermelho forte', value: '#ED4245', emoji: '🔴' },
  { label: 'Amarelo Ouro', description: 'Tom amarelo brilhante', value: '#FEE75C', emoji: '🟡' },
  { label: 'Laranja Vivo', description: 'Tom laranja vibrante', value: '#E67E22', emoji: '🟠' },
  { label: 'Branco Minimalista', description: 'Aparência limpa', value: '#FFFFFF', emoji: '⚪' },
  { label: 'Dark / Escuro', description: 'Tom escuro', value: '#2F3136', emoji: '⬛' }
];

// Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo de configurações do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar e enviar uma embed personalizada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banir um usuário do servidor e registrar em logs.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário a ser banido.').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do banimento.').setRequired(false)),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Tranca o canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Destranca o canal.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens do chat.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Número de mensagens (1 a 100).').setMinValue(1).setMaxValue(100).setRequired(true))
];

// Inicialização do Bot
client.once(Events.ClientReady, async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);
  
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
      console.log('[BANCO] MongoDB Atlas Conectado com sucesso!');
    } catch (err) {
      console.error('[ERRO CONEXAO MONGO]:', err.message);
    }
  }

  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
      console.log('[SLASH] Comandos globais registrados com sucesso!');
    } catch (error) {
      console.error('[ERRO REGISTRO SLASH]:', error.message);
    }
  }
});

// Construtor Visual do Painel Principal
function buildPainelEmbed(guild, db) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  const themeColor = db?.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#2F3136';

  return new EmbedBuilder()
    .setAuthor({ name: `GESTAO • ${guild.name.toUpperCase()}`, iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
    .setTitle('⚙️ Central de Configurações Administrativas')
    .setDescription(`Gerencie os módulos do bot através das opções abaixo:\n\n**Status Banco:** ${isMongoConnected ? '🟢 `Sincronizado (MongoDB Atlas)`' : '🔴 `Erro Conexão`'}`)
    .addFields(
      { name: '🎨 Cor do Tema', value: `\`${themeColor}\``, inline: true },
      { name: '👋 Boas-Vindas & AutoRole', value: `├ Canal: ${db?.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Desativado`'}\n└ Cargo: ${db?.autoRole ? `<@&${db.autoRole}>` : '`❌ Desativado`'}`, inline: true },
      { name: '🚪 Sistema de Saída', value: `├ Canal: ${db?.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Desativado`'}\n└ Banner: ${db?.leaveBanner ? '`✅ Configurado`' : '`❌ Sem Banner`'}`, inline: true },
      { name: '🎟️ Central de Tickets', value: `├ Canal Envio: ${db?.ticketChannel ? `<#${db.ticketChannel}>` : '`❌ Não definido`'}\n├ Categoria: ${db?.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`'}\n└ Atendentes: ${db?.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : '`❌ Não definido`'}`, inline: false },
      { name: '📜 Logs Gerais & Transcrições', value: `└ Canal: ${db?.logChannel ? `<#${db.logChannel}>` : '`❌ Desativado`'}`, inline: false }
    )
    .setColor(themeColor)
    .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
    .setFooter({ text: `${client.user.username} • Sincronizado com MongoDB Atlas`, iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const rowConfig1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs').setEmoji('📜').setStyle(ButtonStyle.Danger)
  );

  const rowConfig2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_theme').setLabel('Cor do Tema').setEmoji('🎨').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_refresh_panel').setLabel('Atualizar Painel').setEmoji('🔄').setStyle(ButtonStyle.Primary)
  );

  return [rowConfig1, rowConfig2];
}

// Interações
client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    let db = await getGuildData(interaction.guild.id);
    if (!db) return interaction.reply({ content: '❌ Erro ao conectar ao MongoDB Atlas. Verifique as credenciais.', ephemeral: true });

    // 1. SLASH COMMANDS
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        return interaction.reply({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons(), ephemeral: true });
      }

      if (interaction.commandName === 'cv') {
        const modal = new ModalBuilder().setCustomId('modal_cv').setTitle('🎨 Criar Embed Personalizada');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_image').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.commandName === 'ban') {
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado.';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ O usuário informado não está no servidor.', ephemeral: true });
        if (!member.bannable) return interaction.reply({ content: '❌ Não tenho permissão para banir este membro.', ephemeral: true });

        await member.ban({ reason: `${reason} \vert{} Por:${interaction.user.tag}` });

        if (db.logChannel) {
          const logChan = interaction.guild.channels.cache.get(db.logChannel);
          if (logChan) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔨 Membro Banido')
              .addFields(
                { name: '👤 Usuário Banido', value: `${targetUser.tag} (\`${targetUser.id}\`)`, inline: true },
                { name: '🛡️ Mod Autor', value: `${interaction.user}`, inline: true },
                { name: '📌 Motivo', value: reason, inline: false }
              )
              .setColor('#ED4245')
              .setTimestamp();
            logChan.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }

        return interaction.reply({ content: `✅ **${targetUser.tag}** foi banido com sucesso!` });
      }

      if (interaction.commandName === 'lock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
        return interaction.reply({ content: '🔒 **Canal trancado pela moderação.**' });
      }

      if (interaction.commandName === 'unlock') {
        await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
        return interaction.reply({ content: '🔓 **Canal destrancado.**' });
      }

      if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('quantidade');
        await interaction.channel.bulkDelete(amount, true);
        return interaction.reply({ content: `🧹 **${amount}** mensagens apagadas.`, ephemeral: true });
      }
    }

    // 2. MODAIS
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_cv') {
        const title = interaction.fields.getTextInputValue('cv_title');
        const description = interaction.fields.getTextInputValue('cv_description');
        const image = interaction.fields.getTextInputValue('cv_image');
        const color = interaction.fields.getTextInputValue('cv_color') || '#2F3136';

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color.startsWith('#') ? color : '#2F3136')
          .setTimestamp();

        if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
          embed.setImage(image);
        }

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ content: '✅ Embed enviada com sucesso!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_welcome') {
        const rawBanner = interaction.fields.getTextInputValue('welcome_banner_url');
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null;
        db.markModified('welcomeMessage');
        db.markModified('welcomeBanner');
        await db.save();

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: buildPainelButtons()
        });
      }

      if (interaction.customId === 'modal_edit_leave') {
        const rawBanner = interaction.fields.getTextInputValue('leave_banner_url');
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null;
        db.markModified('leaveMessage');
        db.markModified('leaveBanner');
        await db.save();

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: buildPainelButtons()
        });
      }
    }

    // 3. BOTÕES
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_refresh_panel') {
        const updatedDb = await getGuildData(interaction.guild.id);
        await interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, updatedDb)],
          components: buildPainelButtons()
        });
        return interaction.followUp({ content: '🔄 **Painel sincronizado com o MongoDB Atlas!**', ephemeral: true });
      }

      if (interaction.customId === 'btn_welcome') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('📌 Selecione o canal de boas-vindas').addChannelTypes(ChannelType.GuildText);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('🎭 Selecione o cargo automático (AutoRole)');
        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_welcome_msg').setLabel('Editar Mensagem & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(btnEditMsg),
            ...buildPainelButtons()
          ]
        });
      }

      if (interaction.customId === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_welcome').setTitle('Configurar Boas-Vindas');
        const msgInput = new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(db.welcomeMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.welcomeBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_leave') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_leave_channel').setPlaceholder('📌 Selecione o canal de saída').addChannelTypes(ChannelType.GuildText);
        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_leave_msg').setLabel('Editar Mensagem & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(btnEditMsg),
            ...buildPainelButtons()
          ]
        });
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Configurar Mensagem de Saída');
        const msgInput = new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(db.leaveMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.leaveBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        const sendChanSelect = new ChannelSelectMenuBuilder().setCustomId('select_ticket_send_channel').setPlaceholder('📢 Selecionar canal onde o painel será enviado').addChannelTypes(ChannelType.GuildText);
        const categorySelect = new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('📁 Selecionar categoria dos tickets').addChannelTypes(ChannelType.GuildCategory);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_ticket_role').setPlaceholder('🛠️ Selecionar cargo dos atendentes');
        const btnSendTicketPanel = new ButtonBuilder().setCustomId('btn_send_ticket_panel').setLabel('Enviar Painel de Tickets').setEmoji('📩').setStyle(ButtonStyle.Success);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [
            new ActionRowBuilder().addComponents(sendChanSelect),
            new ActionRowBuilder().addComponents(categorySelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(btnSendTicketPanel),
            ...buildPainelButtons()
          ]
        });
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        const targetChan = db.ticketChannel ? interaction.guild.channels.cache.get(db.ticketChannel) : interaction.channel;
        if (!targetChan) return interaction.reply({ content: '❌ Selecione um canal no menu acima!', ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(db.ticketTitle || '🎟️ Central de Atendimento & Suporte')
          .setDescription(db.ticketDescription || 'Clique no botão abaixo para abrir um ticket privado com nossa equipe.')
          .setColor(db.ticketColor && db.ticketColor.startsWith('#') ? db.ticketColor : '#57F287')
          .setFooter({ text: 'Central de Atendimento' });

        const openTicketBtn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_open_ticket').setLabel('Abrir Ticket').setEmoji('📩').setStyle(ButtonStyle.Primary)
        );

        await targetChan.send({ embeds: [ticketEmbed], components: [openTicketBtn] });
        return interaction.reply({ content: `✅ Painel de Tickets enviado em ${targetChan}!`, ephemeral: true });
      }

      if (interaction.customId === 'btn_open_ticket') {
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Categoria de tickets não configurada no `/painel`.', ephemeral: true });
        }

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existingChannel) {
          return interaction.reply({ content: `⚠️ Você já possui um ticket aberto em ${existingChannel}!`, ephemeral: true });
        }

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: db.ticketCategory,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
          ]
        });

        const ticketPanelEmbed = new EmbedBuilder()
          .setTitle(`🎟️ Ticket de ${interaction.user.username}`)
          .setDescription('Descreva sua solicitação. A equipe responderá em breve.')
          .setColor('#5865F2');

        const closeBtn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar & Gerar Transcrição').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `${interaction.user}`, embeds: [ticketPanelEmbed], components: [closeBtn] });
        return interaction.reply({ content: `✅ Ticket criado em ${channel}!`, ephemeral: true });
      }

      // FECHAR TICKET E SALVAR TRANSCRIÇÃO EM LOGS
      if (interaction.customId === 'btn_close_ticket') {
        await interaction.reply({ content: '🔒 Gerando transcrição e encerrando ticket em 5 segundos...' });

        try {
          const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
          const formattedLogs = fetchedMessages
            .reverse()
            .map(m => `[${new Date(m.createdAt).toLocaleString('pt-BR')}] ${m.author.tag}:${m.content}`)
            .join('\n');

          const buffer = Buffer.from(formattedLogs, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: `transcricao-${interaction.channel.name}.txt` });

          if (db.logChannel) {
            const logChan = interaction.guild.channels.cache.get(db.logChannel);
            if (logChan) {
              const logEmbed = new EmbedBuilder()
                .setTitle('📝 Transcrição de Ticket Encerrado')
                .addFields(
                  { name: '📁 Canal', value: `\`${interaction.channel.name}\``, inline: true },
                  { name: '👤 Encerrado Por', value: `${interaction.user}`, inline: true }
                )
                .setColor('#FEE75C')
                .setTimestamp();

              await logChan.send({ embeds: [logEmbed], files: [attachment] }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[ERRO TRANSCRIÇÃO]:', err);
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }

      if (interaction.customId === 'btn_logs') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_log_channel').setPlaceholder('📜 Selecione o canal de logs gerais').addChannelTypes(ChannelType.GuildText);
        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(channelSelect), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_theme') {
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_theme_color').setPlaceholder('🎨 Selecione a cor do Tema').addOptions(COLOR_OPTIONS);
        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(colorSelect), ...buildPainelButtons()]
        });
      }
    }

    // 4. SELECT MENUS
    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_welcome_channel') { db.welcomeChannel = val; db.markModified('welcomeChannel'); }
      if (interaction.customId === 'select_leave_channel') { db.leaveChannel = val; db.markModified('leaveChannel'); }
      if (interaction.customId === 'select_log_channel') { db.logChannel = val; db.markModified('logChannel'); }
      if (interaction.customId === 'select_ticket_send_channel') { db.ticketChannel = val; db.markModified('ticketChannel'); }
      if (interaction.customId === 'select_ticket_category') { db.ticketCategory = val; db.markModified('ticketCategory'); }
      
      const savedDb = await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, savedDb)], components: buildPainelButtons() });
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_welcome_role' || interaction.customId === 'select_autorole') { db.autoRole = val; db.markModified('autoRole'); }
      if (interaction.customId === 'select_ticket_role') { db.ticketSupportRole = val; db.markModified('ticketSupportRole'); }
      
      const savedDb = await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, savedDb)], components: buildPainelButtons() });
    }

    if (interaction.isStringSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_theme_color') { db.themeColor = val; db.markModified('themeColor'); }
      
      const savedDb = await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, savedDb)], components: buildPainelButtons() });
    }

  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// EVENTOS DE MEMBROS (BOAS-VINDAS E SAÍDA)
client.on('guildMemberAdd', async (member) => {
  const db = await getGuildData(member.guild.id);
  if (!db) return;

  if (db.autoRole) {
    await member.roles.add(db.autoRole).catch(() => {});
  }

  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = (db.welcomeMessage || 'Olá {user}, seja bem-vindo(a) ao **{server}**!')
        .replace(/{user}/g, `${member}`)
        .replace(/{server}/g, member.guild.name);

      const color = db.welcomeColor && db.welcomeColor.startsWith('#') ? db.welcomeColor : (db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287');

      const embed = new EmbedBuilder()
        .setTitle('👋 Seja Bem-vindo(a)!')
        .setDescription(text)
        .setColor(color)
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
      const text = (db.leaveMessage || 'O membro **{user.tag}** saiu do servidor.')
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name);

      const color = db.leaveColor && db.leaveColor.startsWith('#') ? db.leaveColor : '#ED4245';

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(text)
        .setColor(color)
        .setTimestamp();

      if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
        embed.setImage(db.leaveBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', r => console.error('[UNHANDLED REJECTION]:', r));
process.on('uncaughtException', e => console.error('[UNCAUGHT EXCEPTION]:', e));

client.login(process.env.DISCORD_TOKEN);
