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
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder
} = require('discord.js');

console.log('[DIAGNÓSTICO] CarregANDO dependências e iniciando cliente...');

// 1. CAPTURA GLOBAL DE ERROS (Impede travamentos silenciosos)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[ERRO NÃO TRATADO]', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[EXCEÇÃO NÃO CAPTURADA]', error);
});

// 2. INICIALIZAÇÃO DO CLIENT
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

// DEFINIÇÃO DOS COMANDOS EM BARRA (SLASH COMMANDS)
const commands = [
  new SlashCommandBuilder()
    .setName('painel-administrativo')
    .setDescription('Abre o painel de configuração do servidor'),
  new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Configura o sistema de tickets')
].map(command => command.toJSON());

// 4. EVENTO READY + REGISTRO DOS COMANDOS EM BARRA NO DISCORD
client.once('ready', async () => {
  console.log(`[ONLINE] Bot conectado com sucesso como: ${client.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOK);
    console.log('[DIAGNÓSTICO] Registrando comandos em barra (Slash Commands)...');

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('[SUCESSO] Comandos em barra registrados globalmente com sucesso!');
  } catch (error) {
    console.error('[ERRO REGISTRO COMANDOS]', error);
  }
});

// 5. EVENTOS DE ENTRADA/SAÍDA DE MEMBROS (AUTOROLE E BOAS-VINDAS)
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

// 6. PROCESSAMENTO DE INTERAÇÕES (COMANDOS EM BARRA, MENUS E BOTÕES)
client.on('interactionCreate', async (interaction) => {
  try {
    // Trata os Comandos em Barra
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === 'painel-administrativo') {
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('menu_painel')
            .setPlaceholder('Selecione uma opção de configuração...')
            .addOptions([
              { label: 'Canal de Boas-Vindas', value: 'set_welcome', description: 'Define o canal de boas-vindas' },
              { label: 'Canal de Saída', value: 'set_exit', description: 'Define o canal de saída' },
              { label: 'Cargo Automático', value: 'set_autorole', description: 'Define o cargo para novos membros' }
            ])
        );

        const embed = new EmbedBuilder()
          .setTitle('Painel Administrativo')
          .setDescription('Selecione uma opção abaixo para configurar:')
          .setColor('#5865F2');

        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }

      if (commandName === 'setup-ticket') {
        return interaction.reply({ content: 'Sistema de tickets em desenvolvimento!', ephemeral: true });
      }
    }

    // Trata Seleção de Menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'menu_painel') {
        const selected = interaction.values[0];

        if (selected === 'set_welcome') {
          const row = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('select_welcome_channel')
              .setPlaceholder('Escolha o canal de boas-vindas')
              .addChannelTypes(ChannelType.GuildText)
          );
          return interaction.reply({ content: 'Selecione o canal de boas-vindas:', components: [row], ephemeral: true });
        }

        if (selected === 'set_exit') {
          const row = new ActionRowBuilder().addComponents(
            new ChannelSelectMenuBuilder()
              .setCustomId('select_exit_channel')
              .setPlaceholder('Escolha o canal de saída')
              .addChannelTypes(ChannelType.GuildText)
          );
          return interaction.reply({ content: 'Selecione o canal de saída:', components: [row], ephemeral: true });
        }

        if (selected === 'set_autorole') {
          const row = new ActionRowBuilder().addComponents(
            new RoleSelectMenuBuilder()
              .setCustomId('select_auto_role')
              .setPlaceholder('Escolha o cargo automático')
          );
          return interaction.reply({ content: 'Selecione o cargo para novos membros:', components: [row], ephemeral: true });
        }
      }
    }

    // Trata Escolha de Canais
    if (interaction.isChannelSelectMenu()) {
      if (interaction.customId === 'select_welcome_channel') {
        config.welcomeChannel = interaction.values[0];
        return interaction.reply({ content: `Canal de boas-vindas configurado para <#${config.welcomeChannel}>.`, ephemeral: true });
      }
      if (interaction.customId === 'select_exit_channel') {
        config.exitChannel = interaction.values[0];
        return interaction.reply({ content: `Canal de saída configurado para <#${config.exitChannel}>.`, ephemeral: true });
      }
    }

    // Trata Escolha de Cargos (AutoRole)
    if (interaction.isRoleSelectMenu()) {
      if (interaction.customId === 'select_auto_role') {
        config.autoRole = interaction.values[0];
        return interaction.reply({ content: `Cargo automático configurado para <@&${config.autoRole}>.`, ephemeral: true });
      }
    }
  } catch (err) {
    console.error('Erro ao processar interação:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Ocorreu um erro ao executar este comando.', ephemeral: true });
    }
  }
});

// 7. LOGIN USANDO A VARIÁVEL DE AMBIENTE
client.login(process.env.DISCORD_TOK).catch(err => {
  console.error('[ERRO DE LOGIN] Falha ao autenticar o bot:', err.message);
});
