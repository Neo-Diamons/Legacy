import mysql from './mysql.js';
import sqlite from './sqlite.js';

const persistence = process.env.MYSQL_HOST ? mysql : sqlite;

export const { init, teardown, getItems, getItem, storeItem, updateItem, removeItem } = persistence;

export default persistence;
