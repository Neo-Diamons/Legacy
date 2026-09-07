import { removeItem } from '../persistence/index.js';

export default async (req, res) => {
    await removeItem(req.params.id);
    res.sendStatus(200);
};
