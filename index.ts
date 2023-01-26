import { run } from "./src/botEntry";
import { EvrasiaApi } from "./src/evrasia-api";
import { request } from "./src/evrasia-request";
import { getRandomUserAgent } from "./src/user-agents";
import { UserDatabase } from "./src/user-database";

UserDatabase.init().then(async () => {
    console.log('init');
    run();
    //EvrasiaApi.GetAdresess(await UserDatabase.getUser(617313423));
})