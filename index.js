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
const fs = require('fs');
const path = require('path');

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

// Caminho do Banco de Dados Local
const dbFilePath = path.join(__dirname, 'database.json');

// Estrutura Padrão do Banco de Dados
const defaultDb = {
  themeColor: '#57F287',
  welcomeChannel: null,
  welcomeMessage: 'Olá {user}, seja bem-vindo(a) ao **{server}**! Atualmente somos **{members}** membros.',
  welcomeBanner: null,
  leaveChannel: null,
  leaveMessage: 'O membro **{user.tag}** saiu do servidor **{server}**.',
  leaveBanner: null,
  autoRole: null,
  ticketCategory: null,
  ticketSupportRole: null,
  ticketTitle: '🎟️ Central de Atendimento & Suporte',
  ticketDescription: 'Selecione abaixo o departamento desejado para abrir seu atendimento privado.',
  ticketColor: '#57F287',
  ticketBanner: null,
  ticketCategories: [
    { id: 'cat_duvidas', label: 'Dúvidas Gerais', description: 'Tire suas dúvidas sobre o servidor ou serviços.', emoji: '❓' },
    { id: 'cat_compras', label: 'Atendimento / Compras', description: 'Suporte dedicado para vendas e orçamentos.', emoji: '📦' }
  ],
  logChannel: null
};

// Carregar Dados do Arquivo JSON
let db = { ...defaultDb };

function loadData() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf8');
      db = { ...defaultDb, ...JSON.parse(data) };
      console.log('[BANCO DE DADOS] Configurações salvas carregadas com sucesso!');
    } else {
      saveData();
      console.log('[BANCO DE DADOS] Criado novo arquivo database.json.');
    }
  } catch (error) {
    console.error('[ERRO] Falha ao carregar banco de dados:', error);
  }
}

// Salvar Dados no Arquivo JSON
function saveData() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('[ERRO] Falha ao salvar no banco de dados:', error);
  }
}

// Carregar dados na inicialização
loadData();

// Comandos Slash
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Abre a central de configurações administrativa do bot.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('cv')
    .setDescription('Abre o formulário para criar e enviar uma embed personalizada.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
];

client.once('ready', async () => {
  console.log(`[SISTEMA] Bot inicializado como ${client.user.tag} (v15 - Com Persistência JSON)`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || 'SEU_TOKEN_AQUI');
  try {
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log('[SLASH] Comandos globais registrados!');
  } catch (error) {
    console.error('[ERRO] Falha ao registrar comandos:', error);
  }
});

// Helper: Formatador de Variáveis
function parseVariables(text, member, guild) {
  if (!text) return '';
  return text
    .replace(/{user}/g, `${member}`)
    .replace(/{user\.tag}/g, member.user ? member.user.tag : member.tag || '')
    .replace(/{user\.id}/g, member.id)
    .replace(/{server}/g, guild.name)
    .replace(/{members}/g, guild.memberCount);
}

// Helper: Painel Principal
function buildPainelEmbed(guild) {
  const categoriesFormatted = db.ticketCategories.length > 0
    ? db.ticketCategories.map(c => `└ ${c.emoji} **${c.label}**`).join('\n')
    : '└ `❌ Nenhuma categoria cadastrada`';

  return new EmbedBuilder()
    .setAuthor({ 
      name: `Painel de Gestão VIP | ${guild.name}`, 
      iconURL: guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL() 
    })
    .setTitle('⚙️ Central de Configurações Administrativas')
    .setDescription('```\nPersonalize as mensagens, cores, banners e fluxos do seu servidor. Dados salvos no banco!\n```')
    .addFields(
      { 
        name: '🎨 Tema Global & Visual', 
        value: `└ **Cor do Tema:** \`${db.themeColor}\``, 
        inline: false 
      },
      { 
        name: '👋 Boas-Vindas & AutoRole', 
        value: `└ **Canal:** ${db.welcomeChannel ? `<#${db.welcomeChannel}>` : '`❌ Desativado`'}\n└ **Cargo:** ${db.autoRole ? `<@&${db.autoRole}>` : '`❌ Desativado`'}\n└ **Banner:** ${db.welcomeBanner ? '`✅ Imagem Ativa`' : '`❌ Sem Banner`'}`, 
        inline: true 
      },
      { 
        name: '🚪 Módulo de Saída', 
        value: `└ **Canal:** ${db.leaveChannel ? `<#${db.leaveChannel}>` : '`❌ Desativado`'}\n└ **Banner:** ${db.leaveBanner ? '`✅ Imagem Ativa`' : '`❌ Sem Banner`'}`, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true },
      { 
        name: '🎟️ Sistema de Tickets', 
        value: `└ **Categoria:** ${db.ticketCategory ? `<#${db.ticketCategory}>` : '`❌ Não definida`'}\n└ **Atendimento Staff:** ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : '`❌ Não definido`'}\n${categoriesFormatted}`, 
        inline: true 
      },
      { 
        name: '📜 Central de Logs', 
        value: `└ **Canal:** ${db.logChannel ? `<#${db.logChannel}>` : '`❌ Desativado`'}\n└ **Eventos:** \`Mensagens & Moderação\``, 
        inline: true 
      },
      { name: '\u200B', value: '\u200B', inline: true }
    )
    .setColor(db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
    .setThumbnail(client.user.displayAvatarURL())
    .setFooter({ text: 'Green Otimizações • Sistema com Persistência Permanente', iconURL: client.user.displayAvatarURL() })
    .setTimestamp();
}

function buildPainelButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_welcome').setLabel('Boas-Vindas & AutoRole').setEmoji('👋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_leave').setLabel('Sistema de Saída').setEmoji('🚪').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_theme').setLabel('Cor do Tema').setEmoji('🎨').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_tickets').setLabel('Tickets & Suporte').setEmoji('🎟️').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_logs').setLabel('Logs & Banimentos').setEmoji('📜').setStyle(ButtonStyle.Danger)
  );

  return [row1, row2];
}

// Manipulação Global de Interações
client.on('interactionCreate', async (interaction) => {
  try {
    // 1. SLASH COMMANDS
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
            new TextInputBuilder().setCustomId('cv_color').setLabel('Cor Hexadecimal (Ex: #00FF00)').setStyle(TextInputStyle.Short).setValue(db.themeColor).setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }
    }

    // 2. MODAIS (SUBMISSIONS)
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_cv') {
        const title = interaction.fields.getTextInputValue('cv_title');
        const description = interaction.fields.getTextInputValue('cv_description');
        const image = interaction.fields.getTextInputValue('cv_image');
        const color = interaction.fields.getTextInputValue('cv_color') || db.themeColor;

        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(description)
          .setColor(color.startsWith('#') ? color : '#57F287')
          .setTimestamp();

        if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
          embed.setImage(image);
        }

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({ content: '✅ Embed personalizada enviada!', ephemeral: true });
      }

      if (interaction.customId === 'modal_theme') {
        const color = interaction.fields.getTextInputValue('theme_color_input');
        if (color.startsWith('#')) {
          db.themeColor = color;
          saveData();
          return interaction.reply({ content: `✨ Cor do Tema Global atualizada e salva: \`${color}\`!`, ephemeral: true });
        } else {
          return interaction.reply({ content: '❌ Por favor informe um código Hexadecimal válido (ex: `#00FF00`).', ephemeral: true });
        }
      }

      if (interaction.customId === 'modal_edit_welcome') {
        db.welcomeMessage = interaction.fields.getTextInputValue('welcome_msg_text');
        db.welcomeBanner = interaction.fields.getTextInputValue('welcome_banner_url') || null;
        saveData();
        return interaction.reply({ content: '✨ Mensagem e Banner de **Boas-Vindas** salvos permanentemente!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_leave') {
        db.leaveMessage = interaction.fields.getTextInputValue('leave_msg_text');
        db.leaveBanner = interaction.fields.getTextInputValue('leave_banner_url') || null;
        saveData();
        return interaction.reply({ content: '✨ Mensagem e Banner de **Saída** salvos permanentemente!', ephemeral: true });
      }

      if (interaction.customId === 'modal_edit_ticket_design') {
        db.ticketTitle = interaction.fields.getTextInputValue('ticket_custom_title');
        db.ticketDescription = interaction.fields.getTextInputValue('ticket_custom_desc');
        db.ticketColor = interaction.fields.getTextInputValue('ticket_custom_color') || db.themeColor;
        db.ticketBanner = interaction.fields.getTextInputValue('ticket_custom_banner') || null;
        saveData();
        return interaction.reply({ content: '✨ Design do **Painel de Tickets** salvo com sucesso!', ephemeral: true });
      }

      if (interaction.customId === 'modal_add_ticket_cat') {
        const label = interaction.fields.getTextInputValue('cat_label');
        const desc = interaction.fields.getTextInputValue('cat_desc');
        const emoji = interaction.fields.getTextInputValue('cat_emoji') || '📂';

        db.ticketCategories.push({ id: `cat_${Date.now()}`, label, description: desc, emoji });
        saveData();
        return interaction.reply({ content: `✅ Categoria **${label}** adicionada e salva!`, ephemeral: true });
      }

      if (interaction.customId === 'modal_open_ticket_form') {
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Categoria de tickets não configurada no servidor.', ephemeral: true });
        }

        const selectedCategory = interaction.client.tempTicketCategory || 'Atendimento Generalizado';
        const subject = interaction.fields.getTextInputValue('ticket_subject');
        const reason = interaction.fields.getTextInputValue('ticket_reason');

        const existingChannel = interaction.guild.channels.cache.find(
          c => c.name === `ticket-${interaction.user.username.toLowerCase()}`
        );

        if (existingChannel) {
          return interaction.reply({ content: `⚠️ Você já tem um atendimento ativo em ${existingChannel}!`, ephemeral: true });
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
          .setTitle(`🎟️ Atendimento: ${selectedCategory}`)
          .addFields(
            { name: '👤 Cliente', value: `${interaction.user}`, inline: true },
            { name: '📂 Categoria', value: `\`${selectedCategory}\``, inline: true },
            { name: '📌 Assunto', value: subject },
            { name: '📝 Detalhes do Problema / Pedido', value: reason },
            { name: '🛠️ Atendente Responsável', value: '`Nenhum (Aguardando Atendente)`' }
          )
          .setColor(db.ticketColor.startsWith('#') ? db.ticketColor : db.themeColor)
          .setTimestamp();

        const ticketButtons = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('btn_claim_ticket').setLabel('Assumir Ticket').setEmoji('🙋‍♂️').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('btn_close_ticket').setLabel('Fechar Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
          content: `${interaction.user} ${db.ticketSupportRole ? `<@&${db.ticketSupportRole}>` : ''}`, 
          embeds: [ticketPanelEmbed], 
          components: [ticketButtons] 
        });

        return interaction.reply({ content: `✅ Atendimento aberto em ${channel}!`, ephemeral: true });
      }
    }

    // 3. BOTÕES DO PAINEL
    if (interaction.isButton()) {
      if (interaction.customId === 'btn_theme') {
        const modal = new ModalBuilder()
          .setCustomId('modal_theme')
          .setTitle('Alterar Cor Tema Global');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('theme_color_input').setLabel('Cor Hexadecimal (Ex: #57F287, #00FF00)').setStyle(TextInputStyle.Short).setValue(db.themeColor).setRequired(true)
          )
        );
        return interaction.showModal(modal);
      }

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

        const btnPreview = new ButtonBuilder()
          .setCustomId('btn_preview_welcome')
          .setLabel('👁️ Testar Prévia')
          .setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Boas-Vindas & AutoRole:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            new ActionRowBuilder().addComponents(btnEditMsg, btnPreview)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_preview_welcome') {
        const text = parseVariables(db.welcomeMessage, interaction.member, interaction.guild);
        const embed = new EmbedBuilder()
          .setTitle('👋 [PRÉVIA] Seja Bem-vindo(a)!')
          .setDescription(text)
          .setColor(db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
          .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
          .setTimestamp();

        if (db.welcomeBanner && (db.welcomeBanner.startsWith('http://') || db.welcomeBanner.startsWith('https://'))) {
          embed.setImage(db.welcomeBanner);
        }

        return interaction.reply({ content: '🔍 **Esta é uma pré-visualização da mensagem de boas-vindas:**', embeds: [embed], ephemeral: true });
      }

      if (interaction.customId === 'btn_edit_welcome_msg') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_welcome')
          .setTitle('Configurar Boas-Vindas');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('welcome_msg_text').setLabel('Texto ({user}, {server}, {members})').setStyle(TextInputStyle.Paragraph).setValue(db.welcomeMessage).setRequired(true)
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

        const btnPreview = new ButtonBuilder()
          .setCustomId('btn_preview_leave')
          .setLabel('👁️ Testar Prévia')
          .setStyle(ButtonStyle.Success);

        return interaction.reply({
          content: '⚙️ **Configuração de Saída:**',
          components: [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(btnEditMsg, btnPreview)
          ],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_preview_leave') {
        const text = parseVariables(db.leaveMessage, interaction.member, interaction.guild);
        const embed = new EmbedBuilder()
          .setTitle('🚪 [PRÉVIA] Membro Saiu')
          .setDescription(text)
          .setColor('#ED4245')
          .setTimestamp();

        if (db.leaveBanner && (db.leaveBanner.startsWith('http://') || db.leaveBanner.startsWith('https://'))) {
          embed.setImage(db.leaveBanner);
        }

        return interaction.reply({ content: '🔍 **Esta é uma pré-visualização da mensagem de saída:**', embeds: [embed], ephemeral: true });
      }

      if (interaction.customId === 'btn_edit_leave_msg') {
        const modal = new ModalBuilder()
          .setCustomId('modal_edit_leave')
          .setTitle('Configurar Mensagem de Saída');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('leave_msg_text').setLabel('Texto ({user.tag}, {server})').setStyle(TextInputStyle.Paragraph).setValue(db.leaveMessage).setRequired(true)
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
          .setPlaceholder('📁 Categoria para criação dos canais')
          .addChannelTypes(ChannelType.GuildCategory);

        const supportRoleSelect = new RoleSelectMenuBuilder()
          .setCustomId('select_ticket_role')
          .setPlaceholder('🛠️ Cargo dos Atendentes / Staff');

        const btnDesign = new ButtonBuilder()
          .setCustomId('btn_edit_ticket_design')
          .setLabel('Design & Banner')
          .setEmoji('🎨')
          .setStyle(ButtonStyle.Secondary);

        const btnAddCat = new ButtonBuilder()
          .setCustomId('btn_add_ticket_cat')
          .setLabel('Adicionar Categoria')
          .setEmoji('➕')
          .setStyle(ButtonStyle.Primary);

        const btnRemoveCat = new ButtonBuilder()
          .setCustomId('btn_remove_ticket_cat')
          .setLabel('Remover Categoria')
          .setEmoji('🗑️')
          .setStyle(ButtonStyle.Danger);

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
            new ActionRowBuilder().addComponents(btnDesign, btnAddCat, btnRemoveCat),
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
            new TextInputBuilder().setCustomId('ticket_custom_color').setLabel('Cor Hexadecimal').setStyle(TextInputStyle.Short).setValue(db.ticketColor).setRequired(false)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_custom_banner').setLabel('URL do Banner / Imagem (Opcional)').setStyle(TextInputStyle.Short).setValue(db.ticketBanner || '').setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_add_ticket_cat') {
        if (db.ticketCategories.length >= 25) {
          return interaction.reply({ content: '❌ Limite de 25 categorias de ticket atingido!', ephemeral: true });
        }

        const modal = new ModalBuilder()
          .setCustomId('modal_add_ticket_cat')
          .setTitle('Adicionar Categoria de Ticket');

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cat_label').setLabel('Nome da Categoria').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Suporte Técnico').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cat_desc').setLabel('Descrição Curta').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Atendimento para dúvidas e ajuda').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('cat_emoji').setLabel('Emoji (Opcional)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 🛠️').setRequired(false)
          )
        );

        return interaction.showModal(modal);
      }

      if (interaction.customId === 'btn_remove_ticket_cat') {
        if (db.ticketCategories.length === 0) {
          return interaction.reply({ content: '❌ Nenhuma categoria disponível para remoção!', ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_delete_ticket_cat')
          .setPlaceholder('🗑️ Selecione a categoria para excluir')
          .addOptions(
            db.ticketCategories.map(cat => ({
              label: cat.label,
              description: cat.description,
              value: cat.id,
              emoji: cat.emoji
            }))
          );

        return interaction.reply({
          content: 'Selecione abaixo a categoria que deseja **remover**:',
          components: [new ActionRowBuilder().addComponents(selectMenu)],
          ephemeral: true
        });
      }

      if (interaction.customId === 'btn_send_ticket_panel') {
        if (!db.ticketCategory) {
          return interaction.reply({ content: '❌ Defina a categoria dos canais antes de enviar o painel!', ephemeral: true });
        }

        if (db.ticketCategories.length === 0) {
          return interaction.reply({ content: '❌ Adicione pelo menos uma categoria de atendimento antes!', ephemeral: true });
        }

        const ticketEmbed = new EmbedBuilder()
          .setTitle(db.ticketTitle)
          .setDescription(db.ticketDescription)
          .setColor(db.ticketColor.startsWith('#') ? db.ticketColor : db.themeColor)
          .setFooter({ text: 'Atendimento Green Otimizações' });

        if (db.ticketBanner && (db.ticketBanner.startsWith('http://') || db.ticketBanner.startsWith('https://'))) {
          ticketEmbed.setImage(db.ticketBanner);
        }

        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId('select_ticket_type')
          .setPlaceholder('▼ Selecione uma opção para abrir seu ticket')
          .addOptions(
            db.ticketCategories.map(cat => ({
              label: cat.label,
              description: cat.description,
              value: cat.id,
              emoji: cat.emoji
            }))
          );

        await interaction.channel.send({ embeds: [ticketEmbed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        return interaction.reply({ content: '✅ Painel de Atendimento enviado no canal!', ephemeral: true });
      }

      if (interaction.customId === 'btn_claim_ticket') {
        const isStaff = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || 
                        (db.ticketSupportRole && interaction.member.roles.cache.has(db.ticketSupportRole));

        if (!isStaff) {
          return interaction.reply({ content: '❌ Apenas a equipe de atendimento pode assumir tickets!', ephemeral: true });
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
          return interaction.reply({ content: '❌ Apenas administradores ou a equipe de atendimento podem fechar tickets!', ephemeral: true });
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
          content: '⚙️ **Configuração de Logs e Moderação:**',
          components: [new ActionRowBuilder().addComponents(channelSelect)],
          ephemeral: true
        });
      }
    }

    // 4. SELECT MENUS
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_delete_ticket_cat') {
        const catId = interaction.values[0];
        const removedCat = db.ticketCategories.find(c => c.id === catId);

        db.ticketCategories = db.ticketCategories.filter(c => c.id !== catId);
        saveData();

        return interaction.update({
          content: `🗑️ Categoria **${removedCat ? removedCat.label : 'selecionada'}** removida e salva!`,
          components: []
        });
      }

      if (interaction.customId === 'select_ticket_type') {
        const selectedCatId = interaction.values[0];
        const category = db.ticketCategories.find(c => c.id === selectedCatId);
        const categoryName = category ? category.label : 'Atendimento';

        interaction.client.tempTicketCategory = categoryName;

        const modal = new ModalBuilder()
          .setCustomId('modal_open_ticket_form')
          .setTitle(`Atendimento: ${categoryName}`);

        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_subject').setLabel('Assunto Resumido').setStyle(TextInputStyle.Short).setPlaceholder('Digite o título do assunto...').setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('ticket_reason').setLabel('Descrição Completa').setStyle(TextInputStyle.Paragraph).setPlaceholder('Detalhe a sua dúvida ou necessidade...').setRequired(true)
          )
        );

        return interaction.showModal(modal);
      }
    }

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      const value = interaction.values[0];

      if (interaction.customId === 'select_welcome_channel') {
        db.welcomeChannel = value;
        saveData();
        return interaction.update({ content: `✅ Canal de Boas-Vindas definido: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_autorole') {
        db.autoRole = value;
        saveData();
        return interaction.update({ content: `✅ Cargo de AutoRole definido: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_leave_channel') {
        db.leaveChannel = value;
        saveData();
        return interaction.update({ content: `✅ Canal de Saída definido: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_category') {
        db.ticketCategory = value;
        saveData();
        return interaction.update({ content: `✅ Categoria dos Tickets definida: <#${value}>`, components: [] });
      }

      if (interaction.customId === 'select_ticket_role') {
        db.ticketSupportRole = value;
        saveData();
        return interaction.update({ content: `✅ Cargo de Atendimento definido: <@&${value}>`, components: [] });
      }

      if (interaction.customId === 'select_log_channel') {
        db.logChannel = value;
        saveData();
        return interaction.update({ content: `✅ Canal de Logs definido: <#${value}>`, components: [] });
      }
    }
  } catch (err) {
    console.error('[ERRO INTERAÇÃO]:', err);
  }
});

// Eventos de Entradas, Saídas e Logs
client.on('guildMemberAdd', async (member) => {
  if (db.autoRole) {
    await member.roles.add(db.autoRole).catch(() => {});
  }

  if (db.welcomeChannel) {
    const channel = member.guild.channels.cache.get(db.welcomeChannel);
    if (channel) {
      const text = parseVariables(db.welcomeMessage, member, member.guild);

      const embed = new EmbedBuilder()
        .setTitle('👋 Seja Bem-vindo(a)!')
        .setDescription(text)
        .setColor(db.themeColor.startsWith('#') ? db.themeColor : '#57F287')
        .setThumbnail(member.user.displayAvatarURL
