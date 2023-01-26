import { Nullable } from "./types/nullable"
import sqlite3 from 'sqlite3';
import { Completer } from "readline";
const db = new (sqlite3.verbose().Database)('./user-database.db');


export class UserDatabase {
    static async init(): Promise<void> {
        return new Promise((d, _) => {
            db.run('CREATE TABLE IF NOT EXISTS Users(id INTEGER, cookies TEXT, isAdmin INTEGER, userAgent TEXT)', () => {
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
                })
            });
        })
    }

    static async writeUser(user: user): Promise<void> {
        return new Promise((complete, reject) => {
            var sql = `INSERT INTO Users (id, cookies, isAdmin, userAgent) VALUES (${user.id}, '${user.cookies}', ${this.booleanToInt(user.isAdmin)}, '${user.userAgent}')`;
            console.log(sql);
            db.run(sql, (err) => {
                console.log(err);
                complete();
            });
        });
    }

    static async editUser(user: user) : Promise<void> {
        return new Promise((complete, reject) => {
            db.run(`UPDATE Users SET id = ${user.id}, cookies = ${user.cookies}, isAdmin = ${user.isAdmin}, userAgent = ${user.userAgent} WHERE id == ${user.id}`, () => {
                complete();
            });
        });
    }

    static intToBoolean(value: number): boolean {
        return value == 1;
    }

    static booleanToInt(value: boolean): number {
        return value ? 1 : 0;
    }
}