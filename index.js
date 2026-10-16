require('dotenv').config();
const path = require('path');
const fs = require('fs');

const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  Events,
  AttachmentBuilder,
  MessageFlags,
  ChannelType
} = require('discord.js');
const admin = require('firebase-admin');

// Flag explícita do Discord para Components V2
const FLAG_V2 = MessageFlags.IsComponentsV2;

// ==========================================
// TRATAMENTO GLOBAL DE ERROS (ANTI-CRASH)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [ANTI-CRASH] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err, origin) => {
  console.error(`⚠️ [ANTI-CRASH] Uncaught Exception: ${err}\nOrigem: ${origin}`);
});

// 📌 INICIALIZAÇÃO SEGURA DO FIREBASE FIRESTORE
let db;

try {
  const credentialsFileName = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'bot-cets-firebase-adminsdk-fbsvc-94a3a86826.json';
  const jsonPath = path.resolve(process.cwd(), credentialsFileName);

  if (fs.existsSync(jsonPath)) {
    const serviceAccount = require(jsonPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('[BANCO] Firebase Admin inicializado com sucesso via arquivo de credenciais!');
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault()
    });
    console.log('[BANCO] Firebase Admin inicializado com sucesso via Application Default!');
  }

  db = admin.firestore();
} catch (error) {
  console.error('[ERRO CRÍTICO FIREBASE]: Não foi possível inicializar o Firebase Admin:', error.message);
}

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

// Dados padrão para fallback de emergência
const DEFAULT_GUILD_DATA = {
  themeColor: '#57F287',
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  welcomeColor: '#57F287',
  leaveChannel: null,
  leaveMessage: 'O membro **{user.tag}** saiu do servidor.',
  leaveBanner: null,
  leaveColor: '#ED4245',
  autoRole: null,
  ticketChannel: null,
  ticketCategory: null,
  ticketSupportRole: null,
  ticketTitle: '🎟️ Central de Atendimento & Suporte',
  ticketDescription: 'Selecione a opção desejada abaixo para abrir seu atendimento.',
  ticketColor: '#57F287',
  logChannel: null
};

// 📌 FUNÇÃO PARA OBTER / CRIAR CONFIGURAÇÕES NO FIRESTORE
async function getGuildData(guildId) {
  try {
    if (!db) {
      console.error('[ERRO FIRESTORE]: Instância do banco não inicializada.');
      return { guildId, ...DEFAULT_GUILD_DATA };
    }
    const docRef = db.collection('guilds').doc(guildId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const defaultData = { guildId, ...DEFAULT_GUILD_DATA };
      await docRef.set(defaultData);
      return defaultData;
    }

    return docSnap.data();
  } catch (error) {
    console.error('[ERRO FIRESTORE]:', error.message);
    return { guildId, ...DEFAULT_GUILD_DATA };
  }
}

// 📌 FUNÇÃO PARA ATUALIZAR DADOS NO FIRESTORE
async function updateGuildData(guildId, updates) {
  try {
    if (!db) return null;
    const docRef = db.collection('guilds').doc(guildId);
    await docRef.set(updates, { merge: true });
    const updatedSnap = await docRef.get();
    return updatedSnap.data();
  } catch (error) {
    console.error('[ERRO ATUALIZAR FIRESTORE]:', error.message);
    return null;
  }
}

function parseHexColor(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return 0x2f3136;
  const cleanHex = hexStr.replace('#', '');
  const parsed = parseInt(cleanHex, 16);
  return isNaN(parsed) ? 0x2f3136 : parsed;
}

const COLOR_OPTIONS = [
  { label: 'Verde Esmeralda', description: 'Tom verde vivo', value: '#57F287' },
  { label: 'Azul Elétrico', description: 'Padrão Discord', value: '#5865F2' },
  { label: 'Roxo Cyberpunk', description: 'Tom roxo destacado', value: '#9B59B6' },
  { label: 'Vermelho Carmim', description: 'Tom vermelho forte', value: '#ED4245' },
  { label: 'Amarelo Ouro', description: 'Tom amarelo brilhante', value: '#FEE75C' },
  { label: 'Laranja Vivo', description: 'Tom laranja vibrante', value: '#E67E22' },
  { label: 'Branco Minimalista', description: 'Aparência limpa', value: '#FFFFFF' },
  { label: 'Dark / Escuro', description: 'Tom escuro', value: '#2F3136' }
];

// LISTA COMPLETA DE COMANDOS SLASH
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo de configurações do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar e enviar uma mensagem V2 personalizada.')
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

// EVENTO READY E REGISTRO DE COMANDOS
client.once(Events.ClientReady, async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);

  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log('[SLASH] Comandos globais registrados com sucesso!');
    } catch (error) {
      console.error('[ERRO REGISTRO SLASH]:', error);
    }
  }
});

// ==========================================
// CONSTRUTORES DE CONTAINER V2 (DESIGN 100% V2)
// ==========================================

function gerarPayloadPainelV2(guild, guildData, subModulo = null) {
  const logoUrl = guild && guild.iconURL({ extension: 'png', size: 256 }) ? guild.iconURL({ extension: 'png', size: 256 }) : null;
  const hexColor = parseHexColor(guildData?.themeColor);

  const textoPrincipal = 
    `# ⚙️ GESTÃO • ${guild.name.toUpperCase()}\n\n` +
    `Bem-vindo à **Central de Configurações Administrativas**.\n\n` +
    `🟢 **Status Banco:** \`Sincronizado (Firebase Firestore)\`\n\n` +
    `🎨 **Cor do Tema:** \`${guildData?.themeColor || '#2F3136'}\`\n` +
    `👋 **Boas-Vindas:** ${guildData?.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`❌ Desativado`'} | Cargo: ${guildData?.autoRole ? `<@&${guildData.autoRole}>` : '`❌ Desativado`'}\n` +
    `🚪 **Saída:** ${guildData?.leaveChannel ? `<#${guildData.leaveChannel}>` : '`❌ Desativado`'}\n` +
    `🎟️ **Tickets:** ${guildData?.ticketChannel ? `<#${guildData.ticketChannel}>` : '`❌ Não definido`'} | Categoria: ${guildData?.ticketCategory ? `<#${guildData.ticketCategory}>` : '`❌ Não definida`'}\n` +
    `📜 **Logs & Transcrições:** ${guildData?.logChannel ? `<#${guildData.logChannel}>` : '`❌ Desativado`'}`;

  const containerComponents = [];

  if (logoUrl) {
    containerComponents.push({
      type: 9,
      components: [{ type: 10, content: textoPrincipal }],
      accessory: { type: 11, media: { url: logoUrl } }
    });
  } else {
    containerComponents.push({ type: 10, content: textoPrincipal });
  }

  containerComponents.push({ type: 14, divider: true, spacing: 1 });

  // Renderiza Sub-módulos dinâmicos dentro da janela principal
  if (subModulo === 'welcome') {
    containerComponents.push(
      { type: 10, content: `### 👋 Configuração de Boas-Vindas & AutoRole\nEscolha os canais e cargo inicial nos seletores abaixo:` },
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: 'select_welcome_channel',
          placeholder: '📌 Selecione o canal de boas-vindas',
          channel_types: [ChannelType.GuildText]
        }]
      },
      {
        type: 1,
        components: [{
          type: 6,
          custom_id: 'select_autorole',
          placeholder: '🎭 Selecione o cargo automático (AutoRole)'
        }]
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, custom_id: 'btn_edit_welcome_msg', label: 'Editar Mensagem & Banner', emoji: { name: '✍️' } }
        ]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  } else if (subModulo === 'leave') {
    containerComponents.push(
      { type: 10, content: `### 🚪 Configuração do Sistema de Saída\nEscolha o canal e personalize os textos:` },
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: 'select_leave_channel',
          placeholder: '📌 Selecione o canal de saída',
          channel_types: [ChannelType.GuildText]
        }]
      },
      {
        type: 1,
        components: [
          { type: 2, style: 2, custom_id: 'btn_edit_leave_msg', label: 'Editar Mensagem & Banner', emoji: { name: '✍️' } }
        ]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  } else if (subModulo === 'tickets') {
    containerComponents.push(
      { type: 10, content: `### 🎟️ Central de Tickets & Suporte\nConfigure o canal, categoria e ative o envio do painel público:` },
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: 'select_ticket_send_channel',
          placeholder: '📢 Selecionar canal onde o painel será enviado',
          channel_types: [ChannelType.GuildText]
        }]
      },
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: 'select_ticket_category',
          placeholder: '📁 Selecionar categoria dos tickets',
          channel_types: [ChannelType.GuildCategory]
        }]
      },
      {
        type: 1,
        components: [{
          type: 6,
          custom_id: 'select_ticket_role',
          placeholder: '🛠️ Selecionar cargo dos atendentes'
        }]
      },
      {
        type: 1,
        components: [
          { type: 2, style: 3, custom_id: 'btn_send_ticket_panel', label: 'Enviar Painel no Canal', emoji: { name: '📩' } }
        ]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  } else if (subModulo === 'logs') {
    containerComponents.push(
      { type: 10, content: `### 📜 Canal de Logs Gerais & Transcrições\nSelecione onde os registros do servidor serão salvos:` },
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: 'select_log_channel',
          placeholder: '📜 Selecione o canal de logs gerais',
          channel_types: [ChannelType.GuildText]
        }]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  } else if (subModulo === 'theme') {
    containerComponents.push(
      { type: 10, content: `### 🎨 Seleção de Cor do Tema\nAltere a identidade visual dos painéis do bot:` },
      {
        type: 1,
        components: [{
          type: 3,
          custom_id: 'select_theme_color',
          placeholder: '🎨 Selecione a cor do Tema',
          options: COLOR_OPTIONS
        }]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  }

  // Linhas Principais de Navegação do Painel
  containerComponents.push(
    {
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: 'btn_welcome', label: 'Boas-Vindas', emoji: { name: '👋' } },
        { type: 2, style: 2, custom_id: 'btn_leave', label: 'Saída', emoji: { name: '🚪' } },
        { type: 2, style: 3, custom_id: 'btn_tickets', label: 'Tickets', emoji: { name: '🎟️' } },
        { type: 2, style: 4, custom_id: 'btn_logs', label: 'Logs', emoji: { name: '📜' } }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: 'btn_theme', label: 'Cor do Tema', emoji: { name: '🎨' } },
        { type: 2, style: 1, custom_id: 'btn_refresh_panel', label: 'Atualizar Painel', emoji: { name: '🔄' } }
      ]
    },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: `🤖 Organizações • Roleplay | Desenvolvido por Cetus` }
  );

  return {
    components: [{ type: 17, accent_color: hexColor, components: containerComponents }],
    flags: FLAG_V2
  };
}

function gerarPayloadPainelTicketPublicoV2(guildData) {
  const hexColor = parseHexColor(guildData?.ticketColor || guildData?.themeColor);

  const containerComponents = [
    {
      type: 10,
      content: `# ${guildData.ticketTitle || '🎟️ Central de Atendimento & Suporte'}\n\n${guildData.ticketDescription || 'Clique no botão abaixo para abrir um ticket privado com nossa equipe.'}`
    },
    { type: 14, divider: true, spacing: 1 },
    {
      type: 1,
      components: [
        { type: 2, style: 1, custom_id: 'btn_open_ticket', label: 'Abrir Ticket', emoji: { name: '📩' } }
      ]
    },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: `🤖 Organizações • Roleplay | Desenvolvido por Cetus` }
  ];

  return {
    components: [{ type: 17, accent_color: hexColor, components: containerComponents }],
    flags: FLAG_V2
  };
}

function gerarPayloadAvisoV2(titulo, mensagem, corHex = 0xe74c3c) {
  return {
    components: [{
      type: 17,
      accent_color: corHex,
      components: [
        { type: 10, content: `# ${titulo}\n\n${mensagem}` }
      ]
    }],
    flags: FLAG_V2
  };
}

// ==========================================
// INTERAÇÕES E PROCESSAMENTO
// ==========================================

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;

    // 📌 PROCESSAMENTO DOS COMANDOS SLASH
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'cv') {
        const modal = new ModalBuilder().setCustomId('modal_cv').setTitle('🎨 Criar Mensagem Container');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_image').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.commandName === 'painel') {
        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          let guildData = await getGuildData(interaction.guild.id);
          const payload = gerarPayloadPainelV2(interaction.guild, guildData);
          return interaction.editReply(payload);
        } catch (err) {
          console.error('[ERRO COMANDO PAINEL]:', err);
          if (interaction.deferred) {
            return interaction.editReply(gerarPayloadAvisoV2('❌ Erro no Painel', 'Ocorreu um erro ao tentar abrir o painel.'));
          }
        }
      }

      if (interaction.commandName === 'ban') {
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado.';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ ...gerarPayloadAvisoV2('❌ Usuário Não Encontrado', 'O usuário informado não está no servidor.'), flags: MessageFlags.Ephemeral });
        if (!member.bannable) return interaction.reply({ ...gerarPayloadAvisoV2('❌ Permissão Negada', 'Não tenho permissão suficiente para banir este membro.'), flags: MessageFlags.Ephemeral });

        await member.ban({ reason: `${reason} | Por: ${interaction.user.tag}` });

        let guildData = await getGuildData(interaction.guild.id);
        if (guildData?.logChannel) {
          const logChan = interaction.guild.channels.cache.get(guildData.logChannel);
          if (logChan) {
            const payloadLog = {
              components: [{
                type: 17,
                accent_color: 0xed4245,
                components: [
                  { type: 10, content: `# 🔨 Membro Banido\n\n👤 **Usuário:** ${targetUser.tag} (\`${targetUser.id}\`)\n🛡️ **Autor:** ${interaction.user}\n📌 **Motivo:** ${reason}` }
                ]
              }],
              flags: FLAG_V2
            };
            logChan.send(payloadLog).catch(() => {});
          }
        }

        return interaction.reply(gerarPayloadAvisoV2('✅ Usuário Banido', `O membro **${targetUser.tag}** foi banido com sucesso!`, 0x2ecc71));
      }

      if (interaction.commandName === 'lock') {
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
          return interaction.reply(gerarPayloadAvisoV2('🔒 Canal Trancado', 'Este canal foi trancado pela moderação.', 0xe67e22));
        } catch (err) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Erro ao Trancar', 'Falha ao trancar o canal. Verifique minhas permissões.'), flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.commandName === 'unlock') {
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
          return interaction.reply(gerarPayloadAvisoV2('🔓 Canal Destrancado', 'Este canal foi destrancado.', 0x2ecc71));
        } catch (err) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Erro ao Destrancar', 'Falha ao destrancar o canal. Verifique minhas permissões.'), flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('quantidade');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          if (deleted.size === 0) {
            return interaction.reply({ ...gerarPayloadAvisoV2('⚠️ Nenhuma Mensagem Apagada', 'Mensagens enviadas há mais de 14 dias não podem ser apagadas em massa.'), flags: MessageFlags.Ephemeral });
          }
          return interaction.reply({ ...gerarPayloadAvisoV2('🧹 Chat Limpo', `Foram apagadas **${deleted.size}** mensagens com sucesso!`, 0x2ecc71), flags: MessageFlags.Ephemeral });
        } catch (err) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Erro ao Apagar', 'Falha ao apagar mensagens no canal.'), flags: MessageFlags.Ephemeral });
        }
      }
    }

    // 📌 PROCESSAMENTO DE MODAIS, BOTÕES E SELETORES
    let guildData = await getGuildData(interaction.guild.id);

    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_cv') {
        const title = interaction.fields.getTextInputValue('cv_title');
        const description = interaction.fields.getTextInputValue('cv_description');
        const image = interaction.fields.getTextInputValue('cv_image');
        const color = parseHexColor(interaction.fields.getTextInputValue('cv_color'));

        const containerComp = [
          { type: 10, content: `# ${title}\n\n${description}` }
        ];

        if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
          containerComp.push(
            { type: 14, divider: true, spacing: 1 },
            { type: 12, items: [{ media: { url: image } }] }
          );
        }

        const payloadCv = {
          components: [{ type: 17, accent_color: color, components: containerComp }],
          flags: FLAG_V2
        };

        await interaction.channel.send(payloadCv);
        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Sucesso', 'Mensagem enviada no canal com sucesso!', 0x2ecc71), flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'modal_edit_welcome') {
        const rawBanner = interaction.fields.getTextInputValue('welcome_banner_url');
        const updated = await updateGuildData(interaction.guild.id, {
          welcomeMessage: interaction.fields.getTextInputValue('welcome_msg_text'),
          welcomeBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update(gerarPayloadPainelV2(interaction.guild, updated || guildData, 'welcome'));
      }

      if (interaction.customId === 'modal_edit_leave') {
        const rawBanner = interaction.fields.getTextInputValue('leave_banner_url');
        const updated = await updateGuildData(interaction.guild.id, {
          leaveMessage: interaction.fields.getTextInputValue('leave_msg_text'),
          leaveBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update(gerarPayloadPainelV2(interaction.guild, updated || guildData, 'leave'));
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'btn_refresh_panel') {
        const updatedData = await getGuildData(interaction.guild.id);
        return interaction.update(gerarPayloadPainelV2(interaction.guild, updatedData));
      }

      if (interaction.customId === 'btn_welcome') {
        return interaction.update(gerarPayloadPainelV2(interaction.guild, guildData, 'welcome'));
      }

      if (interaction.customId === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_welcome').setTitle('Configurar Boas-Vindas');
        const msgInput = new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(guildData.welcomeMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(guildData.welcomeBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_leave') {
        return interaction.update(gerarPayloadPainelV2(interaction.guild, guildData, 'leave'));
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Configurar Mensagem de Saída');
        const msgInput = new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(guildData.leaveMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(guildData.leaveBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        return interaction.update(gerarPayloadPainelV2(interaction.guild, guildData, 'tickets'));
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        const targetChan = guildData.ticketChannel ? interaction.guild.channels.cache.get(guildData.ticketChannel) : interaction.channel;
        if (!targetChan) return interaction.reply({ ...gerarPayloadAvisoV2('❌ Canal Inválido', 'Selecione um canal no menu acima antes de enviar.'), flags: MessageFlags.Ephemeral });

        const payloadPublico = gerarPayloadPainelTicketPublicoV2(guildData);
        await targetChan.send(payloadPublico);
        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Painel Enviado', `O Painel de Tickets foi enviado no canal ${targetChan}!`, 0x2ecc71), flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'btn_open_ticket') {
        if (!guildData.ticketCategory) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Categoria Não Configurada', 'A categoria de tickets ainda não foi definida no `/painel`.'), flags: MessageFlags.Ephemeral });
        }

        const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        const channelName = `ticket-${safeUsername || interaction.user.id}`;

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === channelName);
        if (existingChannel) {
          return interaction.reply({ ...gerarPayloadAvisoV2('⚠️ Ticket Já Existente', `Você já possui um ticket aberto em ${existingChannel}!`, 0xf1c40f), flags: MessageFlags.Ephemeral });
        }

        const permissionOverwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        if (guildData.ticketSupportRole) {
          permissionOverwrites.push({
            id: guildData.ticketSupportRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
          });
        }

        const channel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: guildData.ticketCategory,
          permissionOverwrites
        });

        const payloadTicketTicket = {
          components: [{
            type: 17,
            accent_color: 0x3498db,
            components: [
              { type: 10, content: `# 🎟️ Ticket de ${interaction.user.username}\n\nOlá ${interaction.user}, descreva sua solicitação. A equipe responderá em breve.` },
              { type: 14, divider: true, spacing: 1 },
              {
                type: 1,
                components: [
                  { type: 2, style: 4, custom_id: 'btn_close_ticket', label: 'Fechar & Gerar Transcrição', emoji: { name: '🔒' } }
                ]
              }
            ]
          }],
          flags: FLAG_V2
        };

        await channel.send(payloadTicketTicket);
        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Ticket Criado', `Seu ticket foi aberto no canal ${channel}`, 0x2ecc71), flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'btn_close_ticket') {
        await interaction.reply({ ...gerarPayloadAvisoV2('🔒 Encerrando Ticket', 'Gerando transcrição e excluindo o canal em 5 segundos...', 0xe67e22) });

        try {
          const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
          const formattedLogs = fetchedMessages
            .reverse()
            .map(m => `[${new Date(m.createdAt).toLocaleString('pt-BR')}] ${m.author.tag}: ${m.content}`)
            .join('\n');

          const buffer = Buffer.from(formattedLogs, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, { name: `transcricao-${interaction.channel.name}.txt` });

          if (guildData.logChannel) {
            const logChan = interaction.guild.channels.cache.get(guildData.logChannel);
            if (logChan) {
              const payloadLog = {
                components: [{
                  type: 17,
                  accent_color: 0xfee75c,
                  components: [
                    { type: 10, content: `# 📝 Transcrição de Ticket Encerrado\n\n📁 **Canal:** \`${interaction.channel.name}\`\n👤 **Encerrado Por:** ${interaction.user}` }
                  ]
                }],
                flags: FLAG_V2
              };

              await logChan.send({ ...payloadLog, files: [attachment] }).catch(() => {});
            }
          }
        } catch (err) {
          console.error('[ERRO TRANSCRIÇÃO]:', err);
        }

        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      }

      if (interaction.customId === 'btn_logs') {
        return interaction.update(gerarPayloadPainelV2(interaction.guild, guildData, 'logs'));
      }

      if (interaction.customId === 'btn_theme') {
        return interaction.update(gerarPayloadPainelV2(interaction.guild, guildData, 'theme'));
      }
    }

    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      let sub = null;

      if (interaction.customId === 'select_welcome_channel') { updates.welcomeChannel = val; sub = 'welcome'; }
      if (interaction.customId === 'select_leave_channel') { updates.leaveChannel = val; sub = 'leave'; }
      if (interaction.customId === 'select_log_channel') { updates.logChannel = val; sub = 'logs'; }
      if (interaction.customId === 'select_ticket_send_channel') { updates.ticketChannel = val; sub = 'tickets'; }
      if (interaction.customId === 'select_ticket_category') { updates.ticketCategory = val; sub = 'tickets'; }

      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update(gerarPayloadPainelV2(interaction.guild, updated || guildData, sub));
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      let sub = null;

      if (interaction.customId === 'select_welcome_role' || interaction.customId === 'select_autorole') { updates.autoRole = val; sub = 'welcome'; }
      if (interaction.customId === 'select_ticket_role') { updates.ticketSupportRole = val; sub = 'tickets'; }

      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update(gerarPayloadPainelV2(interaction.guild, updated || guildData, sub));
    }

    if (interaction.isStringSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      let sub = null;

      if (interaction.customId === 'select_theme_color') { updates.themeColor = val; sub = 'theme'; }

      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update(gerarPayloadPainelV2(interaction.guild, updated || guildData, sub));
    }

  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// ==========================================
// BOAS-VINDAS E SAÍDA AUTOMÁTICAS (CONTAINERS V2)
// ==========================================

client.on('guildMemberAdd', async (member) => {
  const guildData = await getGuildData(member.guild.id);
  if (!guildData) return;

  if (guildData.autoRole) {
    await member.roles.add(guildData.autoRole).catch(() => {});
  }

  if (guildData.welcomeChannel) {
    const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
    if (channel) {
      const text = (guildData.welcomeMessage || 'Olá {user}, seja bem-vindo(a) ao **{server}**!')
        .replace(/{user}/g, `${member}`)
        .replace(/{server}/g, member.guild.name);

      const color = parseHexColor(guildData.welcomeColor || guildData.themeColor);

      const containerComp = [
        { type: 10, content: `# 👋 Seja Bem-vindo(a)!\n\n${text}` }
      ];

      if (guildData.welcomeBanner && (guildData.welcomeBanner.startsWith('http://') || guildData.welcomeBanner.startsWith('https://'))) {
        containerComp.push(
          { type: 14, divider: true, spacing: 1 },
          { type: 12, items: [{ media: { url: guildData.welcomeBanner } }] }
        );
      }

      channel.send({
        components: [{ type: 17, accent_color: color, components: containerComp }],
        flags: FLAG_V2
      }).catch(() => {});
    }
  }
});

client.on('guildMemberRemove', async (member) => {
  const guildData = await getGuildData(member.guild.id);
  if (!guildData) return;

  if (guildData.leaveChannel) {
    const channel = member.guild.channels.cache.get(guildData.leaveChannel);
    if (channel) {
      const text = (guildData.leaveMessage || 'O membro **{user.tag}** saiu do servidor.')
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name);

      const color = parseHexColor(guildData.leaveColor || '#ED4245');

      const containerComp = [
        { type: 10, content: `# 🚪 Membro Saiu\n\n${text}` }
      ];

      if (guildData.leaveBanner && (guildData.leaveBanner.startsWith('http://') || guildData.leaveBanner.startsWith('https://'))) {
        containerComp.push(
          { type: 14, divider: true, spacing: 1 },
          { type: 12, items: [{ media: { url: guildData.leaveBanner } }] }
        );
      }

      channel.send({
        components: [{ type: 17, accent_color: color, components: containerComp }],
        flags: FLAG_V2
      }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
