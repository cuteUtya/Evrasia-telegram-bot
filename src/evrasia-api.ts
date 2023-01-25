import { request } from "./evrasia-request";
import fs from 'fs';

export class EvrasiaApi {
    static async Login(login: string, password: string, userAgent: string): Promise<RequestResult<string>> {

        var firstOpen = await request({
            link: 'https://evrasia.spb.ru/signin/',
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                //'accept-encoding': 'deflate, br',
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

        var PHPSESSID = firstOpen.headers['set-cookie'][0].split(';')[0];
        var BITRIX_SM_SALE_UID = firstOpen.headers['set-cookie'][1].split(';')[0];

        /*
        var sessid = /\'bitrix_sessid\':\'(.*)\'/.exec(firstOpen.body)[1];

        var BITRIX_CONVERSION_CONTEXT_s1 = (await request({
            link: `https://evrasia.spb.ru/bitrix/tools/conversion/ajax_counter.php?SITE_ID=s1&sessid=${sessid}&HTTP_REFERER=`,
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'cookie': [PHPSESSID, BITRIX_SM_SALE_UID].join('; '),
                'user-agent': userAgent,
            }
        })).headers['set-cookie'][0].split(';')[0];*/

        /*var BX_USER_ID = (await request({
            link: 'https://bitrix.info/ba.js',
            headers: {
                'user-agent': userAgent, 
            }
        })).headers['set-cookie'][0].split(';')[0];

        BX_USER_ID = BX_USER_ID.split('=')[0].toUpperCase() + '=' + BX_USER_ID.split('=')[1];*/

        //var CHOOSED_RESTAURANT_EVERYTIME = 'CHOOSED_RESTAURANT_EVERYTIME=true';


        var cookieString = [PHPSESSID,
            BITRIX_SM_SALE_UID
        ].join('; ')

        function matchAll(regex, value): string[] {
            var re = regex;
            var s = value;
            var m;

            var r = [];

            do {
                m = re.exec(s);
                if (m) {
                    r = [...r, m[1]];
                }
            } while (m);

            return r;
        }


        var cssResources = matchAll(/<link href=\"(.*) type=\"text\/css\"/g, firstOpen.body);
        for(var c in cssResources) {
            console.log('fake loading on server: ' + cssResources[c]);
            await request({
                link: 'https://evrasia.spb.ru/' + cssResources[c],
                headers: {
                    'accept': 'text/css,*/*;q=0.1',
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
        }



        setTimeout(async () => {
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

            //PHPSESSID=73b383501e1df364e4217a156e863675; BITRIX_SM_SALE_UID=148690771
            //PHPSESSID=ca581222453d9237faae6b7ef0221d15; BITRIX_SM_SALE_UID=148688027

            //+7 (911) 812-96-95
            //USER_LOGIN=%2B7+%28911%29+812-96-95&USER_PASSWORD=Tosha812&AUTH_FORM=Y&TYPE=AUTH&USER_REMEMBER=Y&backurl=%2Fsignin%2F
            //USER_LOGIN=%2B7+%28911%29+812-96-95&USER_PASSWORD=Tosha812&AUTH_FORM=Y&TYPE=AUTH&USER_REMEMBER=Y&backurl=%2Fsignin%2F
            console.log(cookieString);
            console.log(signin.statusCode);
            console.log(signin.headers);
            console.log(signin.body);
            console.log(signin.requestHeader);

        }, 1500);

        /*var cookies: string[] = [
            
        ];
        
        var firstOpen_Cookies = await request({ 
            link: 'https://evrasia.spb.ru/signin/',
            headers: {
                'user-agent': userAgent,
            }
        });

        var sessionId = 

        cookies = cookies.concat(firstOpen_Cookies.headers['set-cookie'][0].split(';')[0]);
        cookies = cookies.concat(firstOpen_Cookies.headers['set-cookie'][1].split(';')[0])

        cookies = cookies.concat('CHOOSED_RESTAURANT_EVERYTIME=true');

       /* var userId_Cookie = await request({ 
            link: 'https://bitrix.info/ba.js',
            headers: {
                'user-agent': userAgent,
                Cookie: [cookies[0], cookies[1]].join('; '),
            }
        });

        console.log(sessionId);
        console.log([cookies[0], cookies[1]].join('; '));

        var bx_user_id = userId_Cookie.headers['set-cookie'][0].split(';')[0];
        bx_user_id = bx_user_id.split('=')[0].toUpperCase() + '=' + bx_user_id.split('=')[1]; 

        cookies = cookies.concat(bx_user_id);

        
        //PHPSESSID=0b16ec87e3252226cc3cbe69236f52b9; BITRIX_SM_SALE_UID=148638106
        
        console.log([cookies[0], cookies[1]].join('; '));

        
        var BITRIX_CONVERSION_CONTEXT_s1 = await request({
            method: 'POST',
            link: `https://evrasia.spb.ru/bitrix/tools/conversion/ajax_counter.php?SITE_ID=s1&sessid=${sessionId}&HTTP_REFERER=`,
            headers: {
                Cookie: [cookies[0], cookies[1]].join('; '),
                ContentType: 'application/x-www-form-urlencoded',
                UserAgent: userAgent,
            }
        });

        console.log(BITRIX_CONVERSION_CONTEXT_s1.request);
        console.log('abobus');
        console.log(BITRIX_CONVERSION_CONTEXT_s1.headers['set-cookie']);

        cookies = cookies.concat('BITRIX_CONVERSION_CONTEXT_s1={"ID":7,"EXPIRE":1674680340,"UNIQUE":["conversion_visit_day"]}');

        

        var link = `https://evrasia.spb.ru/signin/?USER_LOGIN=${encodeURI(formattedPhone)}&USER_PASSWORD=${password}&AUTH_FORM=Y&TYPE=AUTH&USER_REMEMBER=Y&backurl=/signin/`;


        /*
        PHPSESSID=2b52884ed85d9621a194e57767fe1eeb; 
        BITRIX_SM_SALE_UID=148634758; 
        CHOOSED_RESTAURANT_EVERYTIME=true;  
        BITRIX_CONVERSION_CONTEXT_s1={"ID":7,"EXPIRE":1674680340,"UNIQUE":["conversion_visit_day"]}; 
        BX_USER_ID=ff74a86ae1369321fb6c42f3f18e7f1e; */

        /**
         * PHPSESSID=d810abfc637f34d72de8a62401709f37; BITRIX_SM_SALE_UID=148640062; CHOOSED_RESTAURANT_EVERYTIME=true; BX_USER_ID=80c95800d6c5ad7a835b465000ac0af7; BITRIX_CONVERSION_CONTEXT_s1={"ID":7,"EXPIRE":1674680340,"UNIQUE":["conversion_visit_day"]}
         * PHPSESSID=0b16ec87e3252226cc3cbe69236f52b9; BITRIX_SM_SALE_UID=148638106; CHOOSED_RESTAURANT_EVERYTIME=true; BX_USER_ID=e54201a0c788c03f3679c864aeef4e63; BITRIX_CONVERSION_CONTEXT_s1={"ID":7,"EXPIRE":1674680340,"UNIQUE":["conversion_visit_day"]} 
        */

        /*
                console.log(cookies.join('; '));
        
                var r = await request({
                    link: link,
                    method: 'POST',
                    headers: {
                        'content-type': 'application/x-www-form-urlencoded',
                        'user-agent': userAgent,
                        'cookie': cookies.join('; '),
                    }
                })
        
        
        
                var s = fs.createWriteStream('curr.html');
                s.once('open', (_) => {
                    s.write(r.data);
                });
        
        
        
                console.log(r.status);
        
                //console.log(r.headers);
        
        
                if (r.status == 303) {
                    return {
                        ok: true,
                        result: r.headers['set-cookie'].join(';')
                    }
                }
        */
        return {
            ok: false
        }
    }

    static Logout(user: string) {

    }

    static GetCode(user: string): number {
        return -1;
    }

    static GetCards(user: string) {

    }

    static GetBalance(user: string): number {
        return -1;
    }

    static ActivateCode(user: string, restaurantIndex: number/* and card index, but idk, looks like it removed*/): number {
        return -1;
    }

    static GetAdresess(user: string): Array<RestaurantAdress> {
        return [];
    }
}

interface RestaurantAdress {
    name: string;
    index: number;
}

interface RequestResult<T> {
    result?: T;
    ok: boolean;
}