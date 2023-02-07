import fs from 'fs';
import { EvrasiaApi } from './evrasia-api';
import { getRandomUserAgent } from './user-agents';

const filename= './accounts.json';

export class EvrasiaAccountsManager {
    static accounts: Array<loginData>;
    

    private static index = 0;
    static get(): loginData {
        this.index++;
        return this.accounts[this.index % this.accounts.length];
    }

    static async init(){
        var f: Array<loginData> = this.read();

        for(var i = 0; i < f.length; i++) {
            if(f[i].cookies == "") {
                f[i] = await EvrasiaAccountsManager.login(f[i]);
            }
        }   

        this.accounts = f.filter((e) => e.cookies != '');

        this.write(f);
    }

    static async add(login, pass) {
        var r = this.read().find((e) => e.phone == login)
        if(r == undefined) {
            var l = await EvrasiaAccountsManager.login({phone: login, password: pass, cookies: '', userAgent: ''});
            var arr = EvrasiaAccountsManager.read();
            arr.push(l);
            EvrasiaAccountsManager.accounts = arr;
            EvrasiaAccountsManager.write(arr);
        }
    }

    static async login(loginData: loginData): Promise<loginData> {
        var userAgent = getRandomUserAgent();
        var cookies = await EvrasiaApi.Login(loginData.phone, loginData.password, userAgent);
        loginData.cookies = JSON.stringify(cookies.result);
        loginData.userAgent = userAgent;
        return loginData;
    }

    static read() : Array<loginData> {
        return JSON.parse(fs.readFileSync(filename).toString());
    }

    static write(d: Array<loginData>) {
        fs.writeFileSync(filename, JSON.stringify(d, null, 2));
    }
}

export interface loginData {
    phone: string;
    password: string;
    cookies: string;
    userAgent: string;
}