import TelegramBot from "node-telegram-bot-api";
import { EvrasiaApi, RestaurantAdress } from "./evrasia-api";
import { StatisticManager } from "./statistic-manager";
import { getRandomUserAgent } from "./user-agents";
import { UserDatabase } from "./user-database";

export function run() {
    const token = '5847860544:AAFBsw2RNB0k5D-hyOEuiqtrEFOAIG6u3mU';
    const bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, async (m) => {
        StatisticManager.add('/start');
        if (await UserDatabase.getUser(m.from.id) == null) {
            await bot.sendMessage(m.chat.id, 'Отправьте команду /login для авторизации');
        } else {
            await bot.sendMessage(m.chat.id, 'Ви уже авторизаванный пользователь. Чтобы войти в другой аккаунт отправьте команду /logout, а затем /login');
        }
    });


    function findUserInLoginRequest(userId: number): loginRequest {
        var r = loginRequests.find((d) => d.id == userId);
        if (!r) return null;
        return r;
    }


    var loginRequests: Array<loginRequest> = [];
    bot.onText(/\/login/, async (m) => {
        StatisticManager.add('/login');
        var usr = await UserDatabase.getUser(m.from.id);
        var r = findUserInLoginRequest(m.from.id) == undefined;
        if (usr == undefined && r) {
            await bot.sendMessage(m.chat.id, 'Введите номер телефона, к которому привязан аккаунт в формате +7XXXXXXXXXXX');
            loginRequests.push(new loginRequest(m.from.id));
        } else if (r == undefined && usr?.cookies != '') {
            await bot.sendMessage(m.chat.id, 'Вы уже авторизованы');
        } else {
            await bot.sendMessage(m.chat.id, 'Процесс авторизации уже запущен, следуйте иструкциям выше');
        }
    });


    var bot_adresses: RestaurantAdress[] = [];

    bot.on('callback_query', async (q) => {
        var adressQuery = /getCode#(\d*)#(\d*)/.exec(q.data);

        if (adressQuery.length == 3) {
            var code = parseInt(adressQuery[1]);
            var user = adressQuery[2];

            usersThatChoosesCode.splice(usersThatChoosesCode.indexOf(q.from.id), 1);

            try {
                await bot.deleteMessage(q.message.chat.id, q.message.message_id.toString());
                await bot.answerCallbackQuery(q.id, {});
            } catch (e) {
                //query can be just too old so ignore it 
            }

            var discountCode = await EvrasiaApi.ActivateCode(await UserDatabase.getUser(q.from.id), code);

            if (discountCode.ok) {
                await bot.sendMessage(q.from.id, `Выбран ресторан: ${bot_adresses.find((e) => e.index == code).name}\nВаш код: ${discountCode.result}`);
            } else {
                //TODO
            }

        }
    });

    var usersThatChoosesCode: number[] = [];

    bot.onText(/\/getcode/, async (m) => {
        StatisticManager.add('/getcode');
        var usr = await UserDatabase.getUser(m.from.id);
        if (usersThatChoosesCode.includes(m.from.id) || usr == undefined) {
            //just ignore 
        } else {
            usersThatChoosesCode.push(m.from.id);
            var user = await UserDatabase.getUser(m.from.id);
            if (user != undefined) {
                var adresess = await EvrasiaApi.GetAdresess(user);
                if (adresess.ok && adresess.result != undefined) {
                    //TODO change this logic if users can have diff adresses 
                    bot_adresses = adresess.result;
                    bot.sendMessage(m.from.id, 'Выберите адрес', {
                        reply_markup: {
                            inline_keyboard: adresess.result.map((e) => {
                                return [{
                                    text: e.name,
                                    callback_data: `getCode#${e.index}#${m.from.id}`,
                                }]
                            })
                        }
                    });
                } else {
                    //TODO hold error
                }
            } else {
                //todo user should login
            }
        }
    })

    bot.onText(/\/me/, async (m) => {
        StatisticManager.add('/me');
        var r = await UserDatabase.getUser(m.from.id);

        if (r != undefined) {
            var d = await EvrasiaApi.GetUserData(r);

            if (d.ok) {
                bot.sendMessage(m.from.id,
                    `Имя: ${d.result.name}
Номер телефона: ${d.result.phone}
Баллы: ${d.result.points}
Карты: ${d.result.cards.join(', ')}
Счёт: ${r.scoring}`);
            }
        }

        if(d != undefined) UserDatabase.writeUser({ ...r, siteScore: parseInt(d.result.points) });
    });

    bot.onText(/\+[0-9]{11}/, (m) => {
        var r = findUserInLoginRequest(m.from.id);
        if (r != undefined) {
            r.phone = m.text;
            r.phoneMessageId = m.message_id;
            bot.sendMessage(r.id, 'Теперь ввидете ваш пароль');
        }
    });
    
    bot.onText(/\/stopword/, async (m) => {
        StatisticManager.add('/stopword');
        var r = findUserInLoginRequest(m.from.id);

        if (r != undefined) {
            loginRequests.splice(loginRequests.indexOf(r), 1);
            bot.sendMessage(m.from.id, 'Процесс остановлен. Введите команду /login повторно')
        }
    });

    bot.onText(/\/stat/, async (m) => {
        var usr = await UserDatabase.getUser(m.from.id);
        if (usr != undefined) {
            if (usr.isAdmin) {
                bot.sendMessage(m.from.id, `Всего баллов на счетах: ${await UserDatabase.ScoringSumm()}
Всего пользователей: ${await UserDatabase.TotalUsers()}
${Array.from(StatisticManager.statPerCommand.entries()).map((e, i) => {
                    var command = e[0];
                    var stat = e[1];

                    var v = '*'.repeat(15);
                    v += '\n';
                    v += `${command}\n`;
                    v += `Отправлено за последний час: ${stat.hourStat}\n`;
                    v += `Отправлено за последний день: ${stat.dayStat}\n`;
                    v += `Отправлено за последнюю неделю: ${stat.weekStat}\n`;
                    v += `Отправлено за всё время: ${stat.totalStat}\n`;

                    return v;
                })}
`);
            }
        }
    });

    var appointRequests: string[] = [];

    var admRegex = /\/usr2adm (\d{6})/;
    bot.onText(admRegex, async (m) => {
        var code = admRegex.exec(m.text)[1];
        if (appointRequests.includes(code)) {
            var usr = await UserDatabase.getUser(m.from.id);
            if (usr == undefined) {
                UserDatabase.writeUser({
                    id: m.from.id,
                    isAdmin: true,
                    cookies: '',
                    userAgent: '',
                    scoring: 0,
                    siteScore: 0,
                })
            } else {
                await UserDatabase.writeUser({ ...usr, isAdmin: true });
                bot.sendMessage(m.from.id, 'Вам успешно выдана административная должность');
            }
        }
    });

    bot.onText(/\/appoint/, async (m) => {
        var usr = await UserDatabase.getUser(m.from.id);
        if (usr != undefined) {
            if (usr.isAdmin) {
                var code = Math.floor(100000 + Math.random() * 900000);
                appointRequests.push(code.toString());

                bot.sendMessage(m.chat.id, 'Чтобы назначить нового админа кандидат должен отправить следующюю команду боту: `/usr2adm ' + code + '`',
                    { parse_mode: 'MarkdownV2' });
            }
        }
    });

    var givePointsRegex = /\/give (\d* \d* ?(.*)?)/; 
    bot.onText(givePointsRegex, async (m) => {
        var usr= await UserDatabase.getUser(m.from.id);

        if(usr != undefined) {
            if(usr.isAdmin) {
                var s = givePointsRegex.exec(m.text)[1].split(' ');
                var to = parseInt(s[0]); 
                var amount = parseInt(s[1]);
                var msg = m.text.includes(',') ? m.text.substring(m.text.indexOf(',')+1) : null;
                var toUser = await UserDatabase.getUser(to); 
                if(toUser) {
                    UserDatabase.writeUser({...toUser, scoring: toUser.scoring + amount});
                    bot.sendMessage(m.from.id, 'Сумма успешно начислена');
                    var p = `На Ваш счёт начислено ${amount} баллов`;
                    if(msg != null) p += `\nСообщение от администратора: ${msg}`;
                    bot.sendMessage(to, p);                    
                } else {
                    bot.sendMessage(m.from.id, 'Данного пользователя нету в базе данных');
                }
            }
        }
    });

    bot.onText(/.*/, async (m) => {
        var r = findUserInLoginRequest(m.from.id);
        if (r != undefined) {
            console.log(r);
            if (r.phone == undefined && m.text != '/login') {
                bot.sendMessage(m.chat.id, 'Неправильный формат номера');
            } else if (r.phone != undefined && r.phoneMessageId != m.message_id) {
                var agent = getRandomUserAgent();
                r.password = m.text;

                var result = await EvrasiaApi.Login(r.phone, r.password, agent);

                if (result.ok) {
                    bot.sendMessage(m.chat.id, 'Теперь вы авторизованы');
                    console.log('write user');
                    var isAdmin = (await UserDatabase.TotalUsers()) == 0; 
                    if(isAdmin) bot.sendMessage(m.from.id, 'Теперь вы админ');
                    await UserDatabase.writeUser({
                        id: m.from.id,
                        cookies: JSON.stringify(result.result),
                        isAdmin: isAdmin,
                        userAgent: agent,
                        scoring: 0,
                        siteScore: 0,
                    });
                    loginRequests.splice(loginRequests.indexOf(r), 1);
                } else {
                    bot.sendMessage(m.from.id, 'Неправильный пароль или логин. Введите правильный пароль или отправьте команду /stopword чтобы повторить авторизацию')
                }
            }
        }
    })
}

class loginRequest {
    id: number;
    phone?: string;
    phoneMessageId: number;
    password?: string;

    constructor(id: number) {
        this.id = id;
    }
}