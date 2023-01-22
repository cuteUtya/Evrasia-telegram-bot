import {request} from "./src/evrasia-request";

request({link: 'https://google.com'}).then((r) => {
    console.log(r);
});