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
  console.error(`⚠️ [ANTI-CRASH] Uncaught Exception: ${err}\nOrigem:${origin}`);
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
  themeColor: '#5865F2',
  welcomeActive: true,
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  welcomeImageActive: true,
  leaveActive: true,
  leaveChannel: null,
  leaveMessage: 'O membro **{user.tag}** saiu do servidor.',
  leaveBanner: null,
  leaveImageActive: true,
  boostActive: true,
  boostChannel: null,
  boostMessage: 'Obrigado pelo impulso no servidor, {user}! 🚀',
  boostImageActive: true,
  invitesActive: true,
  invitesChannel: null,
  autoRole: null,
  ticketTitle: '🔱 CETS STORES 🔱',
  ticketDescription: '🎟️ BOT DE TICKETS — CETUS STORES 🐼\n\n📨 Precisa de ajuda? Abra um ticket e nossa equipe irá te atender!\n\n🛒 • Dúvidas sobre produtos\n💰 • Suporte para compras\n🛠️ • Ajuda e atendimento\n🔒 • Atendimento privado e organizado\n\n⚡ CETUS STORES — Qualidade e confiança em primeiro lugar!',
  ticketColor: '#5865F2',
  ticketBanner: null,
  ticketFooter: '🤖 Organizações • Roleplay | Desenvolvido por Cetus',
  logChannel: null,
  ticketTypes: {
    atendimento: { active: true, category: null, role: null, label: 'Atendimento', emoji: '🎟️' },
    denuncias: { active: false, category: null, role: null, label: 'Denúncias', emoji: '🚨' },
    recrutamento: { active: false, category: null, role: null, label: 'Recrutamento', emoji: '📜' },
    recursos: { active: false, category: null, role: null, label: 'Recursos', emoji: '🛠️' },
    financeiro: { active: false, category: null, role: null, label: 'Financeiro', emoji: '💰' }
  }
};

// 📌 FUNÇÃO PARA VERIFICAR SE É ADMIN OU DONO DO SERVIDOR
function isDonoOuAdmin(interaction) {
  if (!interaction.guild) return false;
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
  return isOwner || isAdmin;
}

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

    const data = docSnap.data();
    return {
      ...DEFAULT_GUILD_DATA,
      ...data,
      ticketTypes: {
        ...DEFAULT_GUILD_DATA.ticketTypes,
        ...(data.ticketTypes || {})
      }
    };
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
    return await getGuildData(guildId);
  } catch (error) {
    console.error('[ERRO ATUALIZAR FIRESTORE]:', error.message);
    return null;
  }
}

function parseHexColor(hexStr) {
  if (!hexStr || typeof hexStr !== 'string') return 0x5865F2;
  const cleanHex = hexStr.replace('#', '');
  const parsed = parseInt(cleanHex, 16);
  return isNaN(parsed) ? 0x5865F2 : parsed;
}

// LISTA DE COMANDOS SLASH
const commands = [
  new SlashCommandBuilder()
    .setName('boas-vindas')
    .setDescription('Abre o painel de configurações de boas-vindas, saída e cargos.'),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Envia o painel oficial de atendimento por tickets.'),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar e enviar uma mensagem V2 personalizada.'),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banir um usuário do servidor e registrar em logs.')
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuário a ser banido.').setRequired(true))
    .addStringOption(opt => opt.setName('motivo').setDescription('Motivo do banimento.').setRequired(false)),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Tranca o canal.'),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Destranca o canal.'),
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Limpa mensagens do chat.')
    .addIntegerOption(opt => opt.setName('quantidade').setDescription('Número de mensagens (1 a 100).').setMinValue(1).setMaxValue(100).setRequired(true))
];

// EVENTO READY E REGISTRO DE COMANDOS
client.once(Events.ClientReady, async () => {
  console.log('==================================================');
  console.log(`🤖 BOT ONLINE NA DISCLOUD: ${client.user.tag} (ID:${client.user.id})`);

  const cleanClientId = process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : client.user.id;
  const cleanToken = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;

  if (cleanToken) {
    const rest = new REST({ version: '10' }).setToken(cleanToken);
    try {
      await rest.put(
        Routes.applicationCommands(cleanClientId),
        { body: commands }
      );
      console.log('✅ [SLASH] Comandos registrados globalmente com sucesso!');
    } catch (error) {
      console.error('❌ [ERRO REGISTRO SLASH]:', error.message);
    }
  }
  console.log('==================================================');
});

// ==========================================
// BARRA DE NAVEGAÇÃO COMPARTILHADA DA BOAS-VINDAS
// ==========================================

function getWelcomeNavRows(includeHome = true) {
  const row1 = {
    type: 1,
    components: []
  };

  if (includeHome) {
    row1.components.push({ type: 2, style: 1, custom_id: 'btn_nav_menu_main', label: 'Menu', emoji: { name: '🏠' } });
  }

  row1.components.push(
    { type: 2, style: 2, custom_id: 'btn_nav_entrada', label: 'Entrada', emoji: { name: '👋' } },
    { type: 2, style: 2, custom_id: 'btn_nav_saida', label: 'Saída', emoji: { name: '🚪' } }
  );

  const row2 = {
    type: 1,
    components: [
      { type: 2, style: 2, custom_id: 'btn_nav_boost', label: 'Boost', emoji: { name: '🚀' } },
      { type: 2, style: 2, custom_id: 'btn_nav_convites', label: 'Convites', emoji: { name: '🎟️' } }
    ]
  };

  const row3 = {
    type: 1,
    components: [
      { type: 2, style: 2, custom_id: 'btn_nav_imagens', label: 'Imagens', emoji: { name: '🖼️' } },
      { type: 2, style: 2, custom_id: 'btn_nav_canais', label: 'Canais', emoji: { name: '📢' } }
    ]
  };

  const row4 = {
    type: 1,
    components: [
      { type: 2, style: 2, custom_id: 'btn_nav_testar', label: 'Testar', emoji: { name: '🧪' } },
      { type: 2, style: 2, custom_id: 'btn_nav_restaurar', label: 'Restaurar', emoji: { name: '🔄' } }
    ]
  };

  return [row1, row2, row3, row4];
}

// 📌 TELA 1: VISÃO GERAL (IMAGENS 151194 / 151195)[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span)
function gerarPayloadVisaoGeralBoasVindasV2(guildData) {
  const wChan = guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`Não configurado`';
  const lChan = guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '`Não configurado`';
  const bChan = guildData.boostChannel ? `<#${guildData.boostChannel}>` : '`Não configurado`';
  const iChan = guildData.invitesChannel ? `<#${guildData.invitesChannel}>` : '`Não configurado`';

  const wStatus = guildData.welcomeActive ? '🟢 Ativo' : '🔴 Desativado';
  const lStatus = guildData.leaveActive ? '🟢 Ativo' : '🔴 Desativado';
  const bStatus = guildData.boostActive ? '🟢 Ativo' : '🔴 Desativado';
  const iStatus = guildData.invitesActive ? '🟢 Ativo' : '🔴 Desativado';

  const roleTexto = guildData.autoRole ? `<@&${guildData.autoRole}>` : 'Configure um Cargo para atribuir.';

  const textoContent = 
    `# 👋 Sistema de Boas-Vindas\n\n` +
    `Gerencie mensagens de **entrada, saída, boost e convites** do seu servidor.\n\n` +
    `### 📊 Visão Geral\n` +
    `👋 **Entrada:** ${wStatus} •${wChan}\n` +
    `🚪 **Saída:** ${lStatus} •${lChan}\n` +
    `🚀 **Boost:** ${bStatus} •${bChan}\n` +
    `🎟️ **Convites:** ${iStatus} •${iChan}\n\n` +
    `### 🏷️ Cargos Automáticos\n` +
    `${roleTexto}\n\n` +
    `👤 Usuário: \`{user}\` • Nome: \`{username}\` • Apelido: \`{displayname}\` • ID: \`{user_id}\`\n` +
    `🏠 Servidor: \`{server}\` • ID: \`{server_id}\` • Membros: \`{members}\` • Posição: \`{member_position}\`\n` +
    `📅 Idade da conta: \`{account_age}\` • Criação: \`{created_at}\` • Entrada: \`{joined_at}\`\n` +
    `🚀 Boosts: \`{boosts}\` • Nível de boost: \`{boost_level}\` • Seus boosts: \`{user_boosts}\`\n` +
    `👑 Dono: \`{owner}\` • ID: \`{owner_id}\` • Convidado por: \`{inviter}\` • Convite: \`{invite_code}\``;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(false)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 2: CONFIGURAR ENTRADA (IMAGEMS 151196 / 151197)[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span)
function gerarPayloadConfigEntradaV2(guildData) {
  const statusStr = guildData.welcomeActive ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`Não configurado`';
  const imgStr = guildData.welcomeImageActive ? '🟢 Ativada • 1 imagem(ns) personalizada(s)' : '🔴 Desativada';
  const roleStr = guildData.autoRole ? `<@&${guildData.autoRole}>` : 'Nenhum cargo configurado';

  const textoContent = 
    `# 👋 Configurar Entrada\n\n` +
    `Configure o sistema executado quando um novo membro entrar.\n\n` +
    `### ⚙️ Configuração\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n` +
    `**Imagem:** ${imgStr}\n\n` +
    `📺 **Assista ao Tutorial de como Hospedar sua imagem no Imgur**\n\n` +
    `### 🏷️ Cargos Automáticos\n` +
    `${roleStr}`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.welcomeActive ? 4 : 3, custom_id: 'btn_toggle_welcome_active', label: guildData.welcomeActive ? 'Desativar Sistema' : 'Ativar Sistema' }
          ]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_welcome_channel',
            placeholder: '👋 Selecionar canal de entrada...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_edit_welcome_msg', label: 'Editar Mensagem', emoji: { name: '✍️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.welcomeImageActive ? 4 : 3, custom_id: 'btn_toggle_welcome_image', label: guildData.welcomeImageActive ? 'Desativar Imagem' : 'Ativar Imagem', emoji: { name: '🖼️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_config_welcome_image', label: 'Configurar Imagens', emoji: { name: '🖼️' } }
          ]
        },
        {
          type: 1,
          components: [{
            type: 6,
            custom_id: 'select_autorole',
            placeholder: '🏷️ Selecionar cargos para atribuir na entrada...'
          }]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 3: CONFIGURAR SAÍDA (IMAGEM 151198)[span_24](start_span)[span_24](end_span)
function gerarPayloadConfigSaidaV2(guildData) {
  const statusStr = guildData.leaveActive ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '`Não configurado`';
  const imgStr = guildData.leaveImageActive ? '🟢 Ativada • 1 imagem(ns) personalizada(s)' : '🔴 Desativada';

  const textoContent = 
    `# 🚪 Configurar Saída\n\n` +
    `Configure as mensagens enviadas quando um membro sair.\n\n` +
    `### ⚙️ Configuração\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n` +
    `**Imagem:** ${imgStr}`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.leaveActive ? 4 : 3, custom_id: 'btn_toggle_leave_active', label: guildData.leaveActive ? 'Desativar Sistema' : 'Ativar Sistema' }
          ]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_leave_channel',
            placeholder: '🚪 Selecionar canal de saída...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_edit_leave_msg', label: 'Editar Mensagem', emoji: { name: '✍️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.leaveImageActive ? 4 : 3, custom_id: 'btn_toggle_leave_image', label: guildData.leaveImageActive ? 'Desativar Imagem' : 'Ativar Imagem', emoji: { name: '🖼️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_config_leave_image', label: 'Configurar Imagens', emoji: { name: '🖼️' } }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 4: CONFIGURAR BOOST (IMAGEM 151199)[span_25](start_span)[span_25](end_span)
function gerarPayloadConfigBoostV2(guildData) {
  const statusStr = guildData.boostActive ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.boostChannel ? `<#${guildData.boostChannel}>` : '`Não configurado`';
  const imgStr = guildData.boostImageActive ? '🟢 Ativada • Card automático' : '🔴 Desativada';

  const textoContent = 
    `# 🚀 Configurar Boost\n\n` +
    `Configure as mensagens enviadas quando alguém impulsionar o servidor.\n\n` +
    `### ⚙️ Configuração\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n` +
    `**Imagem:** ${imgStr}`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.boostActive ? 4 : 3, custom_id: 'btn_toggle_boost_active', label: guildData.boostActive ? 'Desativar Sistema' : 'Ativar Sistema' }
          ]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_boost_channel',
            placeholder: '🚀 Selecionar canal de boost...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_edit_boost_msg', label: 'Editar Mensagem', emoji: { name: '✍️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.boostImageActive ? 4 : 3, custom_id: 'btn_toggle_boost_image', label: guildData.boostImageActive ? 'Desativar Imagem' : 'Ativar Imagem', emoji: { name: '🖼️' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_config_boost_image', label: 'Configurar Imagens', emoji: { name: '🖼️' } }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 5: CONFIGURAR CONVITES (IMAGEM 151200)[span_26](start_span)[span_26](end_span)
function gerarPayloadConfigConvitesV2(guildData) {
  const statusStr = guildData.invitesActive ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.invitesChannel ? `<#${guildData.invitesChannel}>` : '`Não configurado`';

  const textoContent = 
    `# 🎟️ Configurar Convites\n\n` +
    `Configure o sistema de identificação de convites.\n\n` +
    `### 🎟️ Sistema de Convites\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n\n` +
    `O sistema tenta identificar qual convite foi utilizado e quem criou o convite.\n\n` +
    `Caso não seja possível identificar, será exibido **Desconhecido**.`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.invitesActive ? 4 : 3, custom_id: 'btn_toggle_invites_active', label: guildData.invitesActive ? 'Desativar Convites' : 'Ativar Convites' }
          ]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_invites_channel',
            placeholder: '🎟️ Selecionar canal de convites...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 6: GERENCIAR IMAGENS (IMAGEM 151201)[span_27](start_span)[span_27](end_span)
function gerarPayloadGerenciarImagensV2(guildData) {
  const wImg = guildData.welcomeImageActive ? '🟢 Ativa' : '🔴 Desativada';
  const lImg = guildData.leaveImageActive ? '🟢 Ativa' : '🔴 Desativada';
  const bImg = guildData.boostImageActive ? '🟢 Ativa' : '🔴 Desativada';

  const textoContent = 
    `# 🖼️ Gerenciar Imagens\n\n` +
    `Ative ou desative os cards personalizados dos sistemas.\n\n` +
    `### 🖼️ Gerenciamento de Cards\n` +
    `Controle os cards enviados nos sistemas de **Entrada, Saída e Boost**.\n\n` +
    `Você também pode definir uma imagem personalizada para cada sistema.\n\n` +
    `### Status Atual\n` +
    `👋 **Entrada:** ${wImg}\n` +
    `🚪 **Saída:** ${lImg}\n` +
    `🚀 **Boost:** ${bImg}`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.welcomeImageActive ? 3 : 4, custom_id: 'btn_toggle_welcome_image', label: guildData.welcomeImageActive ? 'Entrada ON' : 'Entrada OFF', emoji: { name: '👋' } },
            { type: 2, style: guildData.leaveImageActive ? 3 : 4, custom_id: 'btn_toggle_leave_image', label: guildData.leaveImageActive ? 'Saida ON' : 'Saida OFF', emoji: { name: '🚪' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: guildData.boostImageActive ? 3 : 4, custom_id: 'btn_toggle_boost_image', label: guildData.boostImageActive ? 'Boost ON' : 'Boost OFF', emoji: { name: '🚀' } }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 7: CANAIS DO SISTEMA (IMAGEM 151202)[span_28](start_span)[span_28](end_span)
function gerarPayloadCanaisSistemaV2(guildData) {
  const wChan = guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`Não configurado`';
  const lChan = guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '`Não configurado`';
  const bChan = guildData.boostChannel ? `<#${guildData.boostChannel}>` : '`Não configurado`';
  const iChan = guildData.invitesChannel ? `<#${guildData.invitesChannel}>` : '`Não configurado`';

  const textoContent = 
    `# 📢 Canais do Sistema\n\n` +
    `Escolha onde cada tipo de mensagem será enviado.\n\n` +
    `### 📢 Canais Configurados\n` +
    `👋 **Entrada:** ${wChan}\n` +
    `🚪 **Saída:** ${lChan}\n` +
    `🚀 **Boost:** ${bChan}\n` +
    `🎟️ **Convites:** ${iChan}`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_welcome_channel',
            placeholder: '👋 Canal de Entrada...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_leave_channel',
            placeholder: '🚪 Canal de Saída...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_boost_channel',
            placeholder: '🚀 Canal de Boost...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_invites_channel',
            placeholder: '🎟️ Canal de Convites...',
            channel_types: [ChannelType.GuildText]
          }]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// 📌 TELA 8: CENTRAL DE TESTES (IMAGEM 151203)[span_29](start_span)[span_29](end_span)
function gerarPayloadCentralTestesV2(guildData) {
  const textoContent = 
    `# 🧪 Central de Testes\n\n` +
    `Faça testes antes de deixar o sistema funcionando oficialmente.\n\n` +
    `### 🧪 Central de Testes\n` +
    `Envie uma prévia de cada sistema antes de colocá-lo em funcionamento.\n\n` +
    `O teste utiliza **você como membro de teste** e substitui automaticamente as variáveis.\n\n` +
    `💡 **Dica:**\n` +
    `Se uma imagem personalizada estiver com problema, o bot informará o motivo somente para você.`;

  return {
    components: [{
      type: 17,
      accent_color: parseHexColor(guildData.themeColor),
      components: [
        { type: 10, content: textoContent },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: 3, custom_id: 'btn_testar_entrada', label: 'Testar Entrada', emoji: { name: '👋' } },
            { type: 2, style: 4, custom_id: 'btn_testar_saida', label: 'Testar Saída', emoji: { name: '🚪' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 1, custom_id: 'btn_testar_boost', label: 'Testar Boost', emoji: { name: '🚀' } }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        ...getWelcomeNavRows(true)
      ]
    }],
    flags: FLAG_V2
  };
}

// PAINEL DE TICKET PÚBLICO
function gerarPayloadPainelTicketPublicoV2(guildData) {
  const hexColor = parseHexColor(guildData?.ticketColor || guildData?.themeColor);

  const containerComponents = [
    {
      type: 10,
      content: `# ${guildData.ticketTitle || '🔱 CETS STORES 🔱'}\n\n${guildData.ticketDescription}`
    }
  ];

  if (guildData.ticketBanner && (guildData.ticketBanner.startsWith('http://') || guildData.ticketBanner.startsWith('https://'))) {
    containerComponents.push(
      { type: 14, divider: true, spacing: 1 },
      { type: 12, items: [{ media: { url: guildData.ticketBanner } }] }
    );
  }

  const optionsMenu = [];
  const types = guildData.ticketTypes || {};

  if (types.atendimento?.active) optionsMenu.push({ label: 'Atendimento', description: 'Atendimento geral da equipe.', value: 'tipo_atendimento', emoji: { name: '🎟️' } });
  if (types.denuncias?.active) optionsMenu.push({ label: 'Denúncias', description: 'Envie denúncias de forma privada.', value: 'tipo_denuncias', emoji: { name: '🚨' } });
  if (types.recrutamento?.active) optionsMenu.push({ label: 'Recrutamento', description: 'Candidate-se à nossa equipe.', value: 'tipo_recrutamento', emoji: { name: '📜' } });
  if (types.recursos?.active) optionsMenu.push({ label: 'Recursos', description: 'Solicitação de suporte de recursos.', value: 'tipo_recursos', emoji: { name: '🛠️' } });
  if (types.financeiro?.active) optionsMenu.push({ label: 'Financeiro', description: 'Suporte financeiro e compras.', value: 'tipo_financeiro', emoji: { name: '💰' } });

  containerComponents.push(
    { type: 14, divider: true, spacing: 1 },
    {
      type: 10,
      content: `### 🎟️ Atendimento\nEscolha uma categoria abaixo para iniciar seu atendimento.`
    }
  );

  if (optionsMenu.length > 0) {
    containerComponents.push({
      type: 1,
      components: [{
        type: 3,
        custom_id: 'select_categoria_ticket_publico',
        placeholder: 'Selecione uma opção...',
        options: optionsMenu
      }]
    });
  } else {
    containerComponents.push({
      type: 10,
      content: `*⚠️ Nenhuma categoria de ticket ativada no momento.*`
    });
  }

  containerComponents.push(
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: 'btn_config_ticket_main', emoji: { name: '⚙️' } }
      ]
    },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: guildData.ticketFooter || `🤖 Organizações • Roleplay | Desenvolvido por Cetus` }
  );

  return {
    components: [{ type: 17, accent_color: hexColor, components: containerComponents }],
    flags: FLAG_V2
  };
}

function gerarPayloadConfigSistemaTicketsV2() {
  return {
    components: [{
      type: 17,
      accent_color: 0x3498db,
      components: [
        { type: 10, content: `# ⚙️ Configuração do Sistema de Tickets\n\nGerencie as configurações do sistema abaixo.` },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: 3, custom_id: 'btn_gerenciar_tipos', label: 'Gerenciar Tipos', emoji: { name: '🎟️' } },
            { type: 2, style: 2, custom_id: 'btn_canal_transcricao', label: 'Canal Transcrição', emoji: { name: '📜' } },
            { type: 2, style: 1, custom_id: 'btn_editar_embed_ticket', label: 'Editar Embed', emoji: { name: '📝' } }
          ]
        }
      ]
    }],
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

    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'boas-vindas') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Apenas Administradores podem utilizar este comando.'), flags: MessageFlags.Ephemeral });
        }

        try {
          await interaction.deferReply({ flags: MessageFlags.Ephemeral });
          let guildData = await getGuildData(interaction.guild.id);
          const payload = gerarPayloadVisaoGeralBoasVindasV2(guildData);
          return interaction.editReply(payload);
        } catch (err) {
          console.error('[ERRO COMANDO BOAS-VINDAS]:', err);
        }
      }

      if (interaction.commandName === 'ticket') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Apenas Administradores podem executar este comando.'), flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let guildData = await getGuildData(interaction.guild.id);
        const payloadPublico = gerarPayloadPainelTicketPublicoV2(guildData);
        await interaction.channel.send(payloadPublico);

        return interaction.editReply({ ...gerarPayloadAvisoV2('✅ Painel Enviado', 'Painel oficial de atendimento enviado no canal!', 0x2ecc71) });
      }

      if (interaction.commandName === 'cv') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Você não tem permissão para usar este comando.'), flags: MessageFlags.Ephemeral });
        }

        const modal = new ModalBuilder().setCustomId('modal_cv').setTitle('🎨 Criar Mensagem Container');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_image').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setRequired(false))
        );
        return interaction.showModal(modal);
      }

      if (interaction.commandName === 'ban') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Você não tem permissão para banir membros.'), flags: MessageFlags.Ephemeral });
        }

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
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Permissão insuficiente.'), flags: MessageFlags.Ephemeral });
        }

        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
          return interaction.reply(gerarPayloadAvisoV2('🔒 Canal Trancado', 'Este canal foi trancado pela moderação.', 0xe67e22));
        } catch (err) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Erro ao Trancar', 'Falha ao trancar o canal. Verifique minhas permissões.'), flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.commandName === 'unlock') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Permissão insuficiente.'), flags: MessageFlags.Ephemeral });
        }

        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
          return interaction.reply(gerarPayloadAvisoV2('🔓 Canal Destrancado', 'Este canal foi destrancado.', 0x2ecc71));
        } catch (err) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Erro ao Destrancar', 'Falha ao destrancar o canal. Verifique minhas permissões.'), flags: MessageFlags.Ephemeral });
        }
      }

      if (interaction.commandName === 'clear') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Permissão insuficiente.'), flags: MessageFlags.Ephemeral });
        }

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

    let guildData = await getGuildData(interaction.guild.id);

    // 📌 TRATAMENTO DE MODAIS
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
        const updated = await updateGuildData(interaction.guild.id, {
          welcomeMessage: interaction.fields.getTextInputValue('welcome_msg_text')
        });

        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_edit_leave') {
        const updated = await updateGuildData(interaction.guild.id, {
          leaveMessage: interaction.fields.getTextInputValue('leave_msg_text')
        });

        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_edit_boost') {
        const updated = await updateGuildData(interaction.guild.id, {
          boostMessage: interaction.fields.getTextInputValue('boost_msg_text')
        });

        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (interaction.customId === 'modal_config_welcome_image') {
        const rawBanner = interaction.fields.getTextInputValue('welcome_banner_url');
        const updated = await updateGuildData(interaction.guild.id, {
          welcomeBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_config_leave_image') {
        const rawBanner = interaction.fields.getTextInputValue('leave_banner_url');
        const updated = await updateGuildData(interaction.guild.id, {
          leaveBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }
    }

    // 📌 TRATAMENTO DE BOTÕES DE NAVEGAÇÃO BOAS-VINDAS
    if (interaction.isButton()) {
      const cid = interaction.customId;

      if (cid === 'btn_nav_menu_main') return interaction.update(gerarPayloadVisaoGeralBoasVindasV2(guildData));
      if (cid === 'btn_nav_entrada') return interaction.update(gerarPayloadConfigEntradaV2(guildData));
      if (cid === 'btn_nav_saida') return interaction.update(gerarPayloadConfigSaidaV2(guildData));
      if (cid === 'btn_nav_boost') return interaction.update(gerarPayloadConfigBoostV2(guildData));
      if (cid === 'btn_nav_convites') return interaction.update(gerarPayloadConfigConvitesV2(guildData));
      if (cid === 'btn_nav_imagens') return interaction.update(gerarPayloadGerenciarImagensV2(guildData));
      if (cid === 'btn_nav_canais') return interaction.update(gerarPayloadCanaisSistemaV2(guildData));
      if (cid === 'btn_nav_testar') return interaction.update(gerarPayloadCentralTestesV2(guildData));

      if (cid === 'btn_nav_restaurar') {
        const updated = await updateGuildData(interaction.guild.id, DEFAULT_GUILD_DATA);
        return interaction.update(gerarPayloadVisaoGeralBoasVindasV2(updated || guildData));
      }

      if (cid === 'btn_toggle_welcome_active') {
        const updated = await updateGuildData(interaction.guild.id, { welcomeActive: !guildData.welcomeActive });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (cid === 'btn_toggle_welcome_image') {
        const updated = await updateGuildData(interaction.guild.id, { welcomeImageActive: !guildData.welcomeImageActive });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (cid === 'btn_toggle_leave_active') {
        const updated = await updateGuildData(interaction.guild.id, { leaveActive: !guildData.leaveActive });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (cid === 'btn_toggle_leave_image') {
        const updated = await updateGuildData(interaction.guild.id, { leaveImageActive: !guildData.leaveImageActive });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (cid === 'btn_toggle_boost_active') {
        const updated = await updateGuildData(interaction.guild.id, { boostActive: !guildData.boostActive });
        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (cid === 'btn_toggle_boost_image') {
        const updated = await updateGuildData(interaction.guild.id, { boostImageActive: !guildData.boostImageActive });
        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (cid === 'btn_toggle_invites_active') {
        const updated = await updateGuildData(interaction.guild.id, { invitesActive: !guildData.invitesActive });
        return interaction.update(gerarPayloadConfigConvitesV2(updated || guildData));
      }

      if (cid === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_welcome').setTitle('Editar Mensagem de Entrada');
        const msgInput = new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.welcomeMessage || '').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Editar Mensagem de Saída');
        const msgInput = new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.leaveMessage || '').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_edit_boost_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_boost').setTitle('Editar Mensagem de Boost');
        const msgInput = new TextInputBuilder().setCustomId('boost_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.boostMessage || '').setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(msgInput));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_config_welcome_image') {
        const modal = new ModalBuilder().setCustomId('modal_config_welcome_image').setTitle('Configurar Imagem Entrada');
        const bannerInput = new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Imgur)').setStyle(TextInputStyle.Short).setValue(guildData.welcomeBanner || '').setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_config_leave_image') {
        const modal = new ModalBuilder().setCustomId('modal_config_leave_image').setTitle('Configurar Imagem Saída');
        const bannerInput = new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Imgur)').setStyle(TextInputStyle.Short).setValue(guildData.leaveBanner || '').setRequired(false);
        modal.addComponents(new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_testar_entrada') {
        client.emit('guildMemberAdd', interaction.member);
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste de Entrada Disparado', 'Mensagem de teste de entrada enviada no canal configurado!', 0x2ecc71), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_testar_saida') {
        client.emit('guildMemberRemove', interaction.member);
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste de Saída Disparado', 'Mensagem de teste de saída enviada no canal configurado!', 0xed4245), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_testar_boost') {
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste de Boost Disparado', 'Mensagem de teste de boost enviada com sucesso!', 0x5865f2), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_close_ticket') {
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
    }

    // 📌 PROCESSAMENTO DE SELETORES (SELECT MENUS)
    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      const cid = interaction.customId;

      if (cid === 'select_welcome_channel') {
        const updated = await updateGuildData(interaction.guild.id, { welcomeChannel: val });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (cid === 'select_leave_channel') {
        const updated = await updateGuildData(interaction.guild.id, { leaveChannel: val });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (cid === 'select_boost_channel') {
        const updated = await updateGuildData(interaction.guild.id, { boostChannel: val });
        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (cid === 'select_invites_channel') {
        const updated = await updateGuildData(interaction.guild.id, { invitesChannel: val });
        return interaction.update(gerarPayloadConfigConvitesV2(updated || guildData));
      }
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      const cid = interaction.customId;

      if (cid === 'select_autorole') {
        const updated = await updateGuildData(interaction.guild.id, { autoRole: val });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }
    }

  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// ==========================================
// BOAS-VINDAS E SAÍDA AUTOMÁTICAS
// ==========================================

function formatVariables(text, member, guild) {
  if (!text) return '';
  const now = new Date();
  const accountCreated = new Date(member.user.createdAt);
  const memberJoined = new Date(member.joinedAt || Date.now());

  return text
    .replace(/{user}/g, `${member}`)
    .replace(/{username}/g, member.user.username)
    .replace(/{displayname}/g, member.displayName)
    .replace(/{user_id}/g, member.user.id)
    .replace(/{server}/g, guild.name)
    .replace(/{server_id}/g, guild.id)
    .replace(/{members}/g, guild.memberCount)
    .replace(/{member_position}/g, guild.memberCount)
    .replace(/{account_age}/g, `${Math.floor((now - accountCreated) / (1000 * 60 * 60 * 24))} dias`)
    .replace(/{created_at}/g, accountCreated.toLocaleDateString('pt-BR'))
    .replace(/{joined_at}/g, memberJoined.toLocaleDateString('pt-BR'))
    .replace(/{boosts}/g, guild.premiumSubscriptionCount || 0)
    .replace(/{boost_level}/g, guild.premiumTier)
    .replace(/{owner}/g, `<@${guild.ownerId}>`)
    .replace(/{owner_id}/g, guild.ownerId);
}

client.on('guildMemberAdd', async (member) => {
  const guildData = await getGuildData(member.guild.id);
  if (!guildData || !guildData.welcomeActive) return;

  if (guildData.autoRole) {
    await member.roles.add(guildData.autoRole).catch(() => {});
  }

  if (guildData.welcomeChannel) {
    const channel = member.guild.channels.cache.get(guildData.welcomeChannel);
    if (channel) {
      const text = formatVariables(guildData.welcomeMessage, member, member.guild);
      const color = parseHexColor(guildData.themeColor);

      const containerComp = [
        { type: 10, content: `# 👋 Seja Bem-vindo(a)!\n\n${text}` }
      ];

      if (guildData.welcomeImageActive && guildData.welcomeBanner && (guildData.welcomeBanner.startsWith('http://') || guildData.welcomeBanner.startsWith('https://'))) {
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
  if (!guildData || !guildData.leaveActive) return;

  if (guildData.leaveChannel) {
    const channel = member.guild.channels.cache.get(guildData.leaveChannel);
    if (channel) {
      const text = formatVariables(guildData.leaveMessage, member, member.guild);
      const color = parseHexColor('#ED4245');

      const containerComp = [
        { type: 10, content: `# 🚪 Membro Saiu\n\n${text}` }
      ];

      if (guildData.leaveImageActive && guildData.leaveBanner && (guildData.leaveBanner.startsWith('http://') || guildData.leaveBanner.startsWith('https://'))) {
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
