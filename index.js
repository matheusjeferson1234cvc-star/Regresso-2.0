require('dotenv').config();
const path = path = require('path');
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
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember]
});

// Configurações padrão do servidor
const DEFAULT_GUILD_DATA = {
  themeColor: '#5865F2',
  welcomeActive: false,
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  welcomeImageActive: false,
  leaveActive: false,
  leaveChannel: null,
  leaveMessage: 'O membro **{user.tag}** saiu do servidor.',
  leaveBanner: null,
  leaveImageActive: false,
  boostActive: false,
  boostChannel: null,
  boostMessage: 'Obrigado pelo impulso no servidor, {user}! 🚀',
  boostBanner: null,
  boostImageActive: false,
  invitesActive: false,
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

function isDonoOuAdmin(interaction) {
  if (!interaction.guild) return false;
  const isOwner = interaction.guild.ownerId === interaction.user.id;
  const isAdmin = interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
  return isOwner || isAdmin;
}

async function getGuildData(guildId) {
  try {
    if (!db) return { guildId, ...DEFAULT_GUILD_DATA };
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

// 📌 COMANDOS SLASH OFICIAIS
const commands = [
  new SlashCommandBuilder()
    .setName('boas-vindas')
    .setDescription('Abre o painel interativo de configurações de boas-vindas, saída e cargos.'),
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Envia o painel oficial de atendimento por tickets.')
];

client.once(Events.ClientReady, async () => {
  console.log('==================================================');
  console.log(`🤖 BOT ONLINE NA DISCLOUD: ${client.user.tag} (ID: ${client.user.id})`);

  const cleanClientId = process.env.CLIENT_ID ? process.env.CLIENT_ID.trim() : client.user.id;
  const cleanToken = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim() : null;

  if (cleanToken) {
    const rest = new REST({ version: '10' }).setToken(cleanToken);
    try {
      await rest.put(Routes.applicationCommands(cleanClientId), { body: commands });
      console.log('✅ [SLASH] Comandos limpos e registrados com sucesso!');
    } catch (error) {
      console.error('❌ [ERRO REGISTRO SLASH]:', error.message);
    }
  }
  console.log('==================================================');
});

// ==========================================
// BARRA DE NAVEGAÇÃO
// ==========================================

function getWelcomeNavRows(includeHome = true) {
  const row1 = { type: 1, components: [] };

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

function gerarPayloadVisaoGeralBoasVindasV2(guildData) {
  const wChan = guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`Não configurado`';
  const lChan = guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '`Não configurado`';
  const bChan = guildData.boostChannel ? `<#${guildData.boostChannel}>` : '`Não configurado`';
  const iChan = guildData.invitesChannel ? `<#${guildData.invitesChannel}>` : '`Não configurado`';

  const wStatus = (guildData.welcomeActive && guildData.welcomeChannel) ? '🟢 Ativo' : '🔴 Desativado';
  const lStatus = (guildData.leaveActive && guildData.leaveChannel) ? '🟢 Ativo' : '🔴 Desativado';
  const bStatus = (guildData.boostActive && guildData.boostChannel) ? '🟢 Ativo' : '🔴 Desativado';
  const iStatus = (guildData.invitesActive && guildData.invitesChannel) ? '🟢 Ativo' : '🔴 Desativado';

  const roleTexto = guildData.autoRole ? `<@&${guildData.autoRole}>` : '`Nenhum cargo configurado`';

  const textoContent = 
    `# 👋 Sistema de Boas-Vindas\n\n` +
    `Gerencie mensagens de **entrada, saída, boost e convites** do seu servidor.\n\n` +
    `### 📊 Visão Geral\n` +
    `👋 **Entrada:** ${wStatus} • ${wChan}\n` +
    `🚪 **Saída:** ${lStatus} • ${lChan}\n` +
    `🚀 **Boost:** ${bStatus} • ${bChan}\n` +
    `🎟️ **Convites:** ${iStatus} • ${iChan}\n\n` +
    `### 🏷️ Cargos Automáticos\n` +
    `${roleTexto}\n\n` +
    `### 📜 Variáveis Disponíveis\n` +
    `👤 **Usuário:** \`{user}\` • \`{username}\` • \`{displayname}\` • \`{user_id}\`\n` +
    `🏠 **Servidor:** \`{server}\` • \`{server_id}\` • \`{members}\` • \`{member_position}\`\n` +
    `📅 **Datas:** \`{account_age}\` • \`{created_at}\` • \`{joined_at}\`\n` +
    `🚀 **Boost:** \`{boosts}\` • \`{boost_level}\` • \`{user_boosts}\`\n` +
    `👑 **Outros:** \`{owner}\` • \`{owner_id}\` • \`{inviter}\` • \`{invite_code}\``;

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

function gerarPayloadConfigEntradaV2(guildData) {
  const isReady = guildData.welcomeActive && guildData.welcomeChannel;
  const statusStr = isReady ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`Não configurado`';
  const imgStr = (guildData.welcomeImageActive && guildData.welcomeBanner) ? '🟢 Ativada' : '🔴 Desativada';
  const roleStr = guildData.autoRole ? `<@&${guildData.autoRole}>` : '`Nenhum cargo configurado`';

  const textoContent = 
    `# 👋 Configurar Entrada\n\n` +
    `Configure o sistema executado quando um novo membro entrar.\n\n` +
    `### ⚙️ Configuração\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n` +
    `**Imagem:** ${imgStr}\n\n` +
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

function gerarPayloadConfigSaidaV2(guildData) {
  const isReady = guildData.leaveActive && guildData.leaveChannel;
  const statusStr = isReady ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.leaveChannel ? `<#${guildData.leaveChannel}>` : '`Não configurado`';
  const imgStr = (guildData.leaveImageActive && guildData.leaveBanner) ? '🟢 Ativada' : '🔴 Desativada';

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

function gerarPayloadConfigBoostV2(guildData) {
  const isReady = guildData.boostActive && guildData.boostChannel;
  const statusStr = isReady ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.boostChannel ? `<#${guildData.boostChannel}>` : '`Não configurado`';
  const imgStr = guildData.boostImageActive ? '🟢 Ativada' : '🔴 Desativada';

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

function gerarPayloadConfigConvitesV2(guildData) {
  const isReady = guildData.invitesActive && guildData.invitesChannel;
  const statusStr = isReady ? '🟢 Ativado' : '🔴 Desativado';
  const chanStr = guildData.invitesChannel ? `<#${guildData.invitesChannel}>` : '`Não configurado`';

  const textoContent = 
    `# 🎟️ Configurar Convites\n\n` +
    `Configure o sistema de identificação de convites.\n\n` +
    `### 🎟️ Sistema de Convites\n` +
    `**Status:** ${statusStr}\n` +
    `**Canal:** ${chanStr}\n\n` +
    `O sistema tenta identificar qual convite foi utilizado e quem criou o convite.`;

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

function gerarPayloadGerenciarImagensV2(guildData) {
  const wImg = (guildData.welcomeImageActive && guildData.welcomeBanner) ? '🟢 Ativa' : '🔴 Desativada';
  const lImg = (guildData.leaveImageActive && guildData.leaveBanner) ? '🟢 Ativa' : '🔴 Desativada';
  const bImg = guildData.boostImageActive ? '🟢 Ativa' : '🔴 Desativada';

  const textoContent = 
    `# 🖼️ Gerenciar Imagens\n\n` +
    `Ative ou desative os cards personalizados dos sistemas.\n\n` +
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

function gerarPayloadCentralTestesV2(guildData) {
  const textoContent = 
    `# 🧪 Central de Testes\n\n` +
    `Faça testes antes de deixar o sistema funcionando oficialmente.\n\n` +
    `O teste utiliza **você como membro de teste** e substitui automaticamente as variáveis.`;

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

// ==========================================
// CONFIGURAÇÃO DO SISTEMA DE TICKETS
// ==========================================

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

function gerarPayloadGerenciarTiposV2(guildData) {
  const t = guildData.ticketTypes || {};

  return {
    components: [{
      type: 17,
      accent_color: 0x2ecc71,
      components: [
        { type: 10, content: `# 🎟️ Gerenciar Tipos de Ticket\n\nSelecione o tipo que deseja configurar:` },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: 2, custom_id: 'cfgtype_atendimento', label: 'Atendimento', emoji: { name: t.atendimento?.active ? '🟢' : '🔴' } },
            { type: 2, style: 2, custom_id: 'cfgtype_denuncias', label: 'Denúncias', emoji: { name: t.denuncias?.active ? '🟢' : '🔴' } },
            { type: 2, style: 2, custom_id: 'cfgtype_recrutamento', label: 'Recrutamento', emoji: { name: t.recrutamento?.active ? '🟢' : '🔴' } }
          ]
        },
        {
          type: 1,
          components: [
            { type: 2, style: 2, custom_id: 'cfgtype_recursos', label: 'Recursos', emoji: { name: t.recursos?.active ? '🟢' : '🔴' } },
            { type: 2, style: 2, custom_id: 'cfgtype_financeiro', label: 'Financeiro', emoji: { name: t.financeiro?.active ? '🟢' : '🔴' } }
          ]
        },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: 2, custom_id: 'btn_voltar_config_main', label: 'Voltar', emoji: { name: '⬅️' } }
          ]
        }
      ]
    }],
    flags: FLAG_V2
  };
}

function gerarPayloadConfigTipoIndividualV2(guildData, typeKey, subAction = null) {
  const typeObj = guildData.ticketTypes?.[typeKey] || { active: false, category: null, role: null, label: typeKey };
  const catTexto = typeObj.category ? `<#${typeObj.category}>` : '`❌ Não definida`';
  const roleTexto = typeObj.role ? `<@&${typeObj.role}>` : '`❌ Não definido`';
  const statusTexto = typeObj.active ? '🟢 Ativo' : '🔴 Inativo';

  const componentsList = [
    { type: 10, content: `# ⚙️ Configurando ${typeObj.label}\n\n📁 **Categoria**\n${catTexto}\n\n👮 **Cargo suporte**\n${roleTexto}\n\n🔄 **Status**\n${statusTexto}` },
    { type: 14, divider: true, spacing: 1 }
  ];

  if (subAction === 'select_category') {
    componentsList.push(
      {
        type: 1,
        components: [{
          type: 8,
          custom_id: `savecat_${typeKey}`,
          placeholder: '📁 Selecionar Categoria',
          channel_types: [ChannelType.GuildCategory]
        }]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  } else if (subAction === 'select_role') {
    componentsList.push(
      {
        type: 1,
        components: [{
          type: 6,
          custom_id: `saverole_${typeKey}`,
          placeholder: '👮 Selecionar Cargo Suporte'
        }]
      },
      { type: 14, divider: true, spacing: 1 }
    );
  }

  componentsList.push(
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: `btncat_${typeKey}`, label: 'Categoria', emoji: { name: '📁' } },
        { type: 2, style: 2, custom_id: `btnrole_${typeKey}`, label: 'Cargo', emoji: { name: '👮' } }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, style: typeObj.active ? 4 : 3, custom_id: `btntoggle_${typeKey}`, label: 'Ativar / Desativar', emoji: { name: '🔄' } }
      ]
    },
    {
      type: 1,
      components: [
        { type: 2, style: 2, custom_id: 'btn_gerenciar_tipos', label: 'Voltar', emoji: { name: '⬅️' } }
      ]
    }
  );

  return {
    components: [{ type: 17, accent_color: 0x3498db, components: componentsList }],
    flags: FLAG_V2
  };
}

function gerarPayloadCanalTranscricaoV2() {
  return {
    components: [{
      type: 17,
      accent_color: 0x9b59b6,
      components: [
        { type: 10, content: `# 📜 Selecionar canal de Transcrição\n\nEscolha o canal onde as transcrições de tickets serão salvas:` },
        { type: 14, divider: true, spacing: 1 },
        {
          type: 1,
          components: [{
            type: 8,
            custom_id: 'select_log_channel',
            placeholder: '📜 Selecionar canal de Transcrição',
            channel_types: [ChannelType.GuildText]
          }]
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
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let guildData = await getGuildData(interaction.guild.id);
        return interaction.editReply(gerarPayloadVisaoGeralBoasVindasV2(guildData));
      }

      if (interaction.commandName === 'ticket') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Apenas Administradores podem executar este comando.'), flags: MessageFlags.Ephemeral });
        }
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let guildData = await getGuildData(interaction.guild.id);
        await interaction.channel.send(gerarPayloadPainelTicketPublicoV2(guildData));
        return interaction.editReply(gerarPayloadAvisoV2('✅ Painel Enviado', 'Painel oficial de atendimento enviado no canal!', 0x2ecc71));
      }
    }

    let guildData = await getGuildData(interaction.guild.id);

    // 📌 MODAIS
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_edit_welcome') {
        const updated = await updateGuildData(interaction.guild.id, { welcomeMessage: interaction.fields.getTextInputValue('welcome_msg_text') });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_edit_leave') {
        const updated = await updateGuildData(interaction.guild.id, { leaveMessage: interaction.fields.getTextInputValue('leave_msg_text') });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_edit_boost') {
        const updated = await updateGuildData(interaction.guild.id, { boostMessage: interaction.fields.getTextInputValue('boost_msg_text') });
        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (interaction.customId === 'modal_config_welcome_image') {
        const rawBanner = interaction.fields.getTextInputValue('welcome_banner_url');
        const updated = await updateGuildData(interaction.guild.id, { welcomeBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_config_leave_image') {
        const rawBanner = interaction.fields.getTextInputValue('leave_banner_url');
        const updated = await updateGuildData(interaction.guild.id, { leaveBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (interaction.customId === 'modal_editar_embed_ticket') {
        const title = interaction.fields.getTextInputValue('input_ticket_title');
        const description = interaction.fields.getTextInputValue('input_ticket_desc');
        const color = interaction.fields.getTextInputValue('input_ticket_color');
        const image = interaction.fields.getTextInputValue('input_ticket_image');
        const footer = interaction.fields.getTextInputValue('input_ticket_footer');

        const updated = await updateGuildData(interaction.guild.id, {
          ticketTitle: title,
          ticketDescription: description,
          ticketColor: color && color.trim() !== '' ? color.trim() : '#5865F2',
          ticketBanner: image && image.trim() !== '' ? image.trim() : null,
          ticketFooter: footer && footer.trim() !== '' ? footer.trim() : '🤖 Organizações • Roleplay | Desenvolvido por Cetus'
        });

        try {
          await interaction.message.edit(gerarPayloadPainelTicketPublicoV2(updated || guildData));
        } catch (e) {}

        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Painel Atualizado', 'As alterações do painel de ticket foram salvas com sucesso!', 0x2ecc71), flags: MessageFlags.Ephemeral });
      }
    }

    // 📌 BOTÕES DE NAVEGAÇÃO
    if (interaction.isButton()) {
      const cid = interaction.customId;

      if (cid === 'btn_config_ticket_main' || cid === 'btn_voltar_config_main') {
        if (!isDonoOuAdmin(interaction)) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Acesso Negado', 'Apenas administradores podem configurar o ticket.'), flags: MessageFlags.Ephemeral });
        }
        return interaction.isUpdate ? interaction.update(gerarPayloadConfigSistemaTicketsV2()) : interaction.reply({ ...gerarPayloadConfigSistemaTicketsV2(), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_gerenciar_tipos') {
        return interaction.update(gerarPayloadGerenciarTiposV2(guildData));
      }

      if (cid === 'btn_canal_transcricao') {
        return interaction.update(gerarPayloadCanalTranscricaoV2());
      }

      if (cid.startsWith('cfgtype_')) {
        const key = cid.replace('cfgtype_', '');
        return interaction.update(gerarPayloadConfigTipoIndividualV2(guildData, key));
      }

      if (cid.startsWith('btncat_')) {
        const key = cid.replace('btncat_', '');
        return interaction.update(gerarPayloadConfigTipoIndividualV2(guildData, key, 'select_category'));
      }

      if (cid.startsWith('btnrole_')) {
        const key = cid.replace('btnrole_', '');
        return interaction.update(gerarPayloadConfigTipoIndividualV2(guildData, key, 'select_role'));
      }

      if (cid.startsWith('btntoggle_')) {
        const key = cid.replace('btntoggle_', '');
        const currentActive = guildData.ticketTypes?.[key]?.active || false;

        const updatedTypes = {
          ...guildData.ticketTypes,
          [key]: {
            ...DEFAULT_GUILD_DATA.ticketTypes[key],
            ...(guildData.ticketTypes?.[key] || {}),
            active: !currentActive
          }
        };

        const updated = await updateGuildData(interaction.guild.id, { ticketTypes: updatedTypes });
        return interaction.update(gerarPayloadConfigTipoIndividualV2(updated || guildData, key));
      }

      if (cid === 'btn_editar_embed_ticket') {
        const modal = new ModalBuilder().setCustomId('modal_editar_embed_ticket').setTitle('Editar Painel do Ticket');
        
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_ticket_title').setLabel('Título').setStyle(TextInputStyle.Short).setValue(guildData.ticketTitle || '').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_ticket_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(guildData.ticketDescription || '').setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_ticket_color').setLabel('Cor (HEX)').setStyle(TextInputStyle.Short).setValue(guildData.ticketColor || '#5865F2').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_ticket_image').setLabel('Imagem (URL)').setStyle(TextInputStyle.Short).setValue(guildData.ticketBanner || '').setRequired(false)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_ticket_footer').setLabel('Footer (Texto do Rodapé)').setStyle(TextInputStyle.Short).setValue(guildData.ticketFooter || '').setRequired(false))
        );

        return interaction.showModal(modal);
      }

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
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.welcomeMessage || '').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Editar Mensagem de Saída');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.leaveMessage || '').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_edit_boost_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_boost').setTitle('Editar Mensagem de Boost');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('boost_msg_text').setLabel('Texto da Mensagem').setStyle(TextInputStyle.Paragraph).setValue(guildData.boostMessage || '').setRequired(true)));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_config_welcome_image') {
        const modal = new ModalBuilder().setCustomId('modal_config_welcome_image').setTitle('Configurar Imagem Entrada');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Imgur)').setStyle(TextInputStyle.Short).setValue(guildData.welcomeBanner || '').setRequired(false)));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_config_leave_image') {
        const modal = new ModalBuilder().setCustomId('modal_config_leave_image').setTitle('Configurar Imagem Saída');
        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Imgur)').setStyle(TextInputStyle.Short).setValue(guildData.leaveBanner || '').setRequired(false)));
        return interaction.showModal(modal);
      }

      if (cid === 'btn_testar_entrada') {
        client.emit('guildMemberAdd', interaction.member);
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste Disparado', 'Mensagem de entrada simulada com sucesso!', 0x2ecc71), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_testar_saida') {
        client.emit('guildMemberRemove', interaction.member);
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste Disparado', 'Mensagem de saída simulada com sucesso!', 0xed4245), flags: MessageFlags.Ephemeral });
      }

      if (cid === 'btn_testar_boost') {
        return interaction.reply({ ...gerarPayloadAvisoV2('🧪 Teste Disparado', 'Mensagem de boost simulada com sucesso!', 0x5865f2), flags: MessageFlags.Ephemeral });
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

    // 📌 SELETORES DE STRING (CATEGORIA TICKET PÚBLICO)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_categoria_ticket_publico') {
        const val = interaction.values[0];
        const key = val.replace('tipo_', '');
        const typeObj = guildData.ticketTypes?.[key];

        if (!typeObj || !typeObj.category) {
          return interaction.reply({ ...gerarPayloadAvisoV2('❌ Categoria Não Configurada', 'A categoria deste tipo de ticket ainda não foi configurada pelo administrador.'), flags: MessageFlags.Ephemeral });
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

        if (typeObj.role) {
          permissionOverwrites.push({
            id: typeObj.role,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
          });
        }

        const channel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: typeObj.category,
          permissionOverwrites
        });

        const payloadTicketTicket = {
          components: [{
            type: 17,
            accent_color: 0x3498db,
            components: [
              { type: 10, content: `# 🎟️ Ticket de ${interaction.user.username}\n\n📌 **Categoria:** \`${typeObj.label}\`\n👋 Olá ${interaction.user}, descreva sua solicitação no chat. Nossa equipe irá te atender em breve!` },
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
        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Ticket Criado', `Seu ticket de **${typeObj.label}** foi aberto em ${channel}`, 0x2ecc71), flags: MessageFlags.Ephemeral });
      }
    }

    // 📌 SELETORES DE CANAL E CARGO
    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      const cid = interaction.customId;

      if (cid.startsWith('savecat_')) {
        const key = cid.replace('savecat_', '');
        const updatedTypes = {
          ...guildData.ticketTypes,
          [key]: {
            ...DEFAULT_GUILD_DATA.ticketTypes[key],
            ...(guildData.ticketTypes?.[key] || {}),
            category: val
          }
        };

        const updated = await updateGuildData(interaction.guild.id, { ticketTypes: updatedTypes });
        return interaction.update(gerarPayloadConfigTipoIndividualV2(updated || guildData, key));
      }

      if (cid === 'select_welcome_channel') {
        const updated = await updateGuildData(interaction.guild.id, { welcomeChannel: val, welcomeActive: true });
        return interaction.update(gerarPayloadConfigEntradaV2(updated || guildData));
      }

      if (cid === 'select_leave_channel') {
        const updated = await updateGuildData(interaction.guild.id, { leaveChannel: val, leaveActive: true });
        return interaction.update(gerarPayloadConfigSaidaV2(updated || guildData));
      }

      if (cid === 'select_boost_channel') {
        const updated = await updateGuildData(interaction.guild.id, { boostChannel: val, boostActive: true });
        return interaction.update(gerarPayloadConfigBoostV2(updated || guildData));
      }

      if (cid === 'select_invites_channel') {
        const updated = await updateGuildData(interaction.guild.id, { invitesChannel: val, invitesActive: true });
        return interaction.update(gerarPayloadConfigConvitesV2(updated || guildData));
      }

      if (cid === 'select_log_channel') {
        await updateGuildData(interaction.guild.id, { logChannel: val });
        return interaction.reply({ ...gerarPayloadAvisoV2('✅ Canal Salvo', `Canal de Transcrição/Logs definido para <#${val}>!`, 0x2ecc71), flags: MessageFlags.Ephemeral });
      }
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      const cid = interaction.customId;

      if (cid.startsWith('saverole_')) {
        const key = cid.replace('saverole_', '');
        const updatedTypes = {
          ...guildData.ticketTypes,
          [key]: {
            ...DEFAULT_GUILD_DATA.ticketTypes[key],
            ...(guildData.ticketTypes?.[key] || {}),
            role: val
          }
        };

        const updated = await updateGuildData(interaction.guild.id, { ticketTypes: updatedTypes });
        return interaction.update(gerarPayloadConfigTipoIndividualV2(updated || guildData, key));
      }

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
// EVENTOS AUTOMÁTICOS
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
  if (!guildData) return;

  if (guildData.autoRole) {
    await member.roles.add(guildData.autoRole).catch(() => {});
  }

  if (guildData.welcomeActive && guildData.welcomeChannel) {
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
  if (!guildData || !guildData.leaveActive || !guildData.leaveChannel) return;

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
});

client.login(process.env.DISCORD_TOKEN);
