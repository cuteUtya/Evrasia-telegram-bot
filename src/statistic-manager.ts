import fs from "fs";
import { CronJob } from 'cron';

export class StatisticManager {
    static statPerCommand: Map<string, stat> = new Map();

    static init() {
        try {
            var s = fs.readFileSync('./stat.json');
            if (s) {
                this.statPerCommand = new Map(JSON.parse(s.toString()));
            }
        } catch (e) {
            fs.appendFileSync('./stat.json', '');
        }
        this.doAShit();
    }

    static doAShit() {
        new CronJob('5 8 * * Sun', () => {
            this.statPerCommand.forEach((v, _) => {
                v.weekStat = 0;
            })
        }).start();
        new CronJob('0 1 * * *', () => {
            this.statPerCommand.forEach((v, _) => {
                v.dayStat = 0;
            })
        }).start();
        new CronJob('0 * * * *', () => {
            this.statPerCommand.forEach((v, _) => {
                v.hourStat = 0;
            })
            this.save();
        }).start();
    }

    static save() {
        fs.writeFileSync('./stat.json', JSON.stringify(Array.from(this.statPerCommand.entries())));
    }

    static add(command: string): void {
        if (this.statPerCommand.get(command) == undefined) {
            this.statPerCommand.set(command, {
                hourStat: 0,
                dayStat: 0,
                weekStat: 0,
                totalStat: 0,
            });
        }

        var d = this.statPerCommand.get(command);
        d.dayStat++;
        d.hourStat++;
        d.weekStat++;
        d.totalStat++;
    }
}

interface stat {
    hourStat: number;
    dayStat: number;
    weekStat: number;
    totalStat: number;
}