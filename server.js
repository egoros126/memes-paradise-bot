const discord = require('discord.js');
const Client = discord.Client;
const GatewayIntentBits = discord.GatewayIntentBits;
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

// Новый эндпоинт, который отдает ГОТОВЫЙ HTML для вставки на сайт через iframe
app.get('/html/moderators', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        let cardsHtml = '';

        members.forEach(member => {
            const trustRoles = member.roles.cache
                .filter(r => r.name.startsWith('Доверие lvl '))
                .map(r => {
                    const lvl = parseInt(r.name.replace('Доверие lvl ', '')) || 0;
                    return { name: r.name, lvl: lvl, position: r.position };
                });

            if (trustRoles.length > 0) {
                trustRoles.sort((a, b) => b.position - a.position);
                const highestTrustRole = trustRoles[0].name;

                const hasSupport = member.roles.cache.some(r => r.name === 'Поддержка');
                const isTrusted = member.roles.cache.some(r => r.name === 'Доверенные');

                const canManageTickets = hasSupport ? 'Одобряет' : 'Нет доступа';
                const canAddPlayers = isTrusted ? 'Разрешено' : 'Запрещено';
                const ticketColor = hasSupport ? '#2ed573' : '#ff4757';
                const addColor = isTrusted ? '#2ed573' : '#ff4757';

                cardsHtml += `
                <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 18px; border-radius: 14px; display: flex; flex-direction: row; align-items: center; gap: 16px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); font-family: 'Segoe UI', Roboto, sans-serif; color: white;">
                  <img src="${member.user.displayAvatarURL({ dynamic: true, size: 128 })}" alt="Avatar" style="width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid #5865F2; flex-shrink: 0;">
                  <div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;">
                    <div style="font-weight: 800; font-size: 19px; color: #fff; line-height: 1.2;">@${member.displayName}</div>
                    <div style="font-size: 14px; color: #a3e635; font-weight: 700; background: rgba(163,230,53,0.1); width: max-content; padding: 2px 8px; border-radius: 4px; margin: 2px 0;">
                      ${highestTrustRole}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #94a3b8; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
                      <div>🎫 Тикеты: <span style="color: ${ticketColor}; font-weight: bold;">${canManageTickets}</span></div>
                      <div>👤 Добавление игроков: <span style="color: ${addColor}; font-weight: bold;">${canAddPlayers}</span></div>
                    </div>
                  </div>
                </div>
                `;
            }
        });

        if (!cardsHtml) {
            cardsHtml = '<p style="color: #64748b; font-family: sans-serif;">Участники с ролями модерации не обнаружены.</p>';
        }

        // Отправляем готовую страницу, оформленную под стиль сайта
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
                    ::-webkit-scrollbar { width: 0px; }
                    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
                </style>
            </head>
            <body>
                <div class="grid">${cardsHtml}</div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error(error);
        res.status(500).send('<p style="color: #ff4757; font-family: sans-serif;">Ошибка получения данных из Discord</p>');
    }
});

client.login(process.env.DISCORD_TOKEN); 

app.listen(process.env.PORT || 3000, () => console.log('API запущено'));
