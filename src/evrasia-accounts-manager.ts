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
                var userAgent = getRandomUserAgent();
                var cookies = await EvrasiaApi.Login(f[i].phone, f[i].password, userAgent);
                f[i].cookies = JSON.stringify(cookies.result);
                f[i].userAgent = userAgent;
            }
        }   

        this.accounts = f.filter((e) => e.cookies != '');

        this.write(f);
    }

    static read() : Array<loginData> {
        return JSON.parse(fs.readFileSync(filename).toString());
    }

    static write(d: Array<loginData>) {
        fs.writeFileSync(filename, JSON.stringify(d, null, 2));
    }
}

interface loginData {
    phone: string;
    password: string;
    cookies: string;
    userAgent: string;
}