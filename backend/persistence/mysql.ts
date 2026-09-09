import waitPort from 'wait-port';
import { readFileSync } from 'fs';
import { createPool, type Pool, type RowDataPacket } from 'mysql2';
import type { Item, ItemUpdate, Persistence } from './index.js';

const {
  MYSQL_HOST: HOST,
  MYSQL_HOST_FILE: HOST_FILE,
  MYSQL_USER: USER,
  MYSQL_USER_FILE: USER_FILE,
  MYSQL_PASSWORD: PASSWORD,
  MYSQL_PASSWORD_FILE: PASSWORD_FILE,
  MYSQL_DB: DB,
  MYSQL_DB_FILE: DB_FILE,
} = process.env;

let pool: Pool;

async function init(): Promise<void> {
  const host = HOST_FILE ? readFileSync(HOST_FILE, 'utf8') : HOST;
  const user = USER_FILE ? readFileSync(USER_FILE, 'utf8') : USER;
  const password = PASSWORD_FILE ? readFileSync(PASSWORD_FILE, 'utf8') : PASSWORD;
  const database = DB_FILE ? readFileSync(DB_FILE, 'utf8') : DB;

  await waitPort({
    host,
    port: 3306,
    timeout: 10000,
    waitForDns: true,
  });

  pool = createPool({
    connectionLimit: 5,
    host,
    user,
    password,
    database,
    charset: 'utf8mb4',
  });

  return new Promise((acc, rej) => {
    pool.query(
      'CREATE TABLE IF NOT EXISTS todo_items (id varchar(36), name varchar(255), completed boolean) DEFAULT CHARSET utf8mb4',
      (err) => {
        if (err) return rej(err);

        console.log(`Connected to mysql db at host ${HOST}`);
        acc();
      }
    );
  });
}

async function teardown(): Promise<void> {
  return new Promise((acc, rej) => {
    pool.end((err) => {
      if (err) rej(err);
      else acc();
    });
  });
}

async function getItems(): Promise<Item[]> {
  return new Promise((acc, rej) => {
    pool.query('SELECT * FROM todo_items', (err, rows) => {
      if (err) return rej(err);
      acc(
        (rows as RowDataPacket[]).map((item) => ({
          id: item.id,
          name: item.name,
          completed: Boolean(item.completed),
        }))
      );
    });
  });
}

async function getItem(id: string): Promise<Item | undefined> {
  return new Promise((acc, rej) => {
    pool.query('SELECT * FROM todo_items WHERE id=?', [id], (err, rows) => {
      if (err) return rej(err);
      acc(
        (rows as RowDataPacket[]).map((item) => ({
          id: item.id,
          name: item.name,
          completed: Boolean(item.completed),
        }))[0]
      );
    });
  });
}

async function storeItem(item: Item): Promise<void> {
  return new Promise((acc, rej) => {
    pool.query(
      'INSERT INTO todo_items (id, name, completed) VALUES (?, ?, ?)',
      [item.id, item.name, item.completed ? 1 : 0],
      (err) => {
        if (err) return rej(err);
        acc();
      }
    );
  });
}

async function updateItem(id: string, item: ItemUpdate): Promise<void> {
  return new Promise((acc, rej) => {
    pool.query(
      'UPDATE todo_items SET name=?, completed=? WHERE id=?',
      [item.name, item.completed ? 1 : 0, id],
      (err) => {
        if (err) return rej(err);
        acc();
      }
    );
  });
}

async function removeItem(id: string): Promise<void> {
  return new Promise((acc, rej) => {
    pool.query('DELETE FROM todo_items WHERE id = ?', [id], (err) => {
      if (err) return rej(err);
      acc();
    });
  });
}

const mysql: Persistence = {
  init,
  teardown,
  getItems,
  getItem,
  storeItem,
  updateItem,
  removeItem,
};

export default mysql;
