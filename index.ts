import {request} from "./src/evrasia-request";
import { getRandomUserAgent } from "./src/user-agents";
import { UserDatabase } from "./src/user-database";

UserDatabase.init();
UserDatabase.getUser(5).then((e) => console.log(e));


/*
request({link: 'https://evrasia.spb.ru/signin/', headers: {
    'user-agent': getRandomUserAgent(),
}}).then((r) => {
    console.log(r.headers);
});*/