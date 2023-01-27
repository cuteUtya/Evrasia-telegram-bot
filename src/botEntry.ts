import TelegramBot from "node-telegram-bot-api";
import { EvrasiaApi, RestaurantAdress } from "./evrasia-api";
import { getRandomUserAgent } from "./user-agents";
import { UserDatabase } from "./user-database";

export function run() {
    const token = '5847860544:AAFBsw2RNB0k5D-hyOEuiqtrEFOAIG6u3mU';
    const bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, async (m) => {
        if (await UserDatabase.getUser(m.from.id) == null) {
            await bot.sendMessage(m.chat.id, 'Отправьте команду /login для авторизации');
        } else {
            await bot.sendMessage(m.chat.id, 'Ви уже авторизаванный пользователь. Чтобы войти в другой аккаунт отправьте команду /logout, а затем /login');
        }
    });


    function findUserInLoginRequest(userId: number): loginRequest {
        var r = loginRequests.find((d) => d.id == userId);
        if (r) return null;
        return r;
    }


    var loginRequests: Array<loginRequest> = [];
    bot.onText(/\/login/, async (m) => {
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
        console.log(q.data);
        var adressQuery = /getCode#(\d*)#(\d*)/.exec(q.data);

        console.log(adressQuery.length);

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
        if (usersThatChoosesCode.includes(m.from.id)) {
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

    bot.onText(/\+[0-9]{11}/, (m) => {
        var r = findUserInLoginRequest(m.from.id);
        if (r != undefined) {
            r.phone = m.text;
            r.phoneMessageId = m.message_id;
            bot.sendMessage(r.id, 'Теперь ввидете ваш пароль');
        }
    });

    bot.onText(/\/stopword/, (m) => {
        var r = findUserInLoginRequest(m.from.id);

        if (r != undefined) {
            loginRequests.splice(loginRequests.indexOf(r), 1);
            bot.sendMessage(m.from.id, 'Процесс остановлен. Введите команду /login повторно')
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
                    await UserDatabase.writeUser({
                        id: m.from.id,
                        cookies: JSON.stringify(result.result),
                        isAdmin: false,
                        userAgent: agent,
                    });
                    //await UserDatabase.editUser(usr);
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