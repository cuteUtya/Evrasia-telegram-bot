import TelegramBot from "node-telegram-bot-api";
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
            bot.sendMessage(r.id, 'Теперь ввидете ваш пароль');
        }
    });

    bot.onText(/.*/, (m) => {
        var r = loginRequests.find((d) => d.id == m.from.id); 
        if(r != undefined) {
            if(r.phone == undefined && m.text != '/login') {
                bot.sendMessage(m.chat.id, 'Неправильный формат номера');
            }
            //TODO: check password
        }
    })
}

class loginRequest {
    id: number;
    phone?: string;
    password?: string;
    
    constructor(id: number) {
        this.id = id;
    }
}