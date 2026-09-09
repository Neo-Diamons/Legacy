import mysql from './mysql.js';
import sqlite from './sqlite.js';

export interface Item {
  id: string;
  name: string;
  completed: boolean;
}

export interface ItemUpdate {
  name: string;
  completed: boolean;
}

export interface Persistence {
  init(): Promise<void>;
  teardown(): Promise<void>;
  getItems(): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  storeItem(item: Item): Promise<void>;
  updateItem(id: string, item: ItemUpdate): Promise<void>;
  removeItem(id: string): Promise<void>;
}

const persistence: Persistence = process.env.MYSQL_HOST ? mysql : sqlite;

export const { init, teardown, getItems, getItem, storeItem, updateItem, removeItem } = persistence;

export default persistence;
