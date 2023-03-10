import { request } from "./evrasia-request";
import fs, { link } from 'fs';
import { EvrasiaAccountsManager, loginData } from "./evrasia-accounts-manager";
import { RunTimeVariablesManager } from "./runtime-variables-manager";
import { StatisticManager } from "./statistic-manager";
import { UserDatabase } from "./user-database";
import { structures } from "./evrasia-api-blocked-structures";


export class EvrasiaApi {
    static cutCookie(cookie: string): string {
        if (cookie.includes(';')) return cookie.split(';')[0];
        return cookie;
    }

    static glueCookie(cookies: string[]): string {
        return cookies.join('; ');
    }

    static async Login(login: string, password: string, userAgent: string): Promise<RequestResult<string[]>> {
        try {
            var firstOpen = await request({
                link: 'https://evrasia.spb.ru/signin/',
                headers: {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-language': 'ru',
                    'dnt': 1,
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-gpc': '1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': userAgent,
                }
            });

            var PHPSESSID = this.cutCookie(firstOpen.headers['set-cookie'][0]);
            var BITRIX_SM_SALE_UID = this.cutCookie(firstOpen.headers['set-cookie'][1]);


            var cookieString = this.glueCookie([PHPSESSID, BITRIX_SM_SALE_UID]);


            /* no sense 
            var cssResources = matchAll(/<link href=\"(.*) type=\"text\/css\"/g, firstOpen.body);
            for (var c in cssResources) {
                console.log('fake loading on server: ' + cssResources[c]);
                await request({
                    link: 'https://evrasia.spb.ru/' + cssResources[c],
                    headers: {
                        'accept': 'text/css,/*;q=0.1',
                        'accept-language': 'ru',
                        'cookie': cookieString,
                        'dnt': 1,
                        'referer': 'https://evrasia.spb.ru/signin/',
                        'sec-fetch-dest': 'style',
                        'sec-fetch-mode': 'no-cors',
                        'sec-fetch-site': 'same-origin',
                        'sec-gpc': '1',
                        'user-agent': userAgent,
                    }
                })
            }*/

            var formattedPhone = `+${login.substring(1, 2)}(${login.substring(2, 5)})${login.substring(5, 8)}-${login.substring(8, 10)}-${login.substring(10, 12)}`;
            var signInPath = `USER_LOGIN=${formattedPhone}&USER_PASSWORD=${password}&AUTH_FORM=Y&TYPE=AUTH&USER_REMEMBER=Y&backurl=/signin/`;
            signInPath = signInPath
                .replace('+', '%2B')
                .replace('(', '+%28')
                .replace(')', '%29+')
                .replace('/', '%2F')
                .replace('/', '%2F')

            var signin = await request({
                link: `https://evrasia.spb.ru/signin/`,
                method: 'POST',
                data: signInPath,
                headers: {
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'ru',
                    'cache-control': 'max-age=0',
                    'content-type': 'application/x-www-form-urlencoded',
                    'Cookie': cookieString,
                    'dnt': '1',
                    'content-lenght': signInPath.length,
                    'origin': 'https://evrasia.spb.ru',
                    'referer': 'https://evrasia.spb.ru/signin/',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'same-origin',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'sec-gpc': '1',
                    'user-agent': userAgent,
                }
            });

            if (signin.statusCode == 302 && signin.headers['set-cookie'] != undefined) {
                return {
                    ok: true,
                    result: signin.headers['set-cookie'],
                }
            }
        } catch (e) { }

        return {
            ok: false
        }
    }

    static matchAll(regex, value): string[] {
        var re = regex;
        var s = value;
        var m;

        var r = [];

        do {
            m = re.exec(s);
            if (m) {
                r.push(m[1]);
            }
        } while (m);

        return r;
    }

    static async GetAccountData(user: loginData): Promise<RequestResult<userData>> {
        var r = await request({
            link: 'https://evrasia.spb.ru/account/', headers: {
                'user-agent': user.userAgent,
                'cookie': this.glueCookie((JSON.parse(user.cookies) as string[]).map((e) => this.cutCookie(e))),
            }
        });
        if (r.statusCode == 200) {
            return {
                ok: true,
                result: {
                    name: /<h2 class="user_name">(.*)<a href="#" data-remote="true" class="edit">/.exec(r.body)[1],
                    phone: /<p class=\"user_phone\">(.*)<\/p>/.exec(r.body)[1],
                    points: /p class=\"points_number\">(.*)<img src=/.exec(r.body)[1],
                    cards: this.matchAll(/<h3>???????????????????? ??????????.?<span>(.*)<\/h3>/g, r.body).map((e) => {
                        return e.replace('</span>', '');
                    }),
                    pointsCode: this.matchAll(/\"inputPin\">(.*)<\/div>/g, r.body).join('')
                }
            }
        }

        return {
            ok: false,
        }
    }

    static async ActivateCode(restaurantIndex: number, userId: number/* and card index, but idk, looks like it removed*/): Promise<RequestResult<string>> {
        var result = undefined;
        var maxattempts = EvrasiaAccountsManager.accounts.length * 2;
        var attemps = 0;
        do {
            attemps++;
            var user = EvrasiaAccountsManager.get();

            function getIdOfAdress(user: loginData, adress: number): string {
                return `${user.phone}#${adress}#${userId}`;
            }

            function getIdOfCode(adress, code) {
                return `${adress}#${code}`;
            }

            var cachedResult;
            for(var j in structures.issuedCodes) {
                var s = structures.issuedCodes[j];
                if(s.includes(restaurantIndex.toString()) && s.includes(userId.toString())) {
                    cachedResult = /#(\d*$)/.exec(s)[1];
                    break;
                }
            }

            if(cachedResult) {
                result = cachedResult;
                break;
            }

            var id = getIdOfAdress(user, restaurantIndex);

            if ( structures.blockedAdresses.includes(id)) continue;

            for (var i = 0; i < structures.blockedAccounts.length; i++) {
                if (structures.blockedAccounts[i].phone == user.phone && structures.blockedAccounts[i].triggeredAdress != restaurantIndex) {
                    continue;
                }
            }

            let thatStruct = structures;
            async function onCodeUsed(code) {
                var usr = await UserDatabase.getUser(userId)
                UserDatabase.editUser({ ...usr, codeUsed: usr.codeUsed++ });
                StatisticManager.add('???????????????????????? ??????????');
                structures.issuedCodes = structures.issuedCodes.filter((e) => e !== getIdOfCode(id, code));
                var obj = {
                    phone: user.phone,
                    triggeredAdress: restaurantIndex,
                };
                structures.blockedAccounts.push(obj);
                setTimeout(() => {
                    thatStruct.blockedAccounts = thatStruct.blockedAccounts.filter((e) => e.phone !== obj.phone);
                }, 1000 * 60 * RunTimeVariablesManager.read('account_block_after_actived_code_time_minutes'))
            }

            var cookie = EvrasiaApi.glueCookie((JSON.parse(user.cookies) as string[]).map((e) => EvrasiaApi.cutCookie(e)));

            async function unBlock() {
                structures.blockedAccounts = structures.blockedAccounts.filter((e) => e.phone !== user.phone);
                structures.blockedAdresses = structures.blockedAdresses.filter((e) => e !== id);

                var r = await request({
                    link: `https://evrasia.spb.ru/api/v1/restaurant-discount/?REST_ID=${restaurantIndex}`,
                    headers: {
                        'cookie': cookie,
                        'user-agent': user.userAgent,
                    }
                });

                if (r.statusCode == 200) {
                    var a = JSON.parse(r.body).checkin.toString().replace(/ /g, '');
                    var b = code.replace(/ /g, '');
                    if (a !== b) {
                        onCodeUsed(code);
                    }
                }
                structures.issuedCodes = structures.issuedCodes.filter((e) => e !== getIdOfCode(id, code));
            }

            let that = unBlock;
            function blockThisAdress(code) {
                structures.issuedCodes.push(getIdOfCode(id, code));
                structures.blockedAdresses.push(id);

                setTimeout(async () => {
                    that();
                }, 1000 * 60 * RunTimeVariablesManager.read('adress_reserve_time_minutes'));
            }

            var r = await request({
                link: `https://evrasia.spb.ru/api/v1/restaurant-discount/?REST_ID=${restaurantIndex}`,
                headers: {
                    'cookie': cookie,
                    'user-agent': user.userAgent,
                }
            });

            if (r.statusCode == 200) {
                var code = JSON.parse(r.body).checkin;
                if(code.includes('No')) continue;
                blockThisAdress(code);
                StatisticManager.add('???????????? ??????????');
                result = code;
            }
        } while (!result && attemps < maxattempts);

        if (result) return {
            ok: true,
            result: result
        }

        return {
            ok: false,
        };
    }

    static async GetAdresess(): Promise<RequestResult<RestaurantAdress[]>> {

        var user = EvrasiaAccountsManager.get();
        var accountRequest = await request({
            link: 'https://evrasia.spb.ru/account/',
            headers: {
                'user-agent': user.userAgent,
                'cookie': this.glueCookie((JSON.parse(user.cookies) as string[]).map((e) => this.cutCookie(e)))
            }
        });

        if (accountRequest.statusCode == 200) {
            var m = /<option value="">??.*??????<\/option>([.,\s,]*<option value=\"\d{1,}\">.*<\/option>)*/.exec(accountRequest.body)[0];
            var adresess = this.matchAll(/(<option value=\"\d{1,}\">.*<\/option>)/g, m);

            var result = adresess.map((e) => {
                var code = /<option value=\"(\d*)\">/.exec(e)[1]
                var name = />(.*)<\/option>/.exec(e)[1];

                var d: RestaurantAdress = {
                    name: name,
                    index: parseInt(code),
                }

                return d;
            });

            return {
                ok: true,
                result: result,
            }
        }

        return {
            ok: false
        }
    }
}



export interface userData {
    name: string;
    phone: string;
    points: string;
    cards: string[];
    pointsCode: string;
}

export interface RestaurantAdress {
    name: string;
    index: number;
}

export interface RequestResult<T> {
    result?: T;
    ok: boolean;
}