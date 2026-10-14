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
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  Events
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
  ticketTitle: { type: String, default: '🎟️ Central de Atendimento' },
  ticketDescription: { type: String, default: 'Selecione a opção desejada para abrir seu atendimento.' },
  ticketColor: { type: String, default: '#57F287' },
  ticketCategories: {
    type: Array,
    default: [
      { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Tire suas dúvidas.', emoji: '❓' },
      { id: 'cat_suporte', label: 'Suporte Técnico', description: 'Atendimento técnico.', emoji: '🛠️' }
    ]
  },
  logChannel: { type: String, default: null }
});

const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);

async function getGuildData(guildId) {
  try {
    if (mongoose.connection.readyState !== 1) {
      return { guildId, themeColor: '#57F287', welcomeColor: '#57F287', leaveColor: '#ED4245', ticketColor: '#57F287', ticketCategories: [], save: async () => {} };
    }
    let data = await GuildConfig.findOne({ guildId });
    if (!data) data = await GuildConfig.create({ guildId });
    return data;
  } catch (error) {
    console.error('[ERRO MONGO]:', error.message);
    return null;
  }
}

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

const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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

client.once(Events.ClientReady, async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);
  if (process.env.MONGO_URI) {
    await mongoose.connect(process.env.MONGO_URI).then(() => console.log('[BANCO] MongoDB Atlas Conectado com sucesso!')).catch(err => console.error(err.message));
  }
  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands }).catch(err => console.error(err.message));
  }
});

function buildPainelEmbed(guild, db) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  return new EmbedBuilder()
    .setAuthor({ name: `GESTAO • ${guild.name.toUpperCase()}`, iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
    .setTitle('⚡ Painel de Controle Principal')
    .setDescription(`> Gerencie as configurações do servidor diretamente neste painel único.\n\n**Status Banco:** ${isMongoConnected ? '🟢 `Conectado (MongoDB Atlas)`' : '🔴 `Offline`'}`)
    .addFields(
      { name: '🎨 Cor do Tema', value: `\`${db.themeColor || '#57F287'}\``, inline: true },
      { name: '👋 Boas-Vindas', value: `Canal: ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`Desativado`'}\nAutoRole: ${db.autoRole ? `<@&${db.autoRole}>` : '`Nenhum`'}`, inline: true },
      { name: '🚪 Saída', value: `Canal: ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`Desativado`'}\nCor: \`${db.leaveColor || '#ED4245'}\``, inline: true },
      { name: '🎟️ Tickets', value: `Envio: ${db.ticketChannel ? `<#${db.ticketChannel}>` : '`Não definido`'}\nCategoria: ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`Não definida`'}`, inline: false },
      { name: '📜 Registros / Logs', value: `Canal: ${db.logChannel ? `<#${db.logChannel}>` : '`Desativado`'}`, inline: false }
    )
    .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
    .setFooter({ text: `${client.user.username} • Clique nos botões para alterar cada sistema` })
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

  return [rowConfig];
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    const db = await getGuildData(interaction.guild.id);

    // 1. Slash Commands
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        return interaction.reply({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons(), ephemeral: true });
      }

      if (interaction.commandName === 'ban') {
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado.';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ O usuário informado não está no servidor.', ephemeral: true });
        if (!member.bannable) return interaction.reply({ content: '❌ Não tenho permissão suficiente para banir este membro.', ephemeral: true });

        await member.ban({ reason: `${reason} | Por: ${interaction.user.tag}` });

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
        return interaction.reply({ content: `🧹 **${amount}** mensagens foram apagadas.`, ephemeral: true });
      }
    }

    // 2. Botões
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_welcome') {
        const chan = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('📌 Selecionar Canal de Boas-Vindas').addChannelTypes(ChannelType.GuildText);
        const role = new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('🎭 Selecionar Cargo AutoRole');
        
        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(role), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_leave') {
        const chan = new ChannelSelectMenuBuilder().setCustomId('select_leave_channel').setPlaceholder('🚪 Selecionar Canal de Saída').addChannelTypes(ChannelType.GuildText);
        const color = new StringSelectMenuBuilder().setCustomId('select_leave_color').setPlaceholder('🎨 Selecionar Cor de Saída').addOptions(COLOR_OPTIONS);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(chan), new ActionRowBuilder().addComponents(color), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_tickets') {
        const sendChan = new ChannelSelectMenuBuilder().setCustomId('select_ticket_send_channel').setPlaceholder('📢 Selecionar Canal para Enviar Painel').addChannelTypes(ChannelType.GuildText);
        const category = new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('📁 Selecionar Categoria dos Tickets').addChannelTypes(ChannelType.GuildCategory);
        const role = new RoleSelectMenuBuilder().setCustomId('select_ticket_role').setPlaceholder('🛠️ Selecionar Cargo Staff/Atendentes');

        const btnSend = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_send_ticket_panel').setLabel('Enviar Painel de Ticket Agora').setEmoji('📩').setStyle(ButtonStyle.Success)
        );

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(sendChan), new ActionRowBuilder().addComponents(category), new ActionRowBuilder().addComponents(role), btnSend, ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_logs') {
        const chan = new ChannelSelectMenuBuilder().setCustomId('select_log_channel').setPlaceholder('📜 Selecionar Canal de Logs / Registros').addChannelTypes(ChannelType.GuildText);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(chan), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_theme') {
        const color = new StringSelectMenuBuilder().setCustomId('select_theme_color').setPlaceholder('🎨 Selecionar Cor do Tema').addOptions(COLOR_OPTIONS);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, db)],
          components: [new ActionRowBuilder().addComponents(color), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        const targetChan = db.ticketChannel ? interaction.guild.channels.cache.get(db.ticketChannel) : interaction.channel;
        if (!targetChan) return interaction.reply({ content: '❌ Selecione o canal no menu acima antes de enviar!', ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(db.ticketTitle || '🎟️ Central de Atendimento')
          .setDescription(db.ticketDescription || 'Selecione abaixo para abrir atendimento.')
          .setColor(db.ticketColor || db.themeColor);

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_ticket_type')
          .setPlaceholder('▼ Selecione uma opção para abrir seu ticket')
          .addOptions(db.ticketCategories.map(cat => ({ label: cat.label, description: cat.description, value: cat.id, emoji: cat.emoji })));

        await targetChan.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        return interaction.reply({ content: `✅ Painel de Ticket enviado em ${targetChan}!`, ephemeral: true });
      }
    }

    // 3. Seleção nos Menus (Salva no MongoDB Atlas e Atualiza a Embed)
    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_welcome_channel') db.welcomeChannel = val;
      if (interaction.customId === 'select_leave_channel') db.leaveChannel = val;
      if (interaction.customId === 'select_log_channel') db.logChannel = val;
      if (interaction.customId === 'select_ticket_send_channel') db.ticketChannel = val;
      if (interaction.customId === 'select_ticket_category') db.ticketCategory = val;
      await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons() });
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_autorole') db.autoRole = val;
      if (interaction.customId === 'select_ticket_role') db.ticketSupportRole = val;
      await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons() });
    }

    if (interaction.isStringSelectMenu()) {
      const val = interaction.values[0];
      if (interaction.customId === 'select_theme_color') db.themeColor = val;
      if (interaction.customId === 'select_leave_color') db.leaveColor = val;
      await db.save();

      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons() });
    }

  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// 📌 EVENTOS DE BOAS-VINDAS E SAÍDA COM RENDERIZAÇÃO DE BANNER
client.on('guildMemberAdd', async (member) => {
  const db = await getGuildData(member.guild.id);
  if (!db) return;

  if (db.autoRole) {
    await member.roles.add(db.autoRole).catch(() => {});
  }

  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = db.welcomeMessage.replace(/{user}/g, `${member}`).replace(/{server}/g, member.guild.name);
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
      const text = db.leaveMessage.replace(/{user}/g, member.user.tag).replace(/{server}/g, member.guild.name);
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
process.on('unhandledRejection', r => console.error('[UNHANDLED REJECTION]:', r));
process.on('uncaughtException', e => console.error('[UNCAUGHT EXCEPTION]:', e));

client.login(process.env.DISCORD_TOKEN);
