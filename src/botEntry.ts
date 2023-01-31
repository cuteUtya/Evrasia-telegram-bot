import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { EvrasiaApi, RestaurantAdress } from "./evrasia-api";
import { addProxy, proxies, removeProxy } from "./proxy-manager";
import { StatisticManager } from "./statistic-manager";
import { someKindOfDebugging } from "./types/debug";
import { getRandomUserAgent } from "./user-agents";
import { UserDatabase } from "./user-database";

export function run() {
    someKindOfDebugging();
    const token = config.bottoken;
    const bot = new TelegramBot(token, { polling: true });

    function reportError(err: Error, context: TelegramBot.Message) {
        try {
            bot.sendMessage(context.chat.id, err.message);
        } catch (e) { }
    }

    bot.onText(/\/start/, async (m) => {
        try {
            StatisticManager.add('/start');
            if (await UserDatabase.getUser(m.from.id) == null) { 
                await UserDatabase.writeUser({id: m.from.id, isAdmin: false, scoring: 0,});
                getCode(m);
            }
        } catch (e) { reportError(e, m) }
    });

    bot.onText(/\/support/, async (m) => {
        try {
            StatisticManager.add('/support');
            bot.sendMessage(m.from.id, `Поддержка бота: ${config.supportBotUsername}`);
        } catch (e) {
            reportError(e, m);
        }
    });

    var bot_adresses: RestaurantAdress[] = [];


    
    bot.on('callback_query', async (q) => {
        try {
            var adressQuery = /getCode#(\d*)#(\d*)/.exec(q.data);

            if (adressQuery.length == 3) {
                var code = parseInt(adressQuery[1]);

                usersThatChoosesCode.splice(usersThatChoosesCode.indexOf(q.from.id), 1);

                try {
                    await bot.deleteMessage(q.message.chat.id, q.message.message_id.toString());
                    await bot.answerCallbackQuery(q.id, {});
                } catch (e) {
                    //query can be just too old so ignore it 
                }

                var discountCode = await EvrasiaApi.ActivateCode(code);

                if (discountCode.ok) {
                    await bot.sendMessage(q.from.id, `Выбран ресторан: ${bot_adresses.find((e) => e.index == code).name}\nВаш код: ${discountCode.result}`);
                } else {
                    //TODO
                }

            }
        } catch (e) {
            //reportError(e, m);
        }
    });

    var usersThatChoosesCode: number[] = [];

    async function getCode(m: TelegramBot.Message) {
        try {
            StatisticManager.add('/getcode');
            var usr = await UserDatabase.getUser(m.from.id);
            console.log(usr);
            if (usersThatChoosesCode.includes(m.from.id) || usr == undefined) {
                //just ignore 
            } else {
                console.log('here');
                usersThatChoosesCode.push(m.from.id);
                    var adresess = await EvrasiaApi.GetAdresess();
                    console.log(adresess);
                    if (adresess.ok && adresess.result != undefined) {
                        //TODO change this logic if users can have diff adresses 
                        bot_adresses = adresess.result;
                        

                        var objs = adresess.result.map((e) => {
                            return {
                                text: e.name,
                                callback_data: `getCode#${e.index}#${m.from.id}`,
                            }
                        });
                        var e = [];

                        for(var i = 0; i < objs.length; i += 2) {
                            if(objs[i+1] != undefined) e.push([objs[i], objs[i+1]]);
                            else e.push([objs[i]]);
                        }

                        console.log(e);

                        bot.sendMessage(m.from.id, 'Выберите адрес', {
                            reply_markup: {
                                inline_keyboard:e  
                            }
                        });
                } else {
                    //todo user should login
                }
            }
        } catch (e) {
            reportError(e, m);
        }
    }

    bot.onText(/\/getcode/, async (m) => {
        getCode(m);
    })

    bot.onText(/\/me/, async (m) => {
        try {
            StatisticManager.add('/me');
            var usr = await UserDatabase.getUser(m.from.id);

            bot.sendMessage(m.from.id,
                `Идентефикатор: ${usr.id}\nСчёт: ${usr.scoring}`);
           } catch (e) {
            reportError(e, m);
        }
    });

    bot.onText(/\/payment/, async (m) => {
        try {
            StatisticManager.add('/payment');
            bot.sendMessage(m.from.id, config.payment_message.replace('$usr_id$', '`' + m.from.id + '`'), {
                parse_mode: 'Markdown',
            });
        } catch (e) {
            reportError(e, m);
        }
    });

    var proxyRegexp = /\/proxy (add|remove) ([0-9\.]{1,}):(\d{4,6})/;
    bot.onText(proxyRegexp, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);

            if (usr != undefined) {
                if (usr.isAdmin) {
                    var r = proxyRegexp.exec(m.text);
                    var action = r[1];
                    var ip = r[2];
                    var port = r[3];
                    if (action == 'add') {
                        addProxy(`${ip}:${port}`);
                    } else {
                        removeProxy(`${ip}:${port}`);
                    }

                    bot.sendMessage(m.from.id, 'Успешно');
                }
            }
        } catch (e) {
            reportError(e, m);
        }
    })

    bot.onText(/\/listProxy/, async (m) => {
        var usr = await UserDatabase.getUser(m.from.id);
        if (usr.isAdmin) {
            var s = proxies.map((e) => `${e}\n`).join('');
            bot.sendMessage(m.chat.id, s == '' ? 'Пусто' : s);
        }
    });

    bot.onText(/\/stat/, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);
            console.log(usr);
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
        } catch (e) {
            reportError(e, m);
        }
    });

    var appointRequests: string[] = [];

    var admRegex = /\/usr2adm (\d{6})/;
    bot.onText(admRegex, async (m) => {
        try {
            var code = admRegex.exec(m.text)[1];
            if (appointRequests.includes(code)) {
                appointRequests.splice(appointRequests.indexOf(code), 1);
                var usr = await UserDatabase.getUser(m.from.id);

                if (usr == undefined) {
                    UserDatabase.editUser({
                        id: m.from.id,
                        isAdmin: true,
                        scoring: usr.scoring,
                    })
                } else {
                    if (usr.isAdmin) {
                        bot.sendMessage(m.from.id, 'Вы уже админ. Ваше приглашение деактивировано');
                        return;
                    }
                    await UserDatabase.editUser({ ...usr, isAdmin: true });
                }
                bot.sendMessage(m.from.id, 'Вам успешно выдана административная должность');
            }
        } catch (e) {
            reportError(e, m);
        }
    });

    bot.onText(/\/logout/, async (m) => {
        try {
            StatisticManager.add('/logout');
            var usr = await UserDatabase.getUser(m.from.id);

            if (usr != undefined) {
                UserDatabase.removeUser(usr);
                bot.sendMessage(m.chat.id, 'Мы вас не знаем и вы нас не знаете.');
            }
        } catch (e) {
            reportError(e, m);
        }
    });

    bot.onText(/\/appoint/, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);
            if (usr != undefined) {
                if (usr.isAdmin) {
                    var code = Math.floor(100000 + Math.random() * 900000);
                    appointRequests.push(code.toString());

                    bot.sendMessage(m.chat.id, 'Чтобы назначить нового админа кандидат должен отправить следующюю команду боту: `/usr2adm ' + code + '`',
                        { parse_mode: 'MarkdownV2' });
                }
            }
        } catch (e) {
            reportError(e, m);
        }
    });

    var givePointsRegex = /\/give (\d* \d* ?(.*)?)/;
    bot.onText(givePointsRegex, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);

            if (usr != undefined) {
                if (usr.isAdmin) {
                    var s = givePointsRegex.exec(m.text)[1].split(' ');
                    var to = parseInt(s[0]);
                    var amount = parseInt(s[1]);
                    var msg = m.text.includes(',') ? m.text.substring(m.text.indexOf(',') + 1) : null;
                    var toUser = await UserDatabase.getUser(to);
                    if (toUser) {
                        await UserDatabase.editUser({ ...toUser, scoring: toUser.scoring + amount });
                        bot.sendMessage(m.from.id, 'Сумма успешно начислена');
                        var p = `На Ваш счёт начислено ${amount} баллов`;
                        if (msg != null) p += `\nСообщение от администратора: ${msg}`;
                        bot.sendMessage(to, p);
                    } else {
                        bot.sendMessage(m.from.id, 'Данного пользователя нету в базе данных');
                    }
                }
            }
        } catch (e) {
            reportError(e, m);
        }
    });
}