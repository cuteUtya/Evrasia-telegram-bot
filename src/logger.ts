import fs from 'fs';

export function makeLog(id, data) {
    const logsFolder = 'logs/';
    console.log(!fs.existsSync(logsFolder));
    if(!fs.existsSync(logsFolder)) fs.mkdirSync(logsFolder);

    var f = logsFolder + id + '.txt';
    if(!fs.existsSync(f)) fs.appendFileSync(f, '');

    var file = fs.openSync(f, 'a+');
    fs.writeFileSync(file, `[${new Date().toISOString()}] ${data}\n`);

    fs.closeSync(file);
}

export function getLogs(id, count) {
    const logsFolder = 'logs/';
    const filePath = logsFolder + id + '.txt';
    if (!fs.existsSync(filePath)) {
      return '';
    }
  
    const fileContents = fs.readFileSync(filePath, 'utf-8');

    const lines = fileContents.split('\n').filter(line => line.trim() !== '');
    const lastLines = lines.slice(-count);
  
    return lastLines.reverse().join('\n');
  }
  