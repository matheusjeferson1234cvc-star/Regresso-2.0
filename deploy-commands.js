const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
require('dotenv').config();

// Definição dos comandos /painel e /configurar
const commands = [
  new SlashCommandBuilder()
    .setName('painel')
    .setDescription('Envia o painel de suporte para criação de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  new SlashCommandBuilder()
    .setName('configurar')
    .setDescription('Configura os canais e cargos do sistema de tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
];

// Instância da API REST do Discord
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Função para registrar os comandos na API do Discord
(async () => {
  try {
    console.log('⏳ Registrando os comandos de barra (/)...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log('✅ Comandos registrados com sucesso no Discord!');
  } catch (error) {
    console.error('❌ Erro ao registrar comandos:', error);
  }
})();
