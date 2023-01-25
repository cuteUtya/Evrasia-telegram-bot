import TelegramBot from "node-telegram-bot-api";
import { EvrasiaApi } from "./evrasia-api";
import { getRandomUserAgent } from "./user-agents";
import { UserDatabase } from "./user-database";

export function run() {
    const token = '5847860544:AAFBsw2RNB0k5D-hyOEuiqtrEFOAIG6u3mU';
    const bot = new TelegramBot(token, { polling: true });

    bot.onText(/\/start/, async (m) => {
        if(await UserDatabase.getUser(m.from.id) == null) {
            bot.sendMessage(m.chat.id, 'Отправьте команду /login для авторизации');
        } else {
            bot.sendMessage(m.chat.id, 'Ви уже авторизаванный пользователь. Чтобы войти в другой аккаунт отправьте команду /logout, а затем /login');
        }
    });


    var loginRequests: Array<loginRequest> = [];
    bot.onText(/\/login/, (m) => {
        bot.sendMessage(m.chat.id, 'Введите номер телефона, к которому привязан аккаунт в формате +7XXXXXXXXXXX');
        loginRequests.push(new loginRequest(m.from.id));
    });

    bot.onText(/\+[0-9]{11}/, (m) => {
        var r = loginRequests.find((d) => d.id == m.from.id); 
        if(r != undefined) {
            r.phone = m.text;
            r.phoneMessageId = m.message_id;
            bot.sendMessage(r.id, 'Теперь ввидете ваш пароль');
        }
    });

    bot.onText(/\/stopword/, (m) => {
        var r = loginRequests.find((d) => d.id == m.from.id);

        if(r != undefined) {
            //TODO 
            //loginRequests.
        }
    });

    bot.onText(/.*/, async (m) => {
        var r = loginRequests.find((d) => d.id == m.from.id); 
        if(r != undefined) {
            console.log(r);
            if(r.phone == undefined && m.text != '/login') {
                bot.sendMessage(m.chat.id, 'Неправильный формат номера');
            } else if (r.phone != undefined && r.phoneMessageId != m.message_id) {
                var agent = getRandomUserAgent();
                r.password = m.text;
                await UserDatabase.writeUser({
                    id: m.from.id,
                    cookies: '',
                    isAdmin: false,
                    userAgent: agent,
                });

                var result = await EvrasiaApi.Login(r.phone, r.password, agent);
                
                if(result.ok) {
                    var usr = await UserDatabase.getUser(m.from.id);
                    usr.cookies = result.result;
                    await UserDatabase.editUser(usr);
                    // do a shit
                } else {
                    bot.sendMessage(m.from.id, 'Неправильный пароль или логин. Введите правильный пароль или отправьте команду /stopword чтобы остановить авторизацию')
                }
            }
            //TODO: check password
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