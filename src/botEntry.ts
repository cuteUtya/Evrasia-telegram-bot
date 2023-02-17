import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { EvrasiaAccountsManager, loginData } from "./evrasia-accounts-manager";
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

    var usedAccountsForAdditionalDiscount: Array<any> = [];


    function cleanUsedAccountAdditionalDiscount(arr, id) {
        for (var i = 0; i < usedAccountsForAdditionalDiscount.length; i++) {
            if (usedAccountsForAdditionalDiscount[i].userId == id) {
                usedAccountsForAdditionalDiscount.splice(i, 1)
                break;
            }
        }
    }

    async function checkDiscountCode(arr, forceRemove, user_id, account, score) {
        var newScore = await EvrasiaApi.GetAccountData(account);

        if (forceRemove) cleanUsedAccountAdditionalDiscount(arr, user_id);

        if (newScore.ok) {
            if (parseInt(newScore.result.points) != score) {
                var usedScore = (score - parseInt(newScore.result.points)).toString();
                bot.sendMessage(user_id, RunTimeVariablesManager.read('discount_used').replace('@used@', usedScore));
                cleanUsedAccountAdditionalDiscount(usedAccountsForAdditionalDiscount, user_id);
            } else {
                if (!forceRemove) {
                    bot.sendMessage(user_id, RunTimeVariablesManager.read('discount_unused'), {
                        reply_markup: {
                            inline_keyboard: [
                                [{
                                    text: 'Да, я ещё в ресторане',
                                    callback_data: 'waitadditionalfordiscount'
                                }],
                                [
                                    {
                                        text: 'Нет, я не буду пользоваться кодом',
                                        callback_data: 'rejectadditionaldiscount'
                                    }
                                ]
                            ]
                        }
                    });
                } else {
                    bot.sendMessage(user_id, RunTimeVariablesManager.read('discount_unused_second_chance'));
                }
                if (!forceRemove) {
                    setTimeout(cleanUsedAccountAdditionalDiscount, 1000 * 60 * parseInt(RunTimeVariablesManager.read('discount_code_unused_terminate_timeout')))
                }
            }
        }
    }

    async function doActivateAdditionalDiscount(index: number, userId: number) {
        var usr = await UserDatabase.getUser(userId);

        for (var x = 0; x < usedAccountsForAdditionalDiscount.length; x++) {
            if (usedAccountsForAdditionalDiscount[x].userId != userId) {
                bot.sendMessage(userId, RunTimeVariablesManager.read('discount_already').replace('@code@', usedAccountsForAdditionalDiscount[x].code));
                return;
            }
        }

        var r = getBonusVariants();
        if (usr) {
            if (usr.scoring < r[index].price) {
                bot.sendMessage(userId, RunTimeVariablesManager.read('slish_plati_msg'));
            } else {
                var aks = EvrasiaAccountsManager.read();
                if (usedAccountsForAdditionalDiscount.length >= aks.length) {
                    //fail, no account
                } else {
                    var account: loginData;
                    for (var i = 0; i < aks.length; i++) {
                        var used = false;
                        for (var d = 0; d < usedAccountsForAdditionalDiscount.length; d++) {
                            if (aks[i].phone == usedAccountsForAdditionalDiscount[d].account.phone) {
                                used = true;
                            }
                        }

                        if (!used) {
                            account = aks[i];
                            break;
                        }
                    }

                    if (account) {
                        var code = await EvrasiaApi.GetAccountData(account);
                        if (code.ok) {
                            var msg = RunTimeVariablesManager.read('succesfull_additional_bonuses');
                            msg = msg.replace("@code@", code.result.pointsCode);
                            bot.sendMessage(userId, msg);

                            var obj = {
                                userId: userId,
                                code: code.result.pointsCode,
                                account: account,
                                score: undefined,
                            };
                            usedAccountsForAdditionalDiscount.push(obj);

                            var arr = usedAccountsForAdditionalDiscount;
                            var score = parseInt(code.result.points);
                            obj.score = score;

                            setTimeout(() => checkDiscountCode(arr, false, obj.userId, account, score),
                                1000 * 60 * parseInt(RunTimeVariablesManager.read('discount_code_time_check_minutes')), [
                            ])

                            return;
                        }
                    }
                }
                bot.sendMessage(userId, RunTimeVariablesManager.read('discount_fail'));
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
        var adressQuery = /getCode#(\d*)/.exec(q.data);
        var getCodeQuery = /startCode#(\d*)/.exec(q.data);
        var getAdditionalDiscount = /getAdditionalDiscount/.exec(q.data);
        var activateAdditionalDiscount = /activateAdditionalDiscount#(\d*)#(\d*)/.exec(q.data);
        var askForAdditionalDiscount = /wanna_additional_discount#(\d*)/.exec(q.data);
        var rejectadditionaldiscount = /rejectadditionaldiscount/.exec(q.data);
        var waitadditionalfordiscount = /waitadditionalfordiscount/.exec(q.data);


        function answer() {
            try {
                bot.answerCallbackQuery(q.id);
            } catch (e) { }
        }

        if (activateAdditionalDiscount != null) {
            for(var i = 0; i < usedAccountsForAdditionalDiscount.length; i++) {
                if(usedAccountsForAdditionalDiscount[i].userId == q.from.id) {
                    bot.sendMessage(q.from.id, RunTimeVariablesManager.read('discount_code_flood'));
                    return;
                }
            }

            doActivateAdditionalDiscount(
                parseInt(activateAdditionalDiscount[1]),
                parseInt(activateAdditionalDiscount[2])
            );
            answer();
        }

        if (waitadditionalfordiscount != null) {
            var d;

            for (var l = 0; l < usedAccountsForAdditionalDiscount.length; l++) {
                if (usedAccountsForAdditionalDiscount[l].userId == q.from.id) d = usedAccountsForAdditionalDiscount[l];
            }

            if (d != undefined) {
                setTimeout(function () {
                    checkDiscountCode(usedAccountsForAdditionalDiscount, true, q.from.id, d.account, d.score);
                }, 60 * 1000 * parseInt(RunTimeVariablesManager.read('extra_time_for_ununused_discount')));
            }

            bot.sendMessage(q.from.id, RunTimeVariablesManager.read('additional_discount_extra_time_succesful'))
            answer();
        }

        if (rejectadditionaldiscount != null) {
            cleanUsedAccountAdditionalDiscount(usedAccountsForAdditionalDiscount, q.from.id);
            bot.sendMessage(q.from.id, RunTimeVariablesManager.read('on_code_was_rejected'));
            answer();
        }

        if (getAdditionalDiscount != null) {
            doAdditionalDiscount(q.from.id);
            answer();
        }

        if (getCodeQuery != null) {
            getCode(parseInt(getCodeQuery[1]));
            answer();
        }

        if (askForAdditionalDiscount != null) {
            await bot.deleteMessage(q.message.chat.id, q.message.message_id.toString());
            bot.sendMessage(q.message.chat.id, RunTimeVariablesManager.read('wanna_additional_discount'),
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Хочу", callback_data: 'getAdditionalDiscount' },
                            { text: "Нет спасибо", callback_data: `getCode#${askForAdditionalDiscount[1]}` }]
                        ]
                    }
                });
        }

        if (adressQuery != null) {
            var code = parseInt(adressQuery[1]);

            await bot.deleteMessage(q.message.chat.id, q.message.message_id.toString());
            answer();

            var discountCode = await EvrasiaApi.ActivateCode(code, q.from.id);

            console.log(discountCode);

            if (discountCode.ok) {
                var restName = bot_adresses.find((e) => e.index == code).name;
                var yourCode = discountCode.result;
                var str = RunTimeVariablesManager.read('code_succesfull_message').toString();
                str = str.replace('@restName@', restName)
                    .replace('@code@', yourCode)
                    .replace('@time@', RunTimeVariablesManager.read('adress_reserve_time_minutes'));
                //bruh wait 
                await bot.sendMessage(q.from.id, str);
            } else {
                await bot.sendMessage(q.from.id, `На данный момент по данному адресу невозможно получить код`);
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
                        callback_data: `wanna_additional_discount#${e.index}`,
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
                        bot.sendMessage(m.from.id, 'Операция прошла успешно');
                        var p = amount < 0 ? `С вашего счёта снято ${-amount} баллов` : `На Ваш счёт начислено ${amount} баллов`;
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