import { run } from "./src/botEntry";
import { UserDatabase } from "./src/user-database";

UserDatabase.init();
run();