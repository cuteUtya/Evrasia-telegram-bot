import { request } from "./evrasia-request";
import fs, { link } from 'fs';
import { EvrasiaAccountsManager } from "./evrasia-accounts-manager";

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


            console.log(signInPath);

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

    /*static async GetUserData(user: user): Promise<RequestResult<userData>> {
        try {
            var loginData = 
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
                        cards: this.matchAll(/<h3>Дисконтная карта.?<span>(.*)<\/h3>/g, r.body).map((e) => {
                            return e.replace('</span>', '');
                        })
                    }
                }
            }
        } catch (e) {

        }

        return {
            ok: false,
        }
    }*/

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


    static async ActivateCode(restaurantIndex: number/* and card index, but idk, looks like it removed*/): Promise<RequestResult<string>> {
        try {
            var user = EvrasiaAccountsManager.get();
            var r = await request({
                link: `https://evrasia.spb.ru/api/v1/restaurant-discount/?REST_ID=${restaurantIndex}`,
                headers: {
                    'cookie': this.glueCookie((JSON.parse(user.cookies) as string[]).map((e) => this.cutCookie(e))),
                    'user-agent': user.userAgent,
                }
            });

            if (r.statusCode == 200) {
                var code = JSON.parse(r.body);

                return {
                    ok: true,
                    result: code.checkin,
                }
            }

            //TODO try another account on falls
        } catch (e) { }

        return {
            ok: false,
        };
    }

    static async GetAdresess(): Promise<RequestResult<RestaurantAdress[]>> {
        try {
            var user = EvrasiaAccountsManager.get();
            console.log(user);
            var accountRequest = await request({
                link: 'https://evrasia.spb.ru/account/',
                headers: {
                    'user-agent': user.userAgent,
                    'cookie': this.glueCookie((JSON.parse(user.cookies) as string[]).map((e) => this.cutCookie(e)))
                }
            });

            if (accountRequest.statusCode == 200) {
                var m = /<option value="">В.*ран<\/option>([.,\s,]*<option value=\"\d{1,}\">.*<\/option>)*/.exec(accountRequest.body)[0];
                console.log(m);
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
        } catch (e) { }
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
}

export interface RestaurantAdress {
    name: string;
    index: number;
}

interface RequestResult<T> {
    result?: T;
    ok: boolean;
}