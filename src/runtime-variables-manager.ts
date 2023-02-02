import fs from 'fs';

export class RunTimeVariablesManager {
    static read(name: string) {
        return this.readFile()[name];
    }

    static readFile() {
        return JSON.parse(fs.readFileSync('./variables.json').toString());
    }

    static write(name: string, value) {
        var l = this.readFile()
        l[name] = value;
        fs.writeFileSync('./variables.json', JSON.stringify(l));
    }
}