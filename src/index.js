import express, { json, static as serveStatic } from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
const app = express();
import { init, teardown } from './persistence/index.js';
import getItems from './routes/getItems.js';
import addItem from './routes/addItem.js';
import updateItem from './routes/updateItem.js';
import deleteItem from './routes/deleteItem.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use(json());
app.use(serveStatic(join(__dirname, 'static')));

app.get('/items', getItems);
app.post('/items', addItem);
app.put('/items/:id', updateItem);
app.delete('/items/:id', deleteItem);

init()
  .then(() => {
    app.listen(3000, () => console.log('Listening on port 3000'));
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

const gracefulShutdown = () => {
  teardown()
    .catch(() => {})
    .then(() => process.exit());
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
process.on('SIGUSR2', gracefulShutdown); // Sent by nodemon
