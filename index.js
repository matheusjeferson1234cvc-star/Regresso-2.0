const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    EmbedBuilder, 
    PermissionFlagsBits
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Configuração em memória
const config = {
    welcomeChannel: null,
    exitChannel: null,
    autoRole: null,
    ticketCategory: null
};

client.on('ready', () => {
    console.log(`🤖 Bot online com sucesso como ${client.user.tag}`);
});

// Evento: Boas-Vindas + Autorole
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
                    .setTitle('👋 Bem-vindo(a)!')
                    .setDescription(`Olá ${member}, seja muito bem-vindo(a) ao **${member.guild.name}**!`)
                    .setColor('#00FF00')
                    .setThumbnail(member.user.displayAvatarURL());
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (err) {
        console.error('Erro no evento guildMemberAdd:', err);
    }
});

// Evento: Saída
client.on('guildMemberRemove', async (member) => {
    try {
        if (config.exitChannel) {
            const channel = member.guild.channels.cache.get(config.exitChannel);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('👋 Até mais!')
                    .setDescription(`O membro **${member.user.tag}** saiu do servidor.`)
                    .setColor('#FF0000');
                await channel.send({ embeds: [embed] });
            }
        }
    } catch (err) {
        console.error('Erro no evento guildMemberRemove:', err);
    }
});

// Comando para abrir o painel
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '/painel-administrativo') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Apenas administradores podem usar este painel.');
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('admin_panel_select')
            .setPlaceholder('Selecione um módulo para configurar...')
            .addOptions([
                {
                    label: 'Boas-Vindas & Autorole',
                    description: 'Configurar entrada, saída e cargo automático',
                    value: 'tab_welcome'
                },
                {
                    label: 'Atendimento (Tickets)',
                    description: 'Configurar categoria de tickets',
                    value: 'tab_tickets'
                },
                {
                    label: 'Regras',
                    description: 'Enviar mensagem de regras',
                    value: 'tab_rules'
                },
                {
                    label: 'Criar Embed',
                    description: 'Enviar mensagens personalizadas em qualquer canal',
                    value: 'tab_embed'
                }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Painel Administrativo')
            .setDescription('Selecione uma opção no menu abaixo para configurar cada módulo.')
            .setColor('#2b2d31');

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

// Interações do Painel
client.on('interactionCreate', async (interaction) => {
    try {
        // Seleção no Menu Principal
        if (interaction.isStringSelectMenu() && interaction.customId === 'admin_panel_select') {
            const selected = interaction.values[0];

            if (selected === 'tab_welcome') {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_set_welcome').setLabel('Canal de Entrada').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('btn_set_exit').setLabel('Canal de Saída').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('btn_set_autorole').setLabel('Cargo Automático').setStyle(ButtonStyle.Success)
                );

                const embed = new EmbedBuilder()
                    .setTitle('👋 Boas-Vindas, Saída & Autorole')
                    .setDescription(`• **Entrada:** ${config.welcomeChannel ? `<#${config.welcomeChannel}>` : 'Não configurado'}\n• **Saída:** ${config.exitChannel ? `<#${config.exitChannel}>` : 'Não configurado'}\n• **Autorole:** ${config.autoRole ? `<@&${config.autoRole}>` : 'Não configurado'}`)
                    .setColor('#2b2d31');

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (selected === 'tab_tickets') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_ticket_config')
                    .setTitle('Configurar Categoria de Tickets');

                const input = new TextInputBuilder()
                    .setCustomId('ticket_category_id')
                    .setLabel('ID da Categoria dos Tickets')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }

            if (selected === 'tab_rules') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_rules_config')
                    .setTitle('Enviar Mensagem de Regras');

                const channelInput = new TextInputBuilder()
                    .setCustomId('rules_channel_id')
                    .setLabel('ID do Canal')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const contentInput = new TextInputBuilder()
                    .setCustomId('rules_text')
                    .setLabel('Texto das Regras')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelInput),
                    new ActionRowBuilder().addComponents(contentInput)
                );
                await interaction.showModal(modal);
            }

            if (selected === 'tab_embed') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_custom_embed')
                    .setTitle('Criar Embed Personalizada');

                const channelInput = new TextInputBuilder()
                    .setCustomId('embed_channel_id')
                    .setLabel('ID do Canal de Destino')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel('Título')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const descInput = new TextInputBuilder()
                    .setCustomId('embed_desc')
                    .setLabel('Descrição')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true);

                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel('Cor Hex (Ex: #00FF00)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel('Link da Imagem (URL)')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(channelInput),
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(imageInput)
                );
                await interaction.showModal(modal);
            }
        }

        // Cliques em Botões
        if (interaction.isButton()) {
            if (['btn_set_welcome', 'btn_set_exit', 'btn_set_autorole'].includes(interaction.customId)) {
                const modal = new ModalBuilder()
                    .setCustomId(`modal_${interaction.customId}`)
                    .setTitle('Configuração');

                const input = new TextInputBuilder()
                    .setCustomId('input_id')
                    .setLabel(interaction.customId === 'btn_set_autorole' ? 'Digite o ID do Cargo' : 'Digite o ID do Canal')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
            }
        }

        // Submissão dos Modais
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'modal_btn_set_welcome') {
                config.welcomeChannel = interaction.fields.getTextInputValue('input_id').trim();
                await interaction.reply({ content: `✅ Canal de entrada definido para <#${config.welcomeChannel}>!`, ephemeral: true });
            }

            if (interaction.customId === 'modal_btn_set_exit') {
                config.exitChannel = interaction.fields.getTextInputValue('input_id').trim();
                await interaction.reply({ content: `✅ Canal de saída definido para <#${config.exitChannel}>!`, ephemeral: true });
            }

            if (interaction.customId === 'modal_btn_set_autorole') {
                config.autoRole = interaction.fields.getTextInputValue('input_id').trim();
                await interaction.reply({ content: `✅ Cargo automático definido para <@&${config.autoRole}>!`, ephemeral: true });
            }

            if (interaction.customId === 'modal_ticket_config') {
                config.ticketCategory = interaction.fields.getTextInputValue('ticket_category_id').trim();
                await interaction.reply({ content: `✅ Categoria de tickets salva (ID: \`${config.ticketCategory}\`)!`, ephemeral: true });
            }

            if (interaction.customId === 'modal_rules_config') {
                const channelId = interaction.fields.getTextInputValue('rules_channel_id').trim();
                const rulesText = interaction.fields.getTextInputValue('rules_text');
                const channel = interaction.guild.channels.cache.get(channelId);

                if (!channel) return interaction.reply({ content: '❌ Canal não encontrado! Verifique o ID fornecido.', ephemeral: true });

                const embed = new EmbedBuilder()
                    .setTitle('📜 Regras do Servidor')
                    .setDescription(rulesText)
                    .setColor('#2b2d31');

                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: '✅ Regras enviadas com sucesso!', ephemeral: true });
            }

            if (interaction.customId === 'modal_custom_embed') {
                const channelId = interaction.fields.getTextInputValue('embed_channel_id').trim();
                const title = interaction.fields.getTextInputValue('embed_title');
                const desc = interaction.fields.getTextInputValue('embed_desc');
                let color = interaction.fields.getTextInputValue('embed_color').trim() || '#2b2d31';
                const image = interaction.fields.getTextInputValue('embed_image').trim();

                const channel = interaction.guild.channels.cache.get(channelId);
                if (!channel) return interaction.reply({ content: '❌ Canal não encontrado! Verifique o ID.', ephemeral: true });

                // Validação simples de Hex da Cor para evitar erro fatal
                if (!color.startsWith('#')) color = `#${color}`;
                if (!/^#[0-9A-F]{6}$/i.test(color)) color = '#2b2d31';

                const embed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(desc)
                    .setColor(color);

                if (image && (image.startsWith('http://') || image.startsWith('https://'))) {
                    embed.setImage(image);
                }

                await channel.send({ embeds: [embed] });
                await interaction.reply({ content: '✅ Embed enviada com sucesso no canal escolhido!', ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Erro na execução da interação:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Ocorreu um erro ao processar esta ação. Verifique o console do bot.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login('SEU_TOKEN_AQUI');
