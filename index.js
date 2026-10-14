const { 
  Client, 
  GatewayIntentBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle 
} = require('discord.js');
require('dotenv').config();
const fs = require('fs');

// Inicializa o cliente do bot
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ] 
});

const configFile = './data/config.json';
const ticketsFile = './data/tickets.json';

// Cria a pasta e os arquivos de configuração padrão caso não existam
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data');
}
if (!fs.existsSync(configFile)) {
  fs.writeFileSync(configFile, JSON.stringify({
    panelTitle: "Central de Suporte",
    panelDescription: "Clique no botão abaixo para abrir um ticket e falar com nossa equipe.",
    panelColor: "#800080",
    panelImage: "",
    ticketCategoryId: "",
    adminRoleId: "",
    logChannelId: ""
  }, null, 2));
}
if (!fs.existsSync(ticketsFile)) {
  fs.writeFileSync(ticketsFile, JSON.stringify([], null, 2));
}

let config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
let tickets = JSON.parse(fs.readFileSync(ticketsFile, 'utf8'));

// Evento quando o bot liga
client.on('ready', () => {
  console.log(`✅ Bot conectado com sucesso como: ${client.user.tag}`);
});

// Manipulador de interações (Comandos, Modais e Botões)
client.on('interactionCreate', async interaction => {
  
  // 1. COMANDOS DE TEXTO (SLASH COMMANDS)
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // Comando: /painel
    if (commandName === 'painel') {
      const embed = new EmbedBuilder()
        .setTitle(config.panelTitle || 'Central de Suporte')
        .setDescription(config.panelDescription || 'Clique no botão abaixo para abrir um ticket e falar com nossa equipe.')
        .setColor(config.panelColor || '#800080')
        .setFooter({ text: 'Sistema de Tickets Profissional' });

      if (config.panelImage) embed.setImage(config.panelImage);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('Abrir Ticket')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📩')
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    // Comando: /configurar
    if (commandName === 'configurar') {
      const modal = new ModalBuilder()
        .setCustomId('config_panel_modal')
        .setTitle('Configurar Painel');

      const titleInput = new TextInputBuilder()
        .setCustomId('panel_title')
        .setLabel('Título do Painel')
        .setStyle(TextInputStyle.Short)
        .setValue(config.panelTitle || '');

      const descInput = new TextInputBuilder()
        .setCustomId('panel_desc')
        .setLabel('Descrição do Painel')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(config.panelDescription || '');

      const imageInput = new TextInputBuilder()
        .setCustomId('panel_image')
        .setLabel('Link da Imagem do Painel')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(config.panelImage || '');

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(imageInput)
      );

      await interaction.showModal(modal);
    }
  }

  // 2. FORMULÁRIOS (MODAIS)
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'config_panel_modal') {
      config.panelTitle = interaction.fields.getTextInputValue('panel_title');
      config.panelDescription = interaction.fields.getTextInputValue('panel_desc');
      config.panelImage = interaction.fields.getTextInputValue('panel_image');

      fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
      await interaction.reply({ content: '✅ Configurações do painel atualizadas!', ephemeral: true });
    }
  }

  // 3. BOTÕES (ABRIR, FECHAR E ASSUMIR TICKET)
  if (interaction.isButton()) {
    const { guild, member, channel } = interaction;

    // Ação: Abrir Ticket
    if (interaction.customId === 'create_ticket') {
      const ticketChannel = await guild.channels.create({
        name: `ticket-${member.user.username}`,
        type: ChannelType.GuildText,
        parent: config.ticketCategoryId || undefined,
        permissionOverwrites: [
          {
            id: guild.id,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          },
          ...(config.adminRoleId ? [{
            id: config.adminRoleId,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
          }] : []),
        ],
      });

      tickets.push({ channelId: ticketChannel.id, userId: member.id, status: 'open' });
      fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));

      const embed = new EmbedBuilder()
        .setTitle(`Ticket de ${member.user.username}`)
        .setDescription('Por favor, descreva seu problema. Nossa equipe responderá em breve.')
        .setColor('#800080');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Fechar Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId('claim_ticket')
          .setLabel('Assumir Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🙋‍♂️')
      );

      await ticketChannel.send({ content: `${member}, um membro da equipe entrará em contato.`, embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket criado em ${ticketChannel}!`, ephemeral: true });
    }

    // Ação: Fechar Ticket
    if (interaction.customId === 'close_ticket') {
      await channel.delete();
      
      const index = tickets.findIndex(t => t.channelId === channel.id);
      if (index !== -1) {
        tickets.splice(index, 1);
        fs.writeFileSync(ticketsFile, JSON.stringify(tickets, null, 2));
      }
    }

    // Ação: Assumir Ticket
    if (interaction.customId === 'claim_ticket') {
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.addFields({ name: 'Assumido por', value: member.user.tag });
      
      const row = ActionRowBuilder.from(interaction.message.components[0]);
      row.components[1].setDisabled(true);

      await interaction.message.edit({ embeds: [embed], components: [row] });
      await interaction.reply({ content: `✅ Ticket assumido por ${member}.`, ephemeral: true });
    }
  }
});

// LOGS DO SISTEMA
client.on('channelCreate', async channel => {
  if (!config.logChannelId) return;
  const logChannel = client.channels.cache.get(config.logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Canal Criado')
    .setDescription(`O canal **${channel.name}** foi criado.`)
    .setColor('#800080')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

client.on('channelDelete', async channel => {
  if (!config.logChannelId) return;
  const logChannel = client.channels.cache.get(config.logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Canal Deletado')
    .setDescription(`O canal **${channel.name}** foi deletado.`)
    .setColor('#ff0000')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

client.on('messageDelete', async message => {
  if (message.partial || message.author.bot || !config.logChannelId) return;

  const logChannel = client.channels.cache.get(config.logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle('Mensagem Deletada')
    .setDescription(`Mensagem de **${message.author.tag}** deletada no canal **${message.channel.name}**.`)
    .addFields({ name: 'Conteúdo', value: message.content || 'Sem conteúdo.' })
    .setColor('#ffaa00')
    .setTimestamp();

  logChannel.send({ embeds: [embed] }).catch(console.error);
});

// Conecta o bot no Discord usando o Token das variáveis de ambiente
client.login(process.env.DISCORD_TOKEN);
