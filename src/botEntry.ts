import TelegramBot from "node-telegram-bot-api";
import { config } from "./config";
import { EvrasiaAccountsManager, loginData } from "./evrasia-accounts-manager";
import { EvrasiaApi, RequestResult, RestaurantAdress, userData } from "./evrasia-api";
import { getLogs, makeLog } from "./logger";
import { addProxy, proxies, removeProxy } from "./proxy-manager";
import { RunTimeVariablesManager } from "./runtime-variables-manager";
import { StatisticManager } from "./statistic-manager";
import { someKindOfDebugging } from "./types/debug";
import { getRandomUserAgent } from "./user-agents";
import { UserDatabase } from "./user-database";

export function changeBalance(userid: number, amount: number) {
    makeLog(userid, `Баланс изменён: ${amount}`);
    UserDatabase.getUser(userid).then((toUser) => {
        makeLog(userid, `Баланс: ${toUser.scoring + amount}`);
        UserDatabase.editUser({ ...toUser, scoring: toUser.scoring + amount }).then(() => { });
    });
}

export function run() {
    someKindOfDebugging();
    const token = config.bottoken;
    const bot = new TelegramBot(token, { polling: true });

    function reportError(err: Error, context: TelegramBot.Message) {
        try {
            bot.sendMessage(context.chat.id, err.message, {
                reply_to_message_id: context.message_id,
            });
        } catch (e) { }
    }

    //some kind of cringe-coding
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

    var payWaiters = [];

    async function checkDiscountCode(arr, data, msg_unused) {
        var newScore = await EvrasiaApi.GetAccountData(data.account);

        if (newScore.ok) {
            makeLog(data.userId, `Счёт аккаунта ${data.account.phone}: ${newScore.result.points}`);
            if (parseInt(newScore.result.points) != data.score) {
                var usedScore = (data.score - parseInt(newScore.result.points)).toString();
                makeLog(data.userId, `Зафиксирована разница ${usedScore}`);
                payWaiters.push({
                    userId: data.userId,
                    balanceSaldo: usedScore,
                });
                bot.sendMessage(data.userId, RunTimeVariablesManager.read('discount_used'));

                makeLog(data.userId, `Запрос у пользователя кол-во использованных баллов`);

                setTimeout(() => {
                    var payed = true;
                    payWaiters = payWaiters.filter((e) => {
                        if (e.userId == data.userId) {
                            payed = false;
                        }

                        return e.userId != data.userId;
                    });
                    if (payed) {
                        for (var i = 0; i < payWaiters.length; i++) {
                            if (payWaiters[i].payed) {
                                //
                            } else {
                                makeLog(data.userId, `Запрос был проигнорирован пользователем. Списываем весь залог: ${data.planPrice}`);
                                changeBalance(data.userId, -(data.planPrice));
                                bot.sendMessage(data.userId, `С вашего счёта снято ${(data.planPrice)}`);
                            }
                        }
                    }
                }, 60 * 1000 * parseInt(RunTimeVariablesManager.read('discount_pay_if_not_did')));
                cleanUsedAccountAdditionalDiscount(usedAccountsForAdditionalDiscount, data.userId);
            } else {
                makeLog(data.userId, 'Разница не зафиксирована')
                bot.sendMessage(data.userId, RunTimeVariablesManager.read(msg_unused));
            }
        }
    }

    async function doActivateAdditionalDiscount(index: number, userId: number) {
        var usr = await UserDatabase.getUser(userId);

        for (var x = 0; x < usedAccountsForAdditionalDiscount.length; x++) {
            if (usedAccountsForAdditionalDiscount[x].userId != userId) {
                makeLog(userId, `Отказ: попытка взять второй код`);
                bot.sendMessage(userId, RunTimeVariablesManager.read('discount_already').replace('@code@', usedAccountsForAdditionalDiscount[x].code));
                return;
            }
        }

        var r = getBonusVariants();
        var thisPrice = r[index].price
        makeLog(userId, `Выбрано предложение стоимостью ${r[index].price}, от ${r[index].min} до ${r[index].max}`);
        makeLog(userId, `Баланс пользователя: ${usr.scoring}`);
        if (usr) {
            if (usr.scoring < thisPrice) {
                bot.sendMessage(userId, RunTimeVariablesManager.read('slish_plati_msg'));
                makeLog(userId, 'Отказ: недостаток средств');
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
                            var obj = {
                                userId: userId,
                                code: code.result.pointsCode,
                                account: account,
                                score: parseInt(code.result.points),
                                planPrice: thisPrice,
                            };
                            usedAccountsForAdditionalDiscount.push(obj);


                            var msg = RunTimeVariablesManager.read(`succesfull_additional_bonuses`);
                            msg = msg.replace("@code@", code.result.pointsCode);
                            var data = `pay_for_additional`
                            makeLog(userId, `Отдан пин-код ${code.result.pointsCode}, аккаунт ${code.result.phone}, счёт ${code.result.points}`);
                            bot.sendMessage(userId, msg, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: "Я оплатил", callback_data: data }]
                                    ]
                                }
                            });

                            var arr = usedAccountsForAdditionalDiscount;

                            setTimeout(() => {
                                for (var i = 0; i < arr.length; i++) {
                                    if (arr[i].userId == obj.userId) {
                                        makeLog(userId, `Проверка счёта аккаунта ${obj.account.phone}`)
                                        checkDiscountCode(arr, obj, 'discount_unused_end').then((_) => {
                                            cleanUsedAccountAdditionalDiscount(arr, obj.userId);
                                        });
                                    }
                                }
                            },
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
        makeLog(userId, `Запрос на дополнительную скидку`);
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

    bot.onText(/\d*/, async (m) => {
        for (var i = 0; i < payWaiters.length; i++) {
            if (payWaiters[i].userId == m.from.id) {
                var amount = parseInt(m.text);
                makeLog(m.from.id, `Введенённое пользователем значение использованных балов: ${amount}`);
                makeLog(m.from.id, `Соотношение введённое_кол-во/фактическое_кол-во: ${(amount / payWaiters[i].balanceSaldo)}`);
                if ((amount / payWaiters[i].balanceSaldo) >= 0.95) {
                    makeLog(m.from.id, `Успешно: соотношение >= 0.95`);
                    changeBalance(m.from.id, -(amount / 2));
                    bot.sendMessage(m.from.id, `Хорошо. С вашего счёта снято ${amount / 2}`);
                } else {
                    makeLog(m.from.id, `ОТКАЗ: соотношение < 0.95`);
                    bot.sendMessage(m.from.id, 'Введённая вами сума сильно отличаеться от фактической. Отправьте в поддержку фото чека');
                }

                payWaiters.splice(i, 1);
            }
        }
    });

    bot.on('callback_query', async (q) => {
        var adressQuery = /getCode#(\d*)/.exec(q.data);
        var getCodeQuery = /startCode#(\d*)/.exec(q.data);
        var getAdditionalDiscount = /getAdditionalDiscount/.exec(q.data);
        var activateAdditionalDiscount = /activateAdditionalDiscount#(\d*)#(\d*)/.exec(q.data);
        var askForAdditionalDiscount = /wanna_additional_discount#(\d*)/.exec(q.data);
        var cardAdress = /offer_card#(.*)/.exec(q.data);
        var rejectadditionaldiscount = /rejectadditionaldiscount/.exec(q.data);
        var ipayed = /pay_for_additional/.exec(q.data);


        function answer() {
            try {
                bot.answerCallbackQuery(q.id);
            } catch (e) { }
        }

        function deleteThisMessage() {
            bot.deleteMessage(q.from.id, q.message.message_id.toString());
        }

        if (ipayed != null) {
            makeLog(q.from.id, 'Нажата кнопка "Я оплатил"');
            for (var i = 0; i < usedAccountsForAdditionalDiscount.length; i++) {
                if (usedAccountsForAdditionalDiscount[i].userId == q.from.id) {
                    checkDiscountCode(usedAccountsForAdditionalDiscount, usedAccountsForAdditionalDiscount[i], 'discount_unused_second_chance');
                }
            }
            //checkDiscountCode(usedAccountsForAdditionalDiscount, JSON.parse(ipayed[1]));
            /*for(var l = 0; l < payWaiters.length; l++) {
                if(payWaiters[l].userId == q.from.id) {
                    payWaiters[l] = {...payWaiters[l].userId, payed: true};
                    bot.sendMessage(q.from.id, 'Введите потраченную сумму');
                }
            }*/
            answer();
        }

        if(cardAdress != null) {
            doCardOffer(parseInt(cardAdress[1]), q.from.id);
            deleteThisMessage();
            answer();
        } 

        if (activateAdditionalDiscount != null) {
            for (var i = 0; i < usedAccountsForAdditionalDiscount.length; i++) {
                if (usedAccountsForAdditionalDiscount[i].userId == q.from.id) {
                    makeLog(q.from.id, `Отказ по причине: наличие активного кода`);
                    bot.sendMessage(q.from.id, RunTimeVariablesManager.read('discount_code_flood'));
                    return;
                }
            }

            doActivateAdditionalDiscount(
                parseInt(activateAdditionalDiscount[1]),
                parseInt(activateAdditionalDiscount[2])
            );
            deleteThisMessage();
            answer();
        }

        if (rejectadditionaldiscount != null) {
            makeLog(q.from.id, 'Отказ от доп. скидки');
            cleanUsedAccountAdditionalDiscount(usedAccountsForAdditionalDiscount, q.from.id);
            bot.sendMessage(q.from.id, RunTimeVariablesManager.read('on_code_was_rejected'));
            deleteThisMessage();
            answer();
        }

        if (getAdditionalDiscount != null) {
            doAdditionalDiscount(q.from.id);
            deleteThisMessage();
            answer();
        }

        if (getCodeQuery != null) {
            getCode(parseInt(getCodeQuery[1]));
            deleteThisMessage();
            answer();
        }

        if (askForAdditionalDiscount != null) {
            makeLog(q.from.id, `Выбран адрес, предложение взять дополнительную скидку`);
            bot.sendMessage(q.message.chat.id, RunTimeVariablesManager.read('wanna_additional_discount'),
                {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "Хочу", callback_data: 'getAdditionalDiscount' },
                            { text: "Нет спасибо", callback_data: `getCode#${askForAdditionalDiscount[1]}` }]
                        ]
                    }
                });

            deleteThisMessage();
            answer();
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
                makeLog(q.from.id, `Отдан код ${yourCode} на адресс ${restName}`);
                await bot.sendMessage(q.from.id, str);
            } else {
                await bot.sendMessage(q.from.id, `На данный момент по данному адресу невозможно получить код`);
            }

            deleteThisMessage();
            answer();
        }
    });

    async function getCode(userId: number) {
        makeLog(userId, '/getCode');
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

                makeLog(userId, 'Отданы адреса');
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
        try {
            if ((await UserDatabase.getUser(m.from.id)).isAdmin) {
                var usr = await UserDatabase.getUser(parseInt(infoReg.exec(m.text)[1]));
                bot.sendMessage(m.chat.id, `Счёт: ${usr.scoring}\nИспользовано кодов: ${usr.codeUsed}\nПоследние 100 строк логов:\n${getLogs(usr.id, 100)}`/*JSON.stringify())*/, {
                    reply_to_message_id: m.message_id
                });
            }
        } catch (e) {
            reportError(e, m);
        }
    });

    bot.onText(/\/setasroot/, async (m) => {
        var from = await UserDatabase.getUser(m.from.id);
        if (from.isAdmin) {
            RunTimeVariablesManager.write('rootid', m.chat.id);
            bot.sendMessage(m.chat.id, 'Теперь этот чат будет использован для обработки пользовательских запросов', {
                reply_to_message_id: m.message_id
            })
        }
    });

    bot.onText(/\/getcode/, async (m) => {
        getCode(m.from.id);
    })

    bot.onText(/\/me/, async (m) => {
        try {
            makeLog(m.from.id, '/me');
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
            makeLog(m.from.id, '/payment');
            StatisticManager.add('/payment');
            bot.sendMessage(m.from.id, RunTimeVariablesManager.read('payment_message').replace('$usr_id$', '`' + m.from.id + '`'), {
                parse_mode: 'Markdown',
                reply_markup: getGetCodeMarkdown(m.from.id)
            });
        } catch (e) {
            reportError(e, m);
        }
    });

    var cardOffers = [];

    async function doCardOffer(card: number, userId: number){ 
        var adresess = await EvrasiaApi.GetAdresess();
        bot_adresses = adresess.result;
        var cardInfo: RestaurantAdress;

        for(var i = 0; i < bot_adresses.length; i++) {
            if(bot_adresses[i].index == card){ 
                cardInfo = bot_adresses[i];
            }
        }
        
        cardOffers.push({
            userId: userId, 
            adress: cardInfo.name,
        });

        makeLog(userId, 'Выбран адресс для доставки карты ' + cardInfo.name);
        bot.sendMessage(userId, 'В какое время вам будет удобно получить карту? Ваше сообщение будет обработано вручную администратором');
        
        //
        //bot.sendMessage(userId, `Вы выбрали ${cardInfo.name}. В скором времени ваш запрос будет обработан.`);
    }

    bot.onText(/.*/, (m) => {
        for(var i = 0; i < cardOffers.length; i++) {
            if(cardOffers[i].userId == m.from.id) {
                makeLog(m.from.id, `Успешная заявка на доставку карты. Адресс: ${cardOffers[i].adress}, время: ${m.text}`);
                bot.sendMessage(m.from.id, `Ваша заявка успешно создана\nАдресс: ${cardOffers[i].adress}\nВремя: ${m.text}.\nДля деталей доставки обратитесь в поддержку /support`);
                bot.sendMessage(RunTimeVariablesManager.read('rootid'), `Пользователь ${m.from.id} (${m.from.first_name} + ${m.from.last_name == undefined ? '': m.from.last_name}) заказал карту. \nНа адрес ${cardOffers[i].adress}.\nВремя доставки: «${m.text}»`);      
                cardOffers.splice(i, 1);
                break;
            }
        }
    });

    async function getCard(m: TelegramBot.Message) {
        makeLog(m.from.id, '/getcard');
        var adresess = await EvrasiaApi.GetAdresess();
        bot_adresses = adresess.result;
        var objs = adresess.result.map((e) => {
            return {
                text: e.name,
                callback_data: `offer_card#${e.index}`,
            }
        });
        var e = [];

        for (var i = 0; i < objs.length; i += 2) {
            if (objs[i + 1] != undefined) e.push([objs[i], objs[i + 1]]);
            else e.push([objs[i]]);
        }

        bot.sendMessage(m.from.id, 'Выберите адрес доставки', {
            reply_markup: {
                inline_keyboard: e,
            }
        });
    }

    bot.onText(/\/getcard/, (m) => {
        try {
            getCard(m);
        } catch (e) {
            reportError(e, m);
        }
    })

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
                        changeBalance(toUser.id, amount);
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