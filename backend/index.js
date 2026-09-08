import express, { json } from 'express';
import cors from 'cors';
const app = express();
import { init, teardown } from './persistence/index.js';
import getItems from './routes/getItems.js';
import addItem from './routes/addItem.js';
import updateItem from './routes/updateItem.js';
import deleteItem from './routes/deleteItem.js';

app.use(cors());
app.use(json());

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
