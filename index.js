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
const admin = require('firebase-admin');

// 📌 INICIALIZAÇÃO DO FIREBASE (Lê GOOGLE_APPLICATION_CREDENTIALS da Discloud)
try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
  console.log('[BANCO] Firebase Admin inicializado com sucesso!');
} catch (error) {
  console.error('[ERRO FIREBASE]:', error.message);
}

const db = admin.firestore();

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

// 📌 FUNÇÃO PARA OBTER / CRIAR CONFIGURAÇÕES NO FIRESTORE
async function getGuildData(guildId) {
  try {
    const docRef = db.collection('guilds').doc(guildId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      const defaultData = {
        guildId,
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
        ticketCategories: [
          { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Tire suas dúvidas com a equipe.', emoji: '❓' },
          { id: 'cat_suporte', label: 'Suporte Técnico', description: 'Atendimento e suporte técnico.', emoji: '🛠️' }
        ],
        logChannel: null
      };
      await docRef.set(defaultData);
      return defaultData;
    }

    return docSnap.data();
  } catch (error) {
    console.error('[ERRO FIRESTORE]:', error.message);
    return null;
  }
}

// 📌 FUNÇÃO PARA ATUALIZAR DADOS NO FIRESTORE
async function updateGuildData(guildId, updates) {
  try {
    const docRef = db.collection('guilds').doc(guildId);
    await docRef.update(updates);
    return (await docRef.get()).data();
  } catch (error) {
    console.error('[ERRO ATUALIZAR FIRESTORE]:', error.message);
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

// LISTA COMPLETA DE COMANDOS SLASH
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

// EVENTO READY E REGISTRO DE COMANDOS
client.once(Events.ClientReady, async () => {
  console.log(`[SISTEMA] Bot inicializado com sucesso como ${client.user.tag}`);

  if (process.env.DISCORD_TOKEN) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      const guilds = client.guilds.cache.map(g => g.id);
      
      if (guilds.length > 0) {
        for (const guildId of guilds) {
          await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), { body: commands });
          console.log(`[SLASH] Comandos atualizados INSTANTANEAMENTE no servidor ID: ${guildId}`);
        }
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('[SLASH] Comandos globais registrados no Discord.');
      }
    } catch (error) {
      console.error('[ERRO REGISTRO SLASH]:', error);
    }
  }
});

function buildPainelEmbed(guild, guildData) {
  const themeColor = guildData?.themeColor && guildData.themeColor.startsWith('#') ? guildData.themeColor : '#2F3136';

  return new EmbedBuilder()
    .setAuthor({ name: `GESTAO • ${guild.name.toUpperCase()}`, iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() })
    .setTitle('⚙️ Central de Configurações Administrativas')
    .setDescription(`Gerencie os módulos do bot através das opções abaixo:\n\n**Status Banco:** 🟢 \`Sincronizado (Firebase Firestore)\``)
    .addFields(
      { name: '🎨 Cor do Tema', value: `\`${themeColor}\``, inline: true },
      { name: '👋 Boas-Vindas & AutoRole', value: `├ Canal: ${guildData?.welcomeChannel ? `<#${guildData.welcomeChannel}>` : '`❌ Desativado`'}\n└ Cargo: ${guildData?.autoRole ? `<@&${guildData.autoRole}>` : '`❌ Desativado`'}`, inline: true },
      { name: '🚪 Sistema de Saída', value: `├ Canal: ${guildData?.leaveChannel ? `<#${guildData.leaveChannel}>` : '`❌ Desativado`'}\n└ Banner: ${guildData?.leaveBanner ? '`✅ Configurado`' : '`❌ Sem Banner`'}`, inline: true },
      { name: '🎟️ Central de Tickets', value: `├ Canal Envio: ${guildData?.ticketChannel ? `<#${guildData.ticketChannel}>` : '`❌ Não definido`'}\n├ Categoria: ${guildData?.ticketCategory ? `<#${guildData.ticketCategory}>` : '`❌ Não definida`'}\n└ Atendentes: ${guildData?.ticketSupportRole ? `<@&${guildData.ticketSupportRole}>` : '`❌ Não definido`'}`, inline: false },
      { name: '📜 Logs Gerais & Transcrições', value: `└ Canal: ${guildData?.logChannel ? `<#${guildData.logChannel}>` : '`❌ Desativado`'}`, inline: false }
    )
    .setColor(themeColor)
    .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
    .setFooter({ text: `${client.user.username} • Sincronizado com Firebase Firestore`, iconURL: client.user.displayAvatarURL() })
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

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.guild) return;

    // 📌 PROCESSAMENTO DOS COMANDOS SLASH
    if (interaction.isChatInputCommand()) {

      // 1. Comando /cv (Exibe modal sem atraso prévio)
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

      // 2. Comando /painel
      if (interaction.commandName === 'painel') {
        await interaction.deferReply({ ephemeral: true });
        let guildData = await getGuildData(interaction.guild.id);
        if (!guildData) return interaction.editReply({ content: '❌ Erro ao conectar ao Firebase Firestore.' });

        return interaction.editReply({ embeds: [buildPainelEmbed(interaction.guild, guildData)], components: buildPainelButtons() });
      }

      // 3. Comando /ban
      if (interaction.commandName === 'ban') {
        const targetUser = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Nenhum motivo informado.';

        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        if (!member) return interaction.reply({ content: '❌ O usuário informado não está no servidor.', ephemeral: true });
        if (!member.bannable) return interaction.reply({ content: '❌ Não tenho permissão para banir este membro.', ephemeral: true });

        await member.ban({ reason: `${reason} \vert{} Por:${interaction.user.tag}` });

        let guildData = await getGuildData(interaction.guild.id);
        if (guildData?.logChannel) {
          const logChan = interaction.guild.channels.cache.get(guildData.logChannel);
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

      // 4. Comando /lock
      if (interaction.commandName === 'lock') {
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
          return interaction.reply({ content: '🔒 **Canal trancado pela moderação.**' });
        } catch (err) {
          return interaction.reply({ content: '❌ Falha ao trancar o canal. Verifique se o bot possui a permissão de "Gerenciar Canais".', ephemeral: true });
        }
      }

      // 5. Comando /unlock
      if (interaction.commandName === 'unlock') {
        try {
          await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: true });
          return interaction.reply({ content: '🔓 **Canal destrancado.**' });
        } catch (err) {
          return interaction.reply({ content: '❌ Falha ao destrancar o canal. Verifique se o bot possui a permissão de "Gerenciar Canais".', ephemeral: true });
        }
      }

      // 6. Comando /clear
      if (interaction.commandName === 'clear') {
        const amount = interaction.options.getInteger('quantidade');
        try {
          const deleted = await interaction.channel.bulkDelete(amount, true);
          return interaction.reply({ content: `🧹 **${deleted.size}** mensagens apagadas.`, ephemeral: true });
        } catch (err) {
          return interaction.reply({ content: '❌ Falha ao apagar mensagens. Lembre-se de que mensagens com mais de 14 dias não podem ser apagadas em massa.', ephemeral: true });
        }
      }
    }

    // 📌 PROCESSAMENTO DAS DEMASIADAS INTERAÇÕES (SUBMIT DE MODAIS, BOTÕES E MENUS)
    let guildData = await getGuildData(interaction.guild.id);
    if (!guildData) return interaction.reply({ content: '❌ Erro ao conectar ao Firebase Firestore.', ephemeral: true });

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
        const updated = await updateGuildData(interaction.guild.id, {
          welcomeMessage: interaction.fields.getTextInputValue('welcome_msg_text'),
          welcomeBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updated)], components: buildPainelButtons() });
      }

      if (interaction.customId === 'modal_edit_leave') {
        const rawBanner = interaction.fields.getTextInputValue('leave_banner_url');
        const updated = await updateGuildData(interaction.guild.id, {
          leaveMessage: interaction.fields.getTextInputValue('leave_msg_text'),
          leaveBanner: rawBanner && rawBanner.trim() !== '' ? rawBanner.trim() : null
        });

        return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updated)], components: buildPainelButtons() });
      }
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'btn_refresh_panel') {
        const updatedData = await getGuildData(interaction.guild.id);
        await interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updatedData)], components: buildPainelButtons() });
        return interaction.followUp({ content: '🔄 **Painel sincronizado com o Firebase Firestore!**', ephemeral: true });
      }

      if (interaction.customId === 'btn_welcome') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_welcome_channel').setPlaceholder('📌 Selecione o canal de boas-vindas').addChannelTypes(ChannelType.GuildText);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_autorole').setPlaceholder('🎭 Selecione o cargo automático (AutoRole)');
        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_welcome_msg').setLabel('Editar Mensagem & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, guildData)],
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
        const msgInput = new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(guildData.welcomeMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(guildData.welcomeBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_leave') {
        const channelSelect = new ChannelSelectMenuBuilder().setCustomId('select_leave_channel').setPlaceholder('📌 Selecione o canal de saída').addChannelTypes(ChannelType.GuildText);
        const btnEditMsg = new ButtonBuilder().setCustomId('btn_edit_leave_msg').setLabel('Editar Mensagem & Banner').setEmoji('✍️').setStyle(ButtonStyle.Secondary);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, guildData)],
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(btnEditMsg),
            ...buildPainelButtons()
          ]
        });
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder().setCustomId('modal_edit_leave').setTitle('Configurar Mensagem de Saída');
        const msgInput = new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(guildData.leaveMessage || '').setRequired(true);
        const bannerInput = new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(guildData.leaveBanner || '').setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(msgInput), new ActionRowBuilder().addComponents(bannerInput));
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        const sendChanSelect = new ChannelSelectMenuBuilder().setCustomId('select_ticket_send_channel').setPlaceholder('📢 Selecionar canal onde o painel será enviado').addChannelTypes(ChannelType.GuildText);
        const categorySelect = new ChannelSelectMenuBuilder().setCustomId('select_ticket_category').setPlaceholder('📁 Selecionar categoria dos tickets').addChannelTypes(ChannelType.GuildCategory);
        const roleSelect = new RoleSelectMenuBuilder().setCustomId('select_ticket_role').setPlaceholder('🛠️ Selecionar cargo dos atendentes');
        const btnSendTicketPanel = new ButtonBuilder().setCustomId('btn_send_ticket_panel').setLabel('Enviar Painel de Tickets').setEmoji('📩').setStyle(ButtonStyle.Success);

        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, guildData)],
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
        const targetChan = guildData.ticketChannel ? interaction.guild.channels.cache.get(guildData.ticketChannel) : interaction.channel;
        if (!targetChan) return interaction.reply({ content: '❌ Selecione um canal no menu acima!', ephemeral: true });

        const ticketEmbed = new EmbedBuilder()
          .setTitle(guildData.ticketTitle || '🎟️ Central de Atendimento & Suporte')
          .setDescription(guildData.ticketDescription || 'Clique no botão abaixo para abrir um ticket privado com nossa equipe.')
          .setColor(guildData.ticketColor && guildData.ticketColor.startsWith('#') ? guildData.ticketColor : '#57F287')
          .setFooter({ text: 'Central de Atendimento' });

        const openTicketBtn = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_open_ticket').setLabel('Abrir Ticket').setEmoji('📩').setStyle(ButtonStyle.Primary)
        );

        await targetChan.send({ embeds: [ticketEmbed], components: [openTicketBtn] });
        return interaction.reply({ content: `✅ Painel de Tickets enviado em ${targetChan}!`, ephemeral: true });
      }

      if (interaction.customId === 'btn_open_ticket') {
        if (!guildData.ticketCategory) {
          return interaction.reply({ content: '❌ Categoria de tickets não configurada no `/painel`.', ephemeral: true });
        }

        const existingChannel = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
        if (existingChannel) {
          return interaction.reply({ content: `⚠️ Você já possui um ticket aberto em ${existingChannel}!`, ephemeral: true });
        }

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: guildData.ticketCategory,
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

          if (guildData.logChannel) {
            const logChan = interaction.guild.channels.cache.get(guildData.logChannel);
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
          embeds: [buildPainelEmbed(interaction.guild, guildData)],
          components: [new ActionRowBuilder().addComponents(channelSelect), ...buildPainelButtons()]
        });
      }

      if (interaction.customId === 'btn_theme') {
        const colorSelect = new StringSelectMenuBuilder().setCustomId('select_theme_color').setPlaceholder('🎨 Selecione a cor do Tema').addOptions(COLOR_OPTIONS);
        return interaction.update({
          embeds: [buildPainelEmbed(interaction.guild, guildData)],
          components: [new ActionRowBuilder().addComponents(colorSelect), ...buildPainelButtons()]
        });
      }
    }

    if (interaction.isChannelSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      if (interaction.customId === 'select_welcome_channel') updates.welcomeChannel = val;
      if (interaction.customId === 'select_leave_channel') updates.leaveChannel = val;
      if (interaction.customId === 'select_log_channel') updates.logChannel = val;
      if (interaction.customId === 'select_ticket_send_channel') updates.ticketChannel = val;
      if (interaction.customId === 'select_ticket_category') updates.ticketCategory = val;
      
      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updated)], components: buildPainelButtons() });
    }

    if (interaction.isRoleSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      if (interaction.customId === 'select_welcome_role' || interaction.customId === 'select_autorole') updates.autoRole = val;
      if (interaction.customId === 'select_ticket_role') updates.ticketSupportRole = val;
      
      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updated)], components: buildPainelButtons() });
    }

    if (interaction.isStringSelectMenu()) {
      const val = interaction.values[0];
      let updates = {};
      if (interaction.customId === 'select_theme_color') updates.themeColor = val;
      
      const updated = await updateGuildData(interaction.guild.id, updates);
      return interaction.update({ embeds: [buildPainelEmbed(interaction.guild, updated)], components: buildPainelButtons() });
    }

  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

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

      const color = guildData.welcomeColor && guildData.welcomeColor.startsWith('#') ? guildData.welcomeColor : (guildData.themeColor && guildData.themeColor.startsWith('#') ? guildData.themeColor : '#57F287');

      const embed = new EmbedBuilder()
        .setTitle('👋 Seja Bem-vindo(a)!')
        .setDescription(text)
        .setColor(color)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      if (guildData.welcomeBanner && (guildData.welcomeBanner.startsWith('http://') || guildData.welcomeBanner.startsWith('https://'))) {
        embed.setImage(guildData.welcomeBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
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

      const color = guildData.leaveColor && guildData.leaveColor.startsWith('#') ? guildData.leaveColor : '#ED4245';

      const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(text)
        .setColor(color)
        .setTimestamp();

      if (guildData.leaveBanner && (guildData.leaveBanner.startsWith('http://') || guildData.leaveBanner.startsWith('https://'))) {
        embed.setImage(guildData.leaveBanner);
      }

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

process.on('unhandledRejection', r => console.error('[UNHANDLED REJECTION]:', r));
process.on('uncaughtException', e => console.error('[UNCAUGHT EXCEPTION]:', e));

client.login(process.env.DISCORD_TOKEN);
