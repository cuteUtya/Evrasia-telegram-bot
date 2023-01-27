import { run } from "./src/botEntry";
import { StatisticManager } from "./src/statistic-manager";
import { UserDatabase } from "./src/user-database";

UserDatabase.init().then(async () => {
    console.log('init');
    StatisticManager.init();    
    await UserDatabase.TotalUsers();
    run();
    //EvrasiaApi.GetAdresess(await UserDatabase.getUser(617313423));
})