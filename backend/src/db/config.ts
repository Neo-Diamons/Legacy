export const useMysql = Boolean(process.env.MYSQL_HOST || process.env.MYSQL_HOST_FILE);

export const DEFAULT_SQLITE_LOCATION = '/etc/todos/todo.db';

export const sqliteLocation = process.env.SQLITE_DB_LOCATION || DEFAULT_SQLITE_LOCATION;
