import { getItems } from '../persistence/index.js';

export default async (req, res) => {
    const items = await getItems();
    res.send(items);
};
