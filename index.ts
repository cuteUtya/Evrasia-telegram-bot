import { run } from "./src/botEntry";
import { EvrasiaAccountsManager } from "./src/evrasia-accounts-manager";
import { makeLog } from "./src/logger";
import { initProxyStorage } from "./src/proxy-manager";
import { StatisticManager } from "./src/statistic-manager";
import { UserDatabase } from "./src/user-database";

UserDatabase.init().then(async () => {
    console.log('init');
    StatisticManager.init();    
    await EvrasiaAccountsManager.init();
    initProxyStorage();
    run();
})