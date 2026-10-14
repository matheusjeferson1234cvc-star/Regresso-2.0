const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ChannelSelectMenuBuilder, 
  RoleSelectMenuBuilder, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  EmbedBuilder, 
  PermissionFlagsBits 
} = require('discord.js');

console.log('[DIAGNÓSTICO] Carregando dependências e iniciando cliente...');

// 1. CAPTURA GLOBAL DE ERROS (Impede travamentos silenciosos na Discloud)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERRO NÃO TRATADO]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[EXCEÇÃO NÃO CAPTURADA]', error);
});

// 2. INICIALIZAÇÃO DO CLIENT COM INTENÇÕES CORRETAS
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// 3. ESTRUTURA DE CONFIGURAÇÃO TEMPORÁRIA
const config = {
  welcomeChannel: null,
  exitChannel: null,
  autoRole: null,
  ticketCategory: null,
  userSelectedChannel: null
};

// 4. EVENTO READY (CONFIRMAÇÃO DE CONEXÃO)
client.once('ready', () => {
  console.log(`[ONLINE] Bot conectado com sucesso como: ${client.user.tag}`);
});

// 5. EVENTOS DE ENTRADA/SAÍDA DE MEMBROS
client.on('guildMemberAdd', async (member) => {
  try {
    if (config.autoRole) {
      const role = member.guild.roles.cache.get(config.autoRole);
      if (role) await member.roles.add(role);
    }
    if (config.welcomeChannel) {
      const channel = member.guild.channels.cache.get(config.welcomeChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('Boas-Vindas!')
          .setDescription(`Olá ${member}, seja bem-vindo(a) ao **${member.guild.name}**!`)
          .setColor('#00FF00')
          .setThumbnail(member.user.displayAvatarURL());
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('Erro no evento guildMemberAdd:', err);
  }
});

client.on('guildMemberRemove', async (member) => {
  try {
    if (config.exitChannel) {
      const channel = member.guild.channels.cache.get(config.exitChannel);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('Até mais!')
          .setDescription(`${member.user.tag} saiu do servidor.`)
          .setColor('#FF0000');
        await channel.send({ embeds: [embed] });
      }
    }
  } catch (err) {
    console.error('Erro no evento guildMemberRemove:', err);
  }
});

// 6. AUTENTICAÇÃO E LOGIN (Puxando a variável DISCORD_TOK)
console.log('[DIAGNÓSTICO] Tentando efetuar o login com a variável de ambiente...');

client.login(process.env.DISCORD_TOK).catch(err => {
  console.error('[ERRO DE LOGIN] Falha ao autenticar o bot:', err.message);
});
