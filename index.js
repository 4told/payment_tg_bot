const { Telegraf, Markup } = require('telegraf');
const { google } = require('googleapis');
const fs = require('fs');


const bot = new Telegraf('8682232739:AAF2AGpRnbpITmk4t0gUdBLfoZUyl5dmVfY');

// один пользователь = один state
let state = null;

// клавиатура
const getKeyboard = () =>
    Markup.keyboard([
        ['➕ Добавить заявку']
    ]).resize();

// Google auth
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
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
        method: '',
        house: ''
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

    state.method = methods[ctx.callbackQuery.data];
    state.step = 'house';

    await ctx.answerCbQuery();

    return ctx.reply(
        'Выбери дом',
        Markup.inlineKeyboard([
            [Markup.button.callback('Дом 1', 'house_1')],
            [Markup.button.callback('Дом 2', 'house_2')],
            [Markup.button.callback('Дом 3', 'house_3')],
            [Markup.button.callback('Пропустить', 'house_skip')],
        ])
    );
});

bot.action(['house_1', 'house_2', 'house_3', 'house_skip'], async (ctx) => {
    if (!state || state.step !== 'house') return;

    const houses = {
        house_1: 'Дом 1',
        house_2: 'Дом 2',
        house_3: 'Дом 3',
        house_skip: '',
    };

    state.house = houses[ctx.callbackQuery.data];

    const { name, amount, method, house } = state;

    state = null;

    await ctx.answerCbQuery();
    await ctx.reply('⏳ Сохраняю...');

    const sheets = google.sheets({ version: 'v4', auth });

    sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'бот!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[
                name,
                // new Date().toLocaleDateString('ru-RU'),
                new Date().toISOString().slice(0, 10),
                amount,
                method,
                house
            ]]
        }
    })
        .then(() => {
            ctx.reply('✅ Сохранено в таблицу', getKeyboard());
        })
        .catch((e) => {
            console.error(e);
            ctx.reply('❌ Ошибка при сохранении', getKeyboard());
        });
});

bot.launch();