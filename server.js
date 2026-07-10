сonst { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers
    ] 
});

const GUILD_ID = '1050833126223511582';

client.once('ready', () => {
    console.log(`Бот успешно запущен как ${client.user.tag}`);
});

app.get('/api/moderators', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        const moderators = [];

        members.forEach(member => {
            const trustRoles = member.roles.cache
                .filter(r => r.name.startsWith('Доверие lvl'))
                .map(r => {
                    const lvl = parseInt(r.name.replace('Доверие lvl ', '')) || 0;
                    return { name: r.name, lvl: lvl, position: r.position };
                });

            if (trustRoles.length > 0) {
                trustRoles.sort((a, b) => b.position - a.position);
                const highestTrustRole = trustRoles[0].name;

                const hasSupport = member.roles.cache.some(r => r.name === 'Поддержка');
                const isTrusted = member.roles.cache.some(r => r.name === 'Доверенные');

                moderators.push({
                    username: member.user.username,
                    displayName: member.displayName,
                    avatarURL: member.user.displayAvatarURL({ dynamic: true, size: 128 }),
                    trustStatus: highestTrustRole,
                    canManageTickets: hasSupport ? 'Одобряет' : 'Нет доступа',
                    canAddPlayers: isTrusted ? 'Разрешено' : 'Запрещено',
                    ticketColor: hasSupport ? '#2ed573' : '#ff4757',
                    addColor: isTrusted ? '#2ed573' : '#ff4757'
                });
            }
        });

        res.json(moderators);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка получения данных из Discord' });
    }
});

client.login(process.env.DISCORD_TOKEN); 

app.listen(process.env.PORT || 3000, () => console.log('API запущено'));
