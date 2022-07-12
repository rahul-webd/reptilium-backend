import * as cors from 'cors';
import * as express from 'express';
import * as admin from 'firebase-admin';
import { UNAUTHORIZEDEXCEPTION } from './exceptions';
import { Data } from './schema';
import { resizeMedia } from './main';
import { addNotification, getNotifications, 
    remNotification } from './notifications/notifications';
require('dotenv').config();

const key: string = process.env.FIREBASE_KEY || '';

export const firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(key)),
    databaseURL: "https://reptilium-3e457-default-rtdb.firebaseio.com",
    storageBucket: "reptilium-3e457.appspot.com"
});

export const db = admin.database(firebaseApp);

const app = express();
const port = 8080;


const corsHandler = cors({
    origin: '*',
});

app.use(corsHandler);
app.use(express.json());

app.post('/resize', async (req, resp) => {
    const body = req.body;
    const hash: string | undefined = body.hash;

    const res: Data = await resizeMedia(hash);
    resp.send(res);
});

app.post('/notifications/add', async (req, resp) => {
    const body = req.body;
    const addr: string = body.addr;

    if (addr === '.zjr.wam') {

        const m: string = req.body.message
        const res = await addNotification(m);

        resp.send(res);
    } else {

        resp.send(UNAUTHORIZEDEXCEPTION);
    }
});

app.get('/notifications', async (req, resp) => {

    const res = await getNotifications();
    resp.send(res);
})

app.post('/notifications/remove', async (req, resp) => {

    const res = await remNotification(req.body.key);
    resp.send(res);
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});