import { run } from "./src/botEntry";
import { EvrasiaApi } from "./src/evrasia-api";
import { request } from "./src/evrasia-request";
import { getRandomUserAgent } from "./src/user-agents";
import { UserDatabase } from "./src/user-database";

UserDatabase.init();
EvrasiaApi.Login('+79118129695', 'Tosha812', getRandomUserAgent());
//run();