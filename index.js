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

// Schema Mongoose
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
  ticketCategory: { type: String, default: null },
  ticketSupportRole: { type: String, default: null },
  ticketTitle: { type: String, default: '🎟️ Central de Atendimento' },
  ticketDescription: { type: String, default: 'Selecione a opção desejada abaixo para abrir seu ticket.' },
  ticketColor: { type: String, default: '#57F287' },
  ticketBanner: { type: String, default: null },
  ticketCategories: {
    type: Array,
    default: [
      { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Atendimento geral.', emoji: '❓' }
    ]
  },
  logChannel: { type: String, default: null }
});

const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);
const cvCache = new Map();

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
  { label: 'Dark / Escuro', description: 'Tom escuro', value: '#2F3136', emoji: '⬛' },
  { label: 'Código Personalizado (Hex)', description: 'Digitar Hex livre', value: 'custom_hex', emoji: '✏️' }
];

const commands = [
  new SlashCommandBuilder().setName('painel').setDescription('Abre o painel administrativo do bot.').setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('cv').setDescription('Abre o construtor de embed.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder().setName('ban').setDescription('Banir usuário.').setDefaultMemberPermissions(PermissionFlagsBits.BanMembers).addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)).addStringOption(o => o.setName('motivo').setDescription('Motivo')),
  new SlashCommandBuilder().setName('lock').setDescription('Tranca o canal.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('unlock').setDescription('Destranca o canal.').setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder().setName('clear').setDescription('Limpa mensagens.').setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages).addIntegerOption(o => o.setName('quantidade').setDescription('Quantidade').setRequired(true))
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot online como ${client.user.tag}`);
  if (process.env.MONGO_URI) await mongoose.connect(process.env.MONGO_URI).catch(err => console.error(err.message));
  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands }).catch(err => console.error(err.message));
  }
});

function parseVariables(text, member, guild) {
  if (!text) return '';
  return text
    .replace(/{user}/g, `${member}`)
    .replace(/{user\.tag}/g, member.user ? member.user.tag : member.tag || '')
    .replace(/{user\.id}/g, member.id)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, guild.memberCount);
}

function buildPainelEmbed(guild, db) {
  const isMongoConnected = mongoose.connection.readyState === 1;
  return new EmbedBuilder()
    .setAuthor({ name: `GESTAO • ${guild.name.toUpperCase()}`, iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
    .setTitle('⚡ Painel de Controle Principal')
    .setDescription(`> Gerencie as configurações do servidor.\n\n**Status do Banco:** ${isMongoConnected ? '🟢 `Conectado`' : '🔴 `Offline`'}`)
    .addFields(
      { name: '🎨 Cor do Tema', value: `\`${db.themeColor || '#57F287'}\``, inline: true },
      { name: '👋 Boas-Vindas', value: `Canal: ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`Desativado`'}\nCor: \`${db.welcomeColor || '#57F287'}\`\nAutoRole: ${db.autoRole ? `<@&${db.autoRole}>` : '`Nenhum`'}`, inline: true },
      { name: '🚪 Saída', value: `Canal: ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`Desativado`'}\nCor: \`${db.leaveColor || '#ED4245'}\``, inline: true },
      { name: '🎟️ Tickets', value: `Categoria: ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`Não definida`'}\nCor: \`${db.ticketColor || '#57F287'}\`\nOpções: \`${db.ticketCategories ? db.ticketCategories.length : 0}\``, inline: false },
      { name: '📜 Logs', value: `Canal: ${db.logChannel ? `<#${db.logChannel}>` : '`Desativado`'}`, inline: false }
    )
    .setColor(db.themeColor && db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
    .setFooter({ text: `${client.user.username} • Sistema` })
    .setTimestamp();
}

function buildPainelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs').setEmoji('📜').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_theme').setLabel('Tema').setEmoji('🎨').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_lock_quick').setLabel('Trancar Chat').setEmoji('🔒').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_unlock_quick').setLabel('Destrancar Chat').setEmoji('🔓').setStyle(ButtonStyle.Success)
  );

  return [row1, row2];
}

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;
    const db = await getGuildData(interaction.guild.id);

    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        return interaction.reply({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons(), ephemeral: true });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'btn_back_main') {
        return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, db)], components: buildPainelButtons() });
      }

      if (interaction.customId === 'btn_theme') {
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_theme_color').setPlaceholder('🎨 Escolha a cor do Tema').addOptions(COLOR_OPTIONS);
        const btnBack = new ButtonBuilder().setCustomId('btn_back_main').setLabel('Voltar ao Painel').setEmoji('◀️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          content: '🎨 **Selecione a cor do Tema Principal:**',
          embeds: [],
          components: [new ActionRowBuilder().addComponents(colorSelect), new ActionRowBuilder().addComponents(btnBack)]
        });
      }

      if (interaction.customId === 'btn_welcome') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('📌 Canal de Boas-Vindas').addChannelTypes(ChannelType.GuildText);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('🎭 Cargo AutoRole');
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_welcome_color').setPlaceholder('🎨 Cor de Boas-Vindas').addOptions(COLOR_OPTIONS);
        const btnBack = new ButtonBuilder().setCustomId('btn_back_main').setLabel('Voltar ao Painel').setEmoji('◀️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          content: '⚙️ **Módulo de Boas-Vindas:**',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(colorSelect),
            new ActionRowBuilder().addComponents(btnBack)
          ]
        });
      }

      if (interaction.customId === 'btn_leave') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_leave_channel').setPlaceholder('📌 Canal de Saída').addChannelTypes(ChannelType.GuildText);
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_leave_color').setPlaceholder('🎨 Cor de Saída').addOptions(COLOR_OPTIONS);
        const btnBack = new ButtonBuilder().setCustomId('btn_back_main').setLabel('Voltar ao Painel').setEmoji('◀️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          content: '⚙️ **Módulo de Saída:**',
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(colorSelect),
            new ActionRowBuilder().addComponents(btnBack)
          ]
        });
      }
    }

    if (interaction.isStringSelectMenu() || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];

      if (interaction.customId === 'select_theme_color') {
        db.themeColor = val;
        await db.save();
      } else if (interaction.customId === 'select_welcome_color') {
        db.welcomeColor = val;
        await db.save();
      } else if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = val;
        await db.save();
      } else if (interaction.customId === 'select_autorole') {
        db.autoRole = val;
        await db.save();
      } else if (interaction.customId === 'select_leave_color') {
        db.leaveColor = val;
        await db.save();
      } else if (interaction.customId === 'select_leave_channel') {
        db.leaveChannel = val;
        await db.save();
      }

      return interaction.update({
        content: null,
        embeds: [buildPainelEmbed(interaction.guild, db)],
        components: buildPainelButtons()
      });
    }
  } catch (err) {
    console.error('[ERRO INTERACAO]:', err);
  }
});

process.on('unhandledRejection', r => console.error(r));
process.on('uncaughtException', e => console.error(e));

client.login(process.env.DISCORD_TOKEN);
