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

// Banco de Dados em Memória
const db = {
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**!',
  welcomeBanner: null,
  leaveChannel: null,
  leaveMessage: 'O membro **{user}** saiu do servidor.',
  leaveBanner: null,
  autoRole: null,
  ticketCategory: null,
  ticketSupportRole: null,
  // Design do Painel de Tickets
  ticketTitle: '🎟️ Central de Atendimento & Suporte',
  ticketDescription: 'Selecione no menu abaixo a categoria ideal para abrir seu atendimento privado com nossa equipe.',
  ticketColor: '#57F287',
  ticketBanner: null,
  // Categorias de Atendimento Editáveis
  ticketOpt1Label: 'Dúvidas Gerais',
  ticketOpt1Desc: 'Suporte geral sobre o servidor ou serviços.',
  ticketOpt1Emoji: '❓',
  ticketOpt2Label: 'Atendimento / Compras',
  ticketOpt2Desc: 'Suporte dedicado para compras e produtos.',
  ticketOpt2Emoji: '📦',
  logChannel: null
};

// Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre o painel administrativo do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Cria e envia uma embed personalizada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot inicializado como ${client.user.tag} (v15)`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('[SLASH] Comandos registrados com sucesso!');
  } catch (error) {
    console.error('[ERRO] Falha ao registrar comandos:', error);
  }
});

// Layout do Painel Principal
function buildPainelEmbed(guild) {
  return new EmbedBuilder()
    .setAuthor({ 
      name: `Central de Gestão | ${guild.name}`, 
      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
    })
    .setTitle('⚙️ Painel de Configurações Administrativas')
    .setDescription(
      '```\nGerencie os módulos do servidor selecionando uma das seções abaixo:\n```'
    )
    .addFields(
      { 
        name: '👋 Boas-Vindas & AutoRole', 
        value: `└ **Canal:** ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Não configurado`'}\n└ **Cargo:** ${db.autoRole ? `<@&${db.autoRole}>` : '`❌ Não configurado`'}`, 
        inline: true 
      },
      { 
        name: '🚪 Módulo de Saída', 
        value: `└ **Canal:** ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Não configurado`'}\n└ **Banner:** ${db.leaveBanner ? '`✅ Ativo`' : '`❌ Desativado`'}`, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true },
      { 
        name: '🎟️ Sistema de Tickets', 
        value: `└ **Categoria:** ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`'}\n└ **Staff:** ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : '`❌ Não definido`'}\n└ **Opção 1:** \`${db.ticketOpt1Label}\`\n└ **Opção 2:** \`${db.ticketOpt2Label}\``, 
        inline: true 
      },
      { 
        name: '📜 Logs & Moderação', 
        value: `└ **Canal de Logs:** ${db.logChannel ? `<#${db.logChannel}>` : '`❌ Não configurado`'}\n└ **Registros:** \`Deletadas, Editadas e Bans\``, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true }
    )
    .setColor('#2F3136')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Green Otimizações • Painel Administrativo v15', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas & AutoRole').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Sistema de Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets & Suporte').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs & Banimentos').setEmoji('📜').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

// Interações Globais
client.on('interactionCreate', async (interaction) => {
  try {
    // Slash Commands
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

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cv_title').setLabel('Título').setStyle(TextInputStyle.Short).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cv_description').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cv_image').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }
    }

    // Submissão de Modais
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
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = interaction.fields.getTextInputValue('welcome_banner_url') || null;
        return interaction.reply({ content: '✨ Mensagem e Banner de **Boas-Vindas** salvos!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_leave') {
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = interaction.fields.getTextInputValue('leave_banner_url') || null;
        return interaction.reply({ content: '✨ Mensagem e Banner de **Saída** salvos!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_ticket_design') {
        db.ticketTitle = interaction.fields.getTextInputValue('ticket_custom_title');
        db.ticketDescription = interaction.fields.getTextInputValue('ticket_custom_desc');
        db.ticketColor = interaction.fields.getTextInputValue('ticket_custom_color') || '#57F287';
        db.ticketBanner = interaction.fields.getTextInputValue('ticket_custom_banner') || null;
        return interaction.reply({ content: '✨ Visual e textos do **Painel de Tickets** atualizados!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_ticket_categories') {
        db.ticketOpt1Label = interaction.fields.getTextInputValue('ticket_opt1_label') || db.ticketOpt1Label;
        db.ticketOpt1Desc = interaction.fields.getTextInputValue('ticket_opt1_desc') || db.ticketOpt1Desc;
        db.ticketOpt2Label = interaction.fields.getTextInputValue('ticket_opt2_label') || db.ticketOpt2Label;
        db.ticketOpt2Desc = interaction.fields.getTextInputValue('ticket_opt2_desc') || db.ticketOpt2Desc;
        return interaction.reply({ content: '✨ Nomes e descrições das **Categorias de Ticket** salvos!', ephemeral: true });
      }

      if (interaction.customId === 'modal_open_ticket_form') {
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Categoria de tickets não definida no servidor.', ephemeral: true });
        }

        const selectedCategory = interaction.client.tempTicketCategory || 'Atendimento Geral';
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        const existingChannel = interaction.guild.channels.cache.find(
          c => c.name === `ticket-${interaction.user.username.toLowerCase()}`
        );

        if (existingChannel) {
          return interaction.reply({ content: `⚠️ Você já possui um ticket aberto em ${existingChannel}!`, ephemeral: true });
        }

        const permissionOverwrites = [
          { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] }
        ];

        if (db.ticketSupportRole) {
          permissionOverwrites.push({
            id: db.ticketSupportRole,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles]
          });
        }

        const channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: db.ticketCategory,
          permissionOverwrites
        });

        const ticketPanelEmbed = new EmbedBuilder()
          .setTitle(`🎟️ Ticket: ${selectedCategory}`)
          .addFields(
            { name: '👤 Cliente', value: `${interaction.user}`, inline: true },
            { name: '📂 Categoria', value: `\`${selectedCategory}\``, inline: true },
            { name: '📌 Assunto', value: subject },
            { name: '📝 Detalhes do Atendimento', value: reason },
            { name: '🛠️ Atendente Responsável', value: '`Nenhum (Aguardando Staff)`' }
          )
          .setColor(db.ticketColor.startsWith('#') ? db.ticketColor : '#57F287')
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Assumir Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
          content: `${interaction.user}${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : ''}`, 
          embeds: [ticketPanelEmbed], 
          components: [ticketButtons] 
        });

        return interaction.reply({ content: `✅ Ticket aberto em ${channel}!`, ephemeral: true });
      }
    }

    // Botões
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
          .setLabel('Editar Texto & Banner')
          .setEmoji('✍️')
          .setStyle(ButtonStyle.Secondary);

        return interaction.reply({
          content: '⚙️ **Boas-Vindas & AutoRole:**',
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

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(db.welcomeMessage).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('welcome_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.welcomeBanner || '').setRequired(false)
          )
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
          .setLabel('Editar Texto & Banner')
          .setEmoji('✍️')
          .setStyle(ButtonStyle.Secondary);

        return interaction.reply({
          content: '⚙️ **Configuração de Saída:**',
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

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user} e {server})').setStyle(TextInputStyle.Paragraph).setValue(db.leaveMessage).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('leave_banner_url').setLabel('URL da Imagem / Banner (Opcional)').setStyle(TextInputStyle.Short).setValue(db.leaveBanner || '').setRequired(false)
          )
        );
        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_tickets') {
        const categorySelect = new ChannelSelectMenuBuilder()
          .setCustomId('select_ticket_category')
          .setPlaceholder('📁 Categoria onde os canais serão criados')
          .addChannelTypes(ChannelType.GuildCategory);

        const supportRoleSelect = new RoleSelectMenuBuilder()
          .setCustomId('select_ticket_role')
          .setPlaceholder('🛠️ Cargo dos Atendentes / Staff');

        const btnDesign = new ButtonBuilder()
          .setCustomId('btn_edit_ticket_design')
          .setLabel('Design & Banner do Painel')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Secondary);

        const btnCategories = new ButtonBuilder()
          .setCustomId('btn_edit_ticket_categories')
          .setLabel('Nomes das Categorias do Ticket')
          .setEmoji('✏️')
          .setStyle(ButtonStyle.Secondary);

        const btnSendTicketPanel = new ButtonBuilder()
          .setCustomId('btn_send_ticket_panel')
          .setLabel('Enviar Painel de Tickets Aqui')
          .setEmoji('📩')
          .setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Gerenciamento do Módulo de Tickets:**',
          components: [
            new ActionRowBuilder().addComponents(categorySelect),
            new ActionRowBuilder().addComponents(supportRoleSelect),
            new ActionRowBuilder().addComponents(btnDesign, btnCategories),
            new ActionRowBuilder().addComponents(btnSendTicketPanel)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_edit_ticket_design') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_ticket_design')
          .setTitle('Design & Banner do Ticket');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_custom_title').setLabel('Título da Embed').setStyle(TextInputStyle.Short).setValue(db.ticketTitle).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_custom_desc').setLabel('Descrição').setStyle(TextInputStyle.Paragraph).setValue(db.ticketDescription).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_custom_color').setLabel('Cor Hexadecimal (Ex: #57F287)').setStyle(TextInputStyle.Short).setValue(db.ticketColor).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_custom_banner').setLabel('URL do Banner / Imagem (Opcional)').setStyle(TextInputStyle.Short).setValue(db.ticketBanner || '').setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_edit_ticket_categories') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_ticket_categories')
          .setTitle('Nomes das Categorias de Ticket');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_opt1_label').setLabel('Nome da Categoria 1').setStyle(TextInputStyle.Short).setValue(db.ticketOpt1Label).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_opt1_desc').setLabel('Descrição da Categoria 1').setStyle(TextInputStyle.Short).setValue(db.ticketOpt1Desc).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_opt2_label').setLabel('Nome da Categoria 2').setStyle(TextInputStyle.Short).setValue(db.ticketOpt2Label).setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_opt2_desc').setLabel('Descrição da Categoria 2').setStyle(TextInputStyle.Short).setValue(db.ticketOpt2Desc).setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Defina uma categoria para os canais antes de enviar o painel!', ephemeral: true });
        }

        const ticketEmbed = new EmbedBuilder()
          .setTitle(db.ticketTitle)
          .setDescription(db.ticketDescription)
          .setColor(db.ticketColor.startsWith('#') ? db.ticketColor : '#57F287')
          .setFooter({ text: 'Atendimento Green Otimizações' });

        if (db.ticketBanner && (db.ticketBanner.startsWith('http://') || db.ticketBanner.startsWith('https://'))) {
          ticketEmbed.setImage(db.ticketBanner);
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_ticket_type')
          .setPlaceholder('▼ Selecione uma opção para abrir seu ticket')
          .addOptions([
            {
              label: db.ticketOpt1Label,
              description: db.ticketOpt1Desc,
              value: 'opt1',
              emoji: db.ticketOpt1Emoji
            },
            {
              label: db.ticketOpt2Label,
              description: db.ticketOpt2Desc,
              value: 'opt2',
              emoji: db.ticketOpt2Emoji
            }
          ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        await interaction.channel.send({ embeds: [ticketEmbed], components: [row] });
        return interaction.reply({ content: '✅ Painel enviado com sucesso!', ephemeral: true });
      }

      if (interaction.customId === 'btn_claim_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));

        if (!isStaff) {
          return interaction.reply({ content: '❌ Apenas a equipe de suporte pode assumir este ticket!', ephemeral: true });
        }

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);
        embed.spliceFields(4, 1, { name: '🛠️ Atendente Responsável', value: `${interaction.user}` });

        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claimed').setLabel(`Assumido por ${interaction.user.username}`).setEmoji('✅').setStyle(ButtonStyle.Secondary).setDisabled(true),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await interaction.update({ embeds: [embed], components: [disabledRow] });
        return interaction.followUp({ content: `✅ Ticket assumido por ${interaction.user}!`, ephemeral: false });
      }

      if (interaction.customId === 'btn_close_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));

        if (!isStaff) {
          return interaction.reply({ content: '❌ Apenas administradores ou atendentes podem fechar tickets!', ephemeral: true });
        }

        await interaction.reply({ content: '🔒 Fechando canal do ticket em 5 segundos...' });
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
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

    // Select Menus
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
      const selectedValue = interaction.values[0];
      const categoryName = selectedValue === 'opt1' ? db.ticketOpt1Label : db.ticketOpt2Label;

      interaction.client.tempTicketCategory = categoryName;

      const modal = new ModalBuilder()
        .setCustomId('modal_open_ticket_form')
        .setTitle(`Atendimento: ${categoryName}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ticket_subject').setLabel('Assunto Resumido').setStyle(TextInputStyle.Short).setPlaceholder('Digite o título do seu atendimento...').setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('ticket_reason').setLabel('Descrição Completa').setStyle(TextInputStyle.Paragraph).setPlaceholder('Explique em detalhes como podemos te ajudar...').setRequired(true)
        )
      );

      return interaction.showModal(modal);
    }

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = value;
        return interaction.update({ content: `✅ Canal de Boas-Vindas definido: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_autorole') {
        db.autoRole = value;
        return interaction.update({ content: `✅ Cargo de AutoRole definido: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_leave_channel') {
        db.leaveChannel = value;
        return interaction.update({ content: `✅ Canal de Saída definido: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_category') {
        db.ticketCategory = value;
        return interaction.update({ content: `✅ Categoria dos Tickets definida: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_role') {
        db.ticketSupportRole = value;
        return interaction.update({ content: `✅ Cargo de Atendimento definido: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_log_channel') {
        db.logChannel = value;
        return interaction.update({ content: `✅ Canal de Logs definido: <#${value}>`, components: [] });
      }
    }
  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// Eventos de Membros e Moderação
client.on('guildMemberAdd', async (member) => {
  if (db.autoRole) {
    await member.roles.add(db.autoRole).catch(() => {});
  }

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

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

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

      channel.send({ embeds: [embed] }).catch(() => {});
    }
  }
});

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

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

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

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanAdd', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔨 Membro Banido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi banido do servidor.`)
    .setColor('#5865F2')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('guildBanRemove', (ban) => {
  if (!db.logChannel) return;
  const logChannel = ban.guild.channels.cache.get(db.logChannel);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('🔓 Membro Desbanido')
    .setDescription(`O usuário **${ban.user.tag}** (\`${ban.user.id}\`) foi desbanido do servidor.`)
    .setColor('#57F287')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(() => {});
});

process.on('unhandledRejection', (reason) => console.error('UnhandledRejection:', reason));
process.on('uncaughtException', (err) => console.error('UncaughtException:', err));

client.login(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
