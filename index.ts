import {request} from "./src/evrasia-request";
import { getRandomUserAgent } from "./src/user-agents";

request({link: 'https://evrasia.spb.ru/signin/', headers: {
    'user-agent': getRandomUserAgent(),
}}).then((r) => {
    console.log(r.headers);
});