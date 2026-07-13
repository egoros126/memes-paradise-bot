const discord = require('discord.js');
const Client = discord.Client;
const GatewayIntentBits = discord.GatewayIntentBits;
const express = require('express');
const cors = require('cors');

const app = express();

// Разрешаем CORS для запросов со стороны вашего сайта
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

// ХРАНИЛИЩЕ (КЭШ) В ПАМЯТИ СЕРВЕРА
let cachedModerators = []; 

// ПЕРЕМЕННЫЕ ДЛЯ КОНТРОЛЯ ОШИБОК
let lastError = null;       
let errorCount = 0;        

// Изменено на clientReady в соответствии с требованиями d.js v14+
client.once('clientReady', () => {
    console.log(`[ДИСКОРД] Бот успешно запущен как ${client.user.tag}`);
    updateModeratorsCache();
    // Проверка обновлений каждые 30 секунд
    setInterval(updateModeratorsCache, 30 * 1000);
});

async function updateModeratorsCache() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) {
            throw new Error(`Не удалось найти сервер с ID ${GUILD_ID}. Проверьте, добавлен ли бот на сервер.`);
        }

        const members = await guild.members.fetch().catch(() => null);
        if (!members) {
            throw new Error("Discord API временно отклонил запрос участников (Rate Limit)");
        }

        const tempModerators = [];

        members.forEach(member => {
            if (!member || !member.user || member.user.bot) return;

            const trustRoles = member.roles.cache
                .filter(r => r && r.name && r.name.startsWith('Доверие lvl '))
                .map(r => {
                    const lvl = parseInt(r.name.replace('Доверие lvl ', '')) || 0;
                    const color = r.hexColor === '#000000' ? '#5865F2' : r.hexColor;
                    return { name: r.name, lvl: lvl, position: r.position, color: color };
                });

            if (trustRoles.length > 0) {
                // Сортируем роли по позиции в списке, чтобы найти самую высокую
                trustRoles.sort((a, b) => b.position - a.position);
                
                // ИСПРАВЛЕНО: Обращаемся строго к первому элементу [0] отсортированного массива
                const highestTrustRole = trustRoles[0].name;
                const highestLvl = trustRoles[0].lvl;
                const currentRoleColor = trustRoles[0].color;

                const hasSupport = member.roles.cache.some(r => r && r.name === 'Поддержка');
                const isTrusted = member.roles.cache.some(r => r && r.name === 'Доверенные');

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

        // Сортируем модераторов по уровню доверия для вывода на сайте
        tempModerators.sort((a, b) => b.trustLvl - a.trustLvl);

        if (tempModerators.length > 0) {
            cachedModerators = tempModerators;
            errorCount = 0;
            lastError = null;
            console.log(`[КЭШ] Успешно обновлен! Найдено модераторов: ${tempModerators.length}`);
        } else {
            console.log('[КЭШ] На сервере пока нет участников с ролями "Доверие lvl "');
        }
    } catch (error) {
        errorCount++;
        console.error(`[СБОЙ] Попытка ${errorCount}:`, error.message);

        if (errorCount >= 3) {
            lastError = `Дискорд API выдает сбой: ${error.message || 'Внутренняя ошибка сервера'}. Используются старые сохраненные данные.`;
        }
    }
}

// Эндпоинт для сайта
app.get('/api/moderators', (req, res) => {
    console.log(`[ВЕБ] Получен запрос от сайта! Отдаю ${cachedModerators.length} модераторов.`);
    res.json({
        moderators: cachedModerators,
        warning: lastError 
    });
});

// Главный корень, чтобы не было ошибки "Cannot GET /"
app.get('/', (req, res) => {
    res.send('Бэкэнд Discord-бота успешно работает и готов принимать API запросы!');
});

// БЕЗОПАСНЫЙ ЗАПУСК: Сначала открываем веб-порт для хостинга, а затем авторизуем Дискорд сессию
// Заставляем Express слушать абсолютно новый, чистый порт 5000
const PORT = 5000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[СЕТЬ] Express API успешно запущено на порту ${PORT}`);
    
    if (!process.env.DISCORD_TOKEN) {
        console.error("[КРИТИЧЕСКАЯ ОШИБКА] Переменная окружения DISCORD_TOKEN не найдена в Railway!");
    } else {
        console.log('[ДИСКОРД] Подключение к Discord Gateway...');
        client.login(process.env.DISCORD_TOKEN).catch(err => {
            console.error("[ОШИБКА АВТОРИЗАЦИИ] Discord отклонил токен бота:", err.message);
        });
    }
});
