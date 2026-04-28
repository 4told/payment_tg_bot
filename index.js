const { Telegraf, Markup } = require('telegraf');
const { google } = require('googleapis');

const bot = new Telegraf('8682232739:AAGv6nZpvEF0goz4tWBg-ZW-f7iMDC2KaTU');

// один пользователь = один state
let state = null;

// клавиатура
const getKeyboard = () =>
    Markup.keyboard([
        ['➕ Добавить заявку']
    ]).resize();

// Google auth
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// const spreadsheetId = '14q3wc0Dzy4o3IemJXMrtpctHQmAX1soasRNnND_mkU8';
const spreadsheetId = '1EjUjLMnGR0togHtESuc3Y37zL7kuRnzPvNO1l1_N8hA';

// старт
bot.start((ctx) => {
    return ctx.reply('Готов к работе', getKeyboard());
});

// начать создание заявки
bot.hears('➕ Добавить заявку', (ctx) => {
    state = {
        step: 'name',
        name: '',
        amount: '',
        method: ''
    };

    return ctx.reply(
        'Введи название заявки',
        Markup.removeKeyboard()
    );
});

// обработка текста
bot.on('text', async (ctx) => {
    if (!state) return;

    const text = ctx.message.text;

    // шаг 1 — название
    if (state.step === 'name') {
        state.name = text;
        state.step = 'amount';

        return ctx.reply('Введи сумму', Markup.removeKeyboard());
    }

    // шаг 2 — сумма
    if (state.step === 'amount') {
        if (isNaN(text)) {
            return ctx.reply('❗ Введите число');
        }

        state.amount = text;
        state.step = 'method';

        // показываем inline-кнопки
        return ctx.reply(
            'Выбери вид работы',
            Markup.inlineKeyboard([
                [Markup.button.callback('Работа', 'work')],
                [Markup.button.callback('Mатериалы', 'material')],
            ])
        );
    }
});

// обработка выбора (inline кнопки)
bot.action(['work', 'material'], async (ctx) => {
    if (!state || state.step !== 'method') return;

    const methods = {
        work: 'Раб',
        material: 'М',
    };

    const method = methods[ctx.callbackQuery.data];

    const name = state.name;
    const amount = state.amount;

    state = null;

    await ctx.answerCbQuery(); // убираем "часики"
    await ctx.reply('⏳ Сохраняю...');

    const sheets = google.sheets({ version: 'v4', auth });

    sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'бот!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                name,
                new Date().toLocaleDateString('ru-RU'),
                amount,
                method
            ]]
        }
    })
        .then(() => {
            ctx.reply('✅ Сохранено', getKeyboard());
        })
        .catch((e) => {
            console.error(e);
            ctx.reply('❌ Ошибка при сохранении', getKeyboard());
        });
});

bot.launch();