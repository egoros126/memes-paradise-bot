const discord = require('discord.js');
const Client = discord.Client;
const GatewayIntentBits = discord.GatewayIntentBits;
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMembers
    ] 
});

const GUILD_ID = '1050833126223511582';

// НАШЕ МИНИ-ХРАНИЛИЩЕ (КЭШ) В ПАМЯТИ СЕРВЕРА
let cachedModerators = []; 

// 🌟 ПЕРЕМЕННЫЕ ДЛЯ КОНТРОЛЯ ОШИБОК
let lastError = null;       // Сюда пишем текст ошибки, если она зависла
let errorCount = 0;        // Считаем сколько раз подряд бот споткнулся

client.once('ready', () => {
    console.log(`Бот успешно запущен как ${client.user.tag}`);
    updateModeratorsCache();
    // Бот проверяет обновления каждые 30 секунд (чтобы быстрее реагировать)
    setInterval(updateModeratorsCache, 30 * 1000);
});

async function updateModeratorsCache() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const members = await guild.members.fetch();
        const tempModerators = [];

        members.forEach(member => {
            if (member.user.bot) return;

            const trustRoles = member.roles.cache
                .filter(r => r.name && r.name.startsWith('Доверие lvl '))
                .map(r => {
                    const lvl = parseInt(r.name.replace('Доверие lvl ', '')) || 0;
                    const color = r.hexColor === '#000000' ? '#5865F2' : r.hexColor;
                    return { name: r.name, lvl: lvl, position: r.position, color: color };
                });

            if (trustRoles.length > 0) {
                trustRoles.sort((a, b) => b.position - a.position);
                const highestTrustRole = trustRoles[0].name;
                const highestLvl = trustRoles[0].lvl;
                const currentRoleColor = trustRoles[0].color;

                const hasSupport = member.roles.cache.some(r => r.name === 'Поддержка');
                const isTrusted = member.roles.cache.some(r => r.name === 'Доверенные');

                let avatar = 'https://discord.com';
                try {
                    avatar = member.user.displayAvatarURL({ dynamic: true, size: 128 });
                } catch (e) {}

                tempModerators.push({
                    username: member.user.username,
                    displayName: member.displayName || member.user.username,
                    avatarURL: avatar,
                    trustStatus: highestTrustRole,
                    trustLvl: highestLvl,
                    roleColor: currentRoleColor,
                    canManageTickets: hasSupport ? 'Одобряет' : 'Нет доступа',
                    canAddPlayers: isTrusted ? 'Разрешено' : 'Запрещено',
                    ticketColor: hasSupport ? '#2ed573' : '#ff4757',
                    addColor: isTrusted ? '#2ed573' : '#ff4757'
                });
            }
        });

        tempModerators.sort((a, b) => b.trustLvl - a.trustLvl);

        if (tempModerators.length > 0) {
            cachedModerators = tempModerators;
            // 🌟 ВСЁ КРУТО: сбрасываем ошибки в ноль
            errorCount = 0;
            lastError = null;
            console.log('Кэш модераторов успешно обновлен!');
        }
    } catch (error) {
        // 🌟 СБОЙ: прибавляем ошибку к счетчику
        errorCount++;
        console.error(`Сбой обновления кэша (Попытка ${errorCount}):`, error.message);

        // Если бот споткнулся больше 3 раз подряд (это как раз около 1.5 - 2 минут непрерывной ошибки)
        if (errorCount >= 3) {
            lastError = `Дискорд API выдает сбой: ${error.message || 'Внутренняя ошибка сервера (500)'}. Используются старые сохраненные данные.`;
        }
    }
}

// Эндпоинт для сайта
app.get('/api/moderators', (req, res) => {
    // 🌟 Если у нас накопились ошибки, мы дописываем предупреждение прямо в ответ сайту!
    res.json({
        moderators: cachedModerators,
        warning: lastError // Если всё хорошо, тут будет null. Если сбой — сайт узнает правду.
    });
});

client.login(process.env.DISCORD_TOKEN); 

app.listen(process.env.PORT || 3000, () => console.log('API запущено'));
