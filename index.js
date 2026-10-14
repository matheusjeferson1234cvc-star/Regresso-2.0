const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
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

// Instância do Bot com Intents completas
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

// Estrutura do Banco de Dados
const db = {
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  leaveChannel: null,
  leaveMessage: 'O membro **{user}** saiu do servidor.',
  leaveBanner: null,
  autoRole: null,
  ticketCategory: null,
  logChannel: null
};

// ==========================================
// REGISTRO DE COMANDOS SLASH (/cv e /painel)
// ==========================================
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo de configurações do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar e enviar uma embed personalizada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);
  console.log(`[VERSÃO] Atualização v15 ativa.`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
  try {
    console.log('[SLASH] Registrando comandos na API do Discord...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('[SLASH] Comandos globais registrados!');
  } catch (error) {
    console.error('[ERRO] Falha ao registrar comandos:', error);
  }
});

// ==========================================
// FUNÇÕES AUXILIARES DE INTERFACE (PAINEL)
// ==========================================
function buildPainelEmbed(guild) {
  const welcomeStatus = db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Desativado`';
  const autoRoleStatus = db.autoRole ? `<@&${db.autoRole}>` : '`❌ Desativado`';
  const leaveStatus = db.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Desativado`';
  const leaveBannerStatus = db.leaveBanner ? '`✅ Imagem Configurada`' : '`❌ Sem Imagem`';
  const ticketStatus = db.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`';
  const logStatus = db.logChannel ? `<#${db.logChannel}>` : '`❌ Desativado`';

  return new EmbedBuilder()
    .setAuthor({ 
      name: `Painel de Controle | ${guild.name}`, 
      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
    })
    .setTitle('⚙️ Central de Configurações Administrativas')
    .setDescription(
      'Bem-vindo ao painel central da **v15**. Utilize os botões abaixo para configurar os canais, cargos e mensagens de cada sistema interativo do seu servidor.'
    )
    .addFields(
      { 
        name: '👋 Boas-Vindas & AutoRole', 
        value: `• Canal: ${welcomeStatus}\n• Cargo Automático: ${autoRoleStatus}`, 
        inline: false 
      },
      { 
        name: '🚪 Sistema de Saída', 
        value: `• Canal: ${leaveStatus}\n• Banner: ${leaveBannerStatus}`, 
        inline: false 
      },
      { 
        name: '🎟️ Central de Tickets', 
        value: `• Categoria Categoria: ${ticketStatus}`, 
        inline: false 
      },
      { 
        name: '📜 Logs Gerais & Banimentos', 
        value: `• Canal de Registros: ${logStatus}`, 
        inline: false 
      }
    )
    .setColor('#2F3136')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Green Otimizações • Sistema de Gestão v15', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_welcome')
      .setLabel('Boas-Vindas & AutoRole')
      .setEmoji('👋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_leave')
      .setLabel('Sistema de Saída')
      .setEmoji('🚪')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_tickets')
      .setLabel('Configurar Tickets')
      .setEmoji('🎟️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_logs')
      .setLabel('Logs & Banimentos')
      .setEmoji('📜')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

// ==========================================
// MANIPULAÇÃO GLOBAL DE INTERAÇÕES
// ==========================================
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. COMANDOS SLASH
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'painel') {
        const embed = buildPainelEmbed(interaction.guild);
        const components = buildPainelButtons();
        return interaction.reply({ embeds: [embed], components, ephemeral: true });
      }

      if (interaction.commandName === 'cv') {
        const modal = new ModalBuilder()
          .setCustomId('modal_cv')
          .setTitle('🎨 Criar Embed Personalizada');

        const inputTitle = new TextInputBuilder()
          .setCustomId('cv_title')
          .setLabel('Título da Embed')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Regras da Comunidade')
          .setRequired(true);

        const inputDesc = new TextInputBuilder()
          .setCustomId('cv_description')
          .setLabel('Descrição da Embed')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escreva a mensagem aqui...')
          .setRequired(true);

        const inputImage = new TextInputBuilder()
          .setCustomId('cv_image')
          .setLabel('URL da Imagem / Banner (Opcional)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('https://i.imgur.com/exemplo.png')
          .setRequired(false);

        const inputColor = new TextInputBuilder()
          .setCustomId('cv_color')
          .setLabel('Cor Hexadecimal (Ex: #00FF00)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('#2F3136')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(inputTitle),
          new ActionRowBuilder().addComponents(inputDesc),
          new ActionRowBuilder().addComponents(inputImage),
          new ActionRowBuilder().addComponents(inputColor)
        );

        return interaction.showModal(modal);
      }
    }

    // 2. MODAIS (SUBMIT)
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
        return interaction.reply({ content: '✅ Embed enviada com sucesso neste canal!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_welcome') {
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = interaction.fields.getTextInputValue('welcome_banner_url') || null;
        return interaction.reply({ content: '✨ Mensagem e Banner de **Boas-Vindas** atualizados com sucesso!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_leave') {
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = interaction.fields.getTextInputValue('leave_banner_url') || null;
        return interaction.reply({ content: '✨ Mensagem e Banner de **Saída** atualizados com sucesso!', ephemeral: true });
      }
    }

    // 3. BOTÕES DO PAINEL
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_welcome') {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_welcome_channel')
          .setPlaceholder('📌 Selecione o canal de boas-vindas')
          .addChannelTypes(ChannelType.GuildText);

        const roleSelect = new RoleSelectMenuBuilder()
          .setCustomId('select_autorole')
          .setPlaceholder('🎭 Selecione o cargo automático (AutoRole)');

        const btnEditMsg = new ButtonBuilder()
          .setCustomId('btn_edit_welcome_msg')
          .setLabel('Editar Mensagem & Banner')
          .setEmoji('✍️')
          .setStyle(ButtonStyle.Secondary);

        return interaction.reply({
          content: '⚙️ **Configuração de Boas-Vindas & AutoRole:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(btnEditMsg)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_welcome')
          .setTitle('Configurar Boas-Vindas');

        const msgInput = new TextInputBuilder()
          .setCustomId('welcome_msg_text')
          .setLabel('Texto da Mensagem ({user} e {server})')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(db.welcomeMessage)
          .setRequired(true);

        const bannerInput = new TextInputBuilder()
          .setCustomId('welcome_banner_url')
          .setLabel('URL da Imagem / Banner (Opcional)')
          .setStyle(TextInputStyle.Short)
          .setValue(db.welcomeBanner || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(msgInput),
          new ActionRowBuilder().addComponents(bannerInput)
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_leave') {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_leave_channel')
          .setPlaceholder('📌 Selecione o canal de saída')
          .addChannelTypes(ChannelType.GuildText);

        const btnEditMsg = new ButtonBuilder()
          .setCustomId('btn_edit_leave_msg')
          .setLabel('Editar Mensagem & Banner')
          .setEmoji('✍️')
          .setStyle(ButtonStyle.Secondary);

        return interaction.reply({
          content: '⚙️ **Configuração do Sistema de Saída:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(btnEditMsg)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_leave')
          .setTitle('Configurar Mensagem de Saída');

        const msgInput = new TextInputBuilder()
          .setCustomId('leave_msg_text')
          .setLabel('Texto da Mensagem ({user} e {server})')
          .setStyle(TextInputStyle.Paragraph)
          .setValue(db.leaveMessage)
          .setRequired(true);

        const bannerInput = new TextInputBuilder()
          .setCustomId('leave_banner_url')
          .setLabel('URL da Imagem / Banner (Opcional)')
          .setStyle(TextInputStyle.Short)
          .setValue(db.leaveBanner || '')
          .setRequired(false);

        modal.addComponents(
          new ActionRowBuilder().addComponents(msgInput),
          new ActionRowBuilder().addComponents(bannerInput)
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        const categorySelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_ticket_category')
          .setPlaceholder('📁 Selecione a categoria para criar tickets')
          .addChannelTypes(ChannelType.GuildCategory);

        return interaction.reply({
          content: '⚙️ **Configuração do Sistema de Tickets:**',
          components: [new ActionRowBuilder().addComponents(categorySelect)],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_logs') {
        const channelSelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_log_channel')
          .setPlaceholder('📜 Selecione o canal de logs gerais')
          .addChannelTypes(ChannelType.GuildText);

        return interaction.reply({
          content: '⚙️ **Configuração de Logs e Banimentos:**',
          components: [new ActionRowBuilder().addComponents(channelSelect)],
          ephemeral: true
        });
      }
    }

    // 4. MENUS SELETORES (SELECT MENUS)
    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = value;
        return interaction.update({ content: `✅ Canal de Boas-Vindas alterado para: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_autorole') {
        db.autoRole = value;
        return interaction.update({ content: `✅ Cargo de AutoRole alterado para: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_leave_channel') {
        db.leaveChannel = value;
        return interaction.update({ content: `✅ Canal de Saída alterado para: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_category') {
        db.ticketCategory = value;
        return interaction.update({ content: `✅ Categoria de Tickets definida para: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_log_channel') {
        db.logChannel = value;
        return interaction.update({ content: `✅ Canal de Logs e Banimentos alterado para: <#${value}>`, components: [] });
      }
    }
  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// ==========================================
// HANDLERS DE EVENTOS (MEMBROS, LOGS, BANS)
// ==========================================

// Entrada de Membro
client.on('guildMemberAdd', async (member) => {
  // Executa AutoRole
  if (db.autoRole) {
    try {
      await member.roles.add(db.autoRole);
    } catch (err) {
      console.error('[ERRO AUTOROLE]: Não foi possível atribuir o cargo.', err);
    }
  }

  // Executa Boas-Vindas
  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = db.welcomeMessage
        .replace(/{user}/g, `${member}`)
        .replace(/{server}/g, member.guild.name);

      const embed = new EmbedBuilder()
        .setTitle('👋 Seja Bem-vindo(a)!')
        .setDescription(text)
        .setColor('#57F287')
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      if (db.welcomeBanner && (db.welcomeBanner.startsWith('http://') || db.welcomeBanner.startsWith('https://'))) {
        embed.setImage(db.welcomeBanner);
      }

      channel.send({ embeds: [embed] }).catch(console.error);
    }
  }
});

// Saída de Membro
client.on('guildMemberRemove', async (member) => {
  if (db.leaveChannel) {
    const channel = member.guild.channels.cache.get(db.leaveChannel);
    if (channel) {
      const text = db.leaveMessage
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name);

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(text)
        .setColor('#ED4245')
        .setTimestamp();

      if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
        embed.setImage(db.leaveBanner);
      }

      channel.send({ embeds: [embed] }).catch(console.error);
    }
  }
});

// Log: Mensagem Deletada
client.on('messageDelete', (message) => {
  if (message.author?.bot || !db.logChannel) return;
  const logChannel = message.guild?.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Mensagem Deletada')
    .addFields(
      { name: 'Autor', value: `${message.author.tag} (\`${message.author.id}\`)`, inline: true },
      { name: 'Canal', value: `<#${message.channel.id}>`, inline: true },
      { name: 'Conteúdo', value: message.content ? `\`\`\`${message.content}\`\`\`` : '*Sem texto*' }
    )
    .setColor('#ED4245')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

// Log: Mensagem Editada
client.on('messageUpdate', (oldMessage, newMessage) => {
  if (oldMessage.author?.bot || !db.logChannel) return;
  if (oldMessage.content === newMessage.content) return;
  const logChannel = oldMessage.guild?.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('✏️ Mensagem Editada')
    .addFields(
      { name: 'Autor', value: `${oldMessage.author.tag} (\`${oldMessage.author.id}\`)`, inline: true },
      { name: 'Canal', value: `<#${oldMessage.channel.id}>`, inline: true },
      { name: 'Antes', value: `\`\`\`${oldMessage.content || 'Vazio'}\`\`\`` },
      { name: 'Depois', value: `\`\`\`${newMessage.content || 'Vazio'}\`\`\`` }
    )
    .setColor('#FEE75C')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

// Log: Membro Banido
client.on('guildBanAdd', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔨 Membro Banido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi banido do servidor.`)
    .setColor('#5865F2')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

// Log: Membro Desbanido
client.on('guildBanRemove', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔓 Membro Desbanido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi desbanido do servidor.`)
    .setColor('#57F287')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

// ==========================================
// CAPTURA GLOBAL DE ERROS (process.on)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  console.error('[SISTEMA Error Handler] Rejeição não tratada em:', promise, 'Motivo:', reason);
});

process.on('uncaughtException', (error, origin) => {
  console.error('[SISTEMA Error Handler] Exceção não tratada:', error, 'Origem:', origin);
});

// Login do Bot
client.login(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
