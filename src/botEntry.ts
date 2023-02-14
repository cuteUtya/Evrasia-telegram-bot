import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { EvrasiaAccountsManager } from "./evrasia-accounts-manager";
import { EvrasiaApi, RequestResult, RestaurantAdress, userData } from "./evrasia-api";
import { addProxy, proxies, removeProxy } from "./proxy-manager";
import { RunTimeVariablesManager } from "./runtime-variables-manager";
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

    //some kind of cringe coding
    bot.on('text', (m) => addUserToDB(m));

    bot.onText(/\/start/, async (m) => {
        try {
            StatisticManager.add('/start');
            if (await UserDatabase.getUser(m.from.id) == null) {
                addUserToDB(m);
                getCode(m.from.id);
            }
        } catch (e) { reportError(e, m) }
    });

    bot.onText(/\/support/, async (m) => {
        try {
            StatisticManager.add('/support');
            bot.sendMessage(m.from.id, RunTimeVariablesManager.read('support_message'), {
                reply_markup: getGetCodeMarkdown(m.from.id)
            });
        } catch (e) {
            reportError(e, m);
        }
    });

    var bot_adresses: RestaurantAdress[] = [];


    function getGetCodeMarkdown(id): TelegramBot.InlineKeyboardMarkup {
        return {
            inline_keyboard: [
                [{ text: 'Получить код', callback_data: `startCode#${id}` }]
            ]
        }
    }

    async function addUserToDB(m: TelegramBot.Message) {
        if (await UserDatabase.getUser(m.from.id) == null) {
            await UserDatabase.writeUser({ id: m.from.id, isAdmin: false, scoring: 0, codeUsed: 0 });
            bot.sendMessage(m.from.id, 'Теперь вы авторизованы');
        }
    }

    var variablesRegex = /\/value set ([a-zA-Z_0-9]{1,}) (.*)/;
    bot.onText(variablesRegex, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);

            if (usr.isAdmin) {
                var r = variablesRegex.exec(m.text);
                RunTimeVariablesManager.write(r[1], r[2].replace(/\\n/g, '\n'));
                bot.sendMessage(m.from.id, `Установлено значение ${r[2]} для ${r[1]}`);
            }
        } catch (e) {
            reportError(e, m);
        }
    })

    bot.onText(/\/accountstats/, async (m) => {
        try {
            var usr = await UserDatabase.getUser(m.from.id);

            if (usr.isAdmin) {
                var d: RequestResult<userData>[] = [];

                for (var i = 0; i < EvrasiaAccountsManager.accounts.length; i++) {
                    d.push(await EvrasiaApi.GetAccountData(EvrasiaAccountsManager.accounts[i]));
                }
                var aviable = d.filter((e) => e.ok);
                var s: string = '';
                s += `Доступные аккаунты: ${aviable.length}/${d.length}\n`;
                s += aviable.map((e) => `${'*'.repeat(20)}\nИмя: ${e.result.name}\nТелефон: ${e.result.phone}\nКарты: ${e.result.cards}\nБаллы: ${e.result.points}\nКод для списание: ${e.result.pointsCode} \n`).join('');

                bot.sendMessage(m.from.id, s);
                //var r = variablesRegex.exec(m.text);
                //RunTimeVariablesManager.write(r[1], r[2]);
                //bot.sendMessage(m.from.id, `Установлено значение ${r[2]} для ${r[1]}`);
            }
        } catch (e) {
            reportError(e, m);
        }
    });

    var accRegex = /\/account add (.*) (.*)/;
    bot.onText(accRegex, async (m) => {
        try {
            var d = accRegex.exec(m.text);
            await EvrasiaAccountsManager.add(d[1], d[2]);
            bot.sendMessage(m.from.id, 'Успешно');
        } catch (e) {
            reportError(e, m);
        }
    })

    function getBonusVariants(): Array<any> {
        return JSON.parse(RunTimeVariablesManager.read('bonus_variants')) as Array<any>;
    }

    async function doActivateAdditionalDiscount(index: number, userId: number) {
        var usr = await UserDatabase.getUser(userId);

        var r = getBonusVariants();
        if(usr) {
          if(usr.scoring < r[index].price) {
            bot.sendMessage(userId, RunTimeVariablesManager.read('slish_plati_msg'));
          }  else {
            bot.sendMessage(userId, RunTimeVariablesManager.read('succesfull_additional_bonuses'));
          }
        }
    }

    function doAdditionalDiscount(userId: number) {
        var r = getBonusVariants();
        bot.sendMessage(userId, RunTimeVariablesManager.read('how_much_bonuses_u_want_to_use_msg'), {
            reply_markup: {
                inline_keyboard: 
                    r.map((e) => {
                        return [{
                            text: `${e.min} — ${e.max == undefined ? 'больше' : e.max} (${e.price})`,
                            callback_data: `activateAdditionalDiscount#${r.indexOf(e)}#${userId}`
                        }]
                    })        
            }
        })
    }

    bot.on('callback_query', async (q) => {
        console.log(q.data);
        var adressQuery = /getCode#(\d*)#(\d*)/.exec(q.data);
        var getCodeQuery = /startCode#(\d*)/.exec(q.data);
        var getAdditionalDiscount = /getAdditionalDiscount#(\d*)/.exec(q.data);
        var activateAdditionalDiscount = /activateAdditionalDiscount#(\d*)#(\d*)/.exec(q.data);


        function answer() {
            bot.answerCallbackQuery(q.id);
        }

        if(activateAdditionalDiscount != null) {
            doActivateAdditionalDiscount(
                parseInt(activateAdditionalDiscount[1]), 
                parseInt(activateAdditionalDiscount[2])
            );
            answer();
        }

        if(getAdditionalDiscount != null) {
            doAdditionalDiscount(parseInt(getAdditionalDiscount[1]));
            answer();
        }

        if (getCodeQuery != null) {
            getCode(parseInt(getCodeQuery[1]));
            answer();
        }

        if (adressQuery != null) {
            if (adressQuery.length == 3) {
                var code = parseInt(adressQuery[1]);

                try {
                    await bot.deleteMessage(q.message.chat.id, q.message.message_id.toString());
                    await bot.answerCallbackQuery(q.id, {});
                } catch (e) {
                    //query can be just too old so ignore it 
                }

                var discountCode = await EvrasiaApi.ActivateCode(code, q.from.id);

                console.log(discountCode);

                if (discountCode.ok) {
                    var restName = bot_adresses.find((e) => e.index == code).name;
                    var yourCode = discountCode.result;
                    var str = RunTimeVariablesManager.read('code_succesfull_message').toString();
                    str = str.replace('@restName@', restName)
                        .replace('@code@', yourCode)
                        .replace('@time@', RunTimeVariablesManager.read('adress_reserve_time_minutes'));
                    await bot.sendMessage(q.from.id, str, {reply_markup: {
                        inline_keyboard: [
                            [{text: RunTimeVariablesManager.read('i_want_additional_discount'), callback_data: `getAdditionalDiscount#${q.from.id}`}]
                        ]
                        }
                });
                } else {
                    await bot.sendMessage(q.from.id, `На данный момент по данному адресу невозможно получить код`);
                }
            }
            answer();
        }
    });

    async function getCode(userId: number) {
        try {
            StatisticManager.add('/getcode');
            var usr = await UserDatabase.getUser(userId);

            var adresess = await EvrasiaApi.GetAdresess();
            if (adresess.ok && adresess.result != undefined) {
                //TODO change this logic if users can have diff adresses 
                bot_adresses = adresess.result;


                var objs = adresess.result.map((e) => {
                    return {
                        text: e.name,
                        callback_data: `getCode#${e.index}#${userId}`,
                    }
                });
                var e = [];

                for (var i = 0; i < objs.length; i += 2) {
                    if (objs[i + 1] != undefined) e.push([objs[i], objs[i + 1]]);
                    else e.push([objs[i]]);
                }

                bot.sendMessage(userId, RunTimeVariablesManager.read('choose_adress'), {
                    reply_markup: {
                        inline_keyboard: e
                    }
                });
            } else {
                //todo user should login
            }

        } catch (e) {
            //reportError(e, userId);
        }
    }

    var infoReg = /\/info (\d*)/;
    bot.onText(infoReg, async (m) => {
        if ((await UserDatabase.getUser(m.from.id)).isAdmin) {
            bot.sendMessage(m.chat.id, JSON.stringify(await UserDatabase.getUser(parseInt(infoReg.exec(m.text)[1]))), {
                reply_to_message_id: m.message_id
            });
        }

    });

    bot.onText(/\/getcode/, async (m) => {
        getCode(m.from.id);
    })

    bot.onText(/\/me/, async (m) => {
        try {
            StatisticManager.add('/me');
            var usr = await UserDatabase.getUser(m.from.id);

            bot.sendMessage(m.from.id,
                `Идентефикатор: ${usr.id}\nСчёт: ${usr.scoring}`, {
                reply_markup: getGetCodeMarkdown(m.from.id)
            });
        } catch (e) {
            reportError(e, m);
        }
    });

    bot.onText(/\/payment/, async (m) => {
        try {
            StatisticManager.add('/payment');
            bot.sendMessage(m.from.id, RunTimeVariablesManager.read('payment_message').replace('$usr_id$', '`' + m.from.id + '`'), {
                parse_mode: 'Markdown',
                reply_markup: getGetCodeMarkdown(m.from.id)
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
            if (usr != undefined) {
                if (usr.isAdmin) {
                    bot.sendMessage(m.from.id, `Всего баллов на счетах: ${await UserDatabase.ScoringSumm()}
Всего пользователей: ${await UserDatabase.TotalUsers()}
${Array.from(StatisticManager.statPerCommand.entries()).map((e, i) => {
                        var command = e[0];
                        var stat = e[1];

                        var v = '—'.repeat(15);
                        v += '\n';
                        v += '`' + `${command}` + '`\n';
                        v += `Отправлено за последний час: ${stat.hourStat}\n`;
                        v += `Отправлено за последний день: ${stat.dayStat}\n`;
                        v += `Отправлено за последнюю неделю: ${stat.weekStat}\n`;
                        v += `Отправлено за всё время: ${stat.totalStat}\n`;

                        return v;
                    }).join('')}
`, { parse_mode: 'Markdown' });
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
                        codeUsed: 0,
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