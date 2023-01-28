import fs from 'fs';
export var config = JSON.parse(fs.readFileSync('./config.json').toString());