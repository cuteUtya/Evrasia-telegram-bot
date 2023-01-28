import { Nullable } from "./types/nullable"
import sqlite3 from 'sqlite3';
const db = new (sqlite3.verbose().Database)('./user-database.db');


export class UserDatabase {
    static async init(): Promise<void> {
        return new Promise((d, _) => {
            db.run('CREATE TABLE IF NOT EXISTS Users(id INTEGER, cookies TEXT, isAdmin INTEGER, userAgent TEXT, scoring INTEGER, siteScore INTEGER)', () => {
                d();
            });
        });
    }

    static async getUser(id: number): Promise<Nullable<user>> {
        return new Promise((complete, reject) => {
            db.get(`SELECT * FROM Users WHERE id == ${id}`, (err, row) => {
                if (row == null || row == undefined) {
                    complete(null);
                    return;
                }
                complete({
                    id: row.id,
                    cookies: row.cookies,
                    isAdmin: this.intToBoolean(row.isAdmin),
                    userAgent: row.userAgent,
                    scoring: row.scoring,
                    siteScore: row.siteScore,
                })
            });
        })
    }

    static async TotalUsers(): Promise<number> {
        return new Promise((c, _) => {
            db.get('SELECT COUNT(*) FROM Users', (_,r) => {
                c(r['COUNT(*)']);
            });
        });
    }

    static async ScoringSumm(): Promise<number> {
        return new Promise((c, _) => {
            db.get(`SELECT SUM(siteScore) FROM Users`, (_,r) => {
                c(r['SUM(siteScore)']);
            });
        });
    }

    static async writeUser(user: user): Promise<void> {
        return new Promise((complete, reject) => {
            var sql = `INSERT INTO Users (id, cookies, isAdmin, userAgent, scoring, siteScore) VALUES (${user.id}, '${user.cookies}', ${this.booleanToInt(user.isAdmin)}, '${user.userAgent}', ${user.scoring}, ${user.siteScore})`;
            db.run(sql, (err) => {
                complete();
            });
        });
    }

    static async editUser(user: user) : Promise<void> {
        return new Promise((complete, reject) => {
            db.run(`UPDATE Users SET id = ${user.id}, cookies = ${user.cookies}, isAdmin = ${user.isAdmin}, userAgent = ${user.userAgent}, scroring = ${user.scoring}, siteScore = ${user.siteScore} WHERE id == ${user.id}`, () => {
                complete();
            });
        });
    }

    static async removeUser(user: user) : Promise<void> {
        db.run(`DELETE FROM Users where id=${user.id}`);
    }

    static intToBoolean(value: number): boolean {
        return value == 1;
    }

    static booleanToInt(value: boolean): number {
        return value ? 1 : 0;
    }
}