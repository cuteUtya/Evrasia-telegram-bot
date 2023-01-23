import { Nullable } from "./types/nullable"
import sqlite3 from 'sqlite3';
const db = new (sqlite3.verbose().Database)('./user-database.db');


class UserDatabase {
    static init() {
        //create if not exists 
        // CREATE TABLE IF NOT EXISTS Users(id INTEGER, cookies TEXT, isAdmin INTEGER)
    }

    static getUser(): Nullable<user> {
        return null;
    }

    static writeUser(user: user) {
        
    }
}