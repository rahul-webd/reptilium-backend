import * as cors from 'cors';
import * as express from 'express';
import * as session from 'express-session';
import 'dotenv/config';
import { WaxAuthServer } from "wax-auth";
import { addHarvestBoosters, addReptile, feedReptile, getFood, getFoodCount, getReptile, 
    getReptiles, getReptileTemplates, getShopItems, getSoulStone, getTgUserName, getUser, 
    getUserAddr, harvestFood, importBurnedFood, redeem, refreshBurns, setReptileTemplates, 
    setSoulStone, setTgUserName, spellSoulStone, importBurnedReptiles, claimReward, getLastClaim, getReptTemplates, getReptileAsset, getReptileBySchema, resizeMedia } from './main';
import * as admin from 'firebase-admin';
import { Data, Schema } from './interfaces';
const { FirestoreStore } = require('@google-cloud/connect-firestore');
const key = require('../key.json');

admin.initializeApp({
    credential: admin.credential.cert(key),
    databaseURL: "https://reptilium-3e457-default-rtdb.firebaseio.com",
    storageBucket: "reptilium-3e457.appspot.com"
});

const app = express();
const port = 8080;

const auth = new WaxAuthServer();

const corsHandler = cors({
    origin: '*',
    allowedHeaders: 'Content-Type',
    methods: ['POST', 'GET', 'OPTIONS'],
    // preflightContinue: true,
    // credentials: true,
    optionsSuccessStatus: 200,
});

app.use(corsHandler);
app.use(express.json());

app.options('*', corsHandler);

const secret = process.env.SESS_SECRET;

if (secret) {    
    const db = admin.firestore();

    app.use(session({
        store: new FirestoreStore({
            dataset: db,
            kind: 'express-sessions'
        }),
        name: '__session',
        secret: JSON.parse(secret),
        resave: false,
        saveUninitialized: true,
        cookie: {
            maxAge: 7 * 24 * 60 * 60 * 1000,
            secure: true
        }
    }));

    app.post('/getNonce', (req, resp) => {

        const { waxAddress } = req.body;
        if (!waxAddress) {
            resp.send({
                error: 'no username'
            });
            return;
        }

        const nonce = auth.generateNonce();
        const sess: any = req.session;
        sess.waxAddress = waxAddress;
        sess.nonce = nonce;
        resp.send({
            nonce
        });
    });

    app.post('/verify', async (req, resp) => {
        const sess: any = req.session;
        const body = req.body;
        if (!sess.nonce || !sess.waxAddress || !body.proof) {
            
            resp.send({
                error: 'please log in again'
            });
            return;
        }
        try {
            const valid = await auth.verifyNonce({
                waxAddress: sess.waxAddress,
                proof: body.proof,
                nonce: sess.nonce
            });
            
            if (valid) {
                sess.authorized = true;
                resp.send({
                    authorized: sess.authorized
                });
            } else {
                resp.send({
                    error: 'login failed, please try again'
                })
            }
        } catch (error) {
            resp.send({
                error: 'invalid proof, please try again'
            });
        }
    });

    app.post('/getAuth', (req, resp) => {
        const sess: any = req.session;
        if (!sess.authorized) {
            sess.authorized = false;
        }
        resp.send({
            authorized: sess.authorized
        });
    });
}

app.post('/getUser', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const tmpts = body.tmpts;
    // const addr = 'mspvi.wam';
    // const tmpts: any = []
    const user = await getUser(addr, tmpts);
    
    resp.send(user);
});

app.post('/addHarvestBoosters', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const tmptIds = body.tmptIds;
    const updatedBoosters = await addHarvestBoosters(addr, tmptIds);
    resp.send(updatedBoosters);
});

app.post('/harvest', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const foodType = body.foodType;
    const enhancer = body.enhancer;
    // const addr = 'mspvi.wam';
    // const foodType = 'mouse';
    // const enhancer = 'none';
    const result = await harvestFood(addr, foodType, enhancer);
    resp.send(result);
});

app.post('/getFoodCount', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const foodType = body.foodType;
    // const addr = 'rweue.wam';
    // const foodType = 'mouse';
    const res = await getFoodCount(addr, foodType);
    resp.send(res);
});

app.get('/getShopItems', async (req, resp) => {
    const shopItems = await getShopItems();
    resp.send(shopItems);
});

app.post('/refreshBurns', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const hb = await refreshBurns(addr);
    resp.send(hb);
});

app.post('/setTgUserName', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const tgUserName = body.tgUserName;
    // const addr = 'rweue.wam';
    // const tgUserName = 'rahul_443';
    const res = await setTgUserName(addr, tgUserName);
    resp.send(res);
});

app.post('/getTgUserName', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const res = await getTgUserName(addr);
    resp.send(res);
});

app.post('/getUserAddr', async (req, resp) => {
    const body = req.body;
    const tgUserName = body.tgUserName;
    // const tgUserName = 'rahul_443';
    const res = await getUserAddr(tgUserName);
    resp.send(res);
});

app.get('/setReptileTemplates', async (req, resp) => {
    await setReptileTemplates();
    resp.end();
});

app.get('/getReptileTemplates', async (req, resp) => {
    const res = await getReptileTemplates();
    resp.send(res);
});

app.post('/addReptile', async (req, resp) => {
    const body = req.body;
    const templateId = body.templateId;
    const addr = body.addr;
    // const templateId = '256889';
    // const addr = 'rweue.wam';
    const res = await addReptile(templateId, addr);
    resp.send(res);
});

app.post('/importBurnedFood', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    // const addr = 'rweue.wam';
    const res = await importBurnedFood(addr);
    resp.send(res);
});

app.post('/importBurnedReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    // const addr = 'rweue.wam';
    const res = await importBurnedReptiles(addr);
    resp.send(res);
})

app.post('/getReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    // const addr = 'rweue.wam';
    const res = await getReptiles(addr);
    resp.send(res);
});

app.post('/getReptilesBySchema', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const schema: Schema = body.schema;
    // const addr = 'rweue.wam';
    // const schema = 'pythons'
    const res = await getReptileBySchema(schema, addr);
    resp.send(res);
});

app.post('/getReptile', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    // const addr = 'rweue.wam';
    const res = await getReptile(addr, templateId);
    resp.send(res);
});

app.post('/getActiveReptile', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;

    const res = await getReptileAsset(addr, templateId, index);
    resp.send(res);
})

app.post('/getFood', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const foodType = body.foodType;
    // const addr = 'rweue.wam';
    // const foodType = 'mouse';
    const res = await getFood(addr, foodType);
    resp.send(res);
});

app.post('/feedReptile', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;
    const foodType = body.foodType;
    const count = body.count;
    // const addr = 'rweue.wam';
    // const templateId = '256222';
    // const index = 0;
    // const foodType = 'mouse';
    // const count = 2;
    const res = await feedReptile(addr, templateId, index, foodType, count);
    resp.send(res);
});

app.post('/setSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    // const addr = 'mspvi.wam';
    const res = await setSoulStone(addr);
    resp.send(res);
});

app.post('/getSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    // const addr = 'mspvi.wam';
    const res = await getSoulStone(addr);
    resp.send(res);
});

app.post('/spellSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;
    const count = body.count;
    // const addr = 'mspvi.wam';
    // const templateId = '257176';
    // const index = 0;
    // const count = 2;
    const res = await spellSoulStone(addr, count, templateId, index);
    resp.send(res);
});

app.post('/redeem', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;

    // const addr = 'rkid.wam';
    // const templateId = '257174';
    // const index = 0;

    const res = await redeem(addr, templateId, index);
    resp.send(res);
});

app.post('/claim', async (req, resp) => {
    const addr = req.body.addr;
    // const addr = 'rweue.wam';
    const res = await claimReward(addr);
    resp.send(res);
});

app.post('/getLastClaim', async (req, resp) => {
    const addr = req.body.addr;
    // const addr = 'rweue.wam'
    const res = await getLastClaim(addr);
    resp.send(res);
})

app.post('/get_templates', async (req, resp) => {
    const body = req.body;
    const id: string | undefined = body.id;
    const ids: string[] | undefined = body.ids;

    let res = {}

    if (!id && !ids) {
        res = { error: 'no query found' }
    } else {
        res = await getReptTemplates(id, ids);
    }

    resp.send(res);
});

app.post('/resize', async (req, resp) => {
    const body = req.body;
    const hash: string | undefined = body.hash;

    // const hash: string 
    //     = `QmPScZyR7Syer4VXbpiQ2wAZgWLUqZYUbTrnDiCyCpaJn3`;

    const res: Data = await resizeMedia(hash);
    resp.send(res);
})

app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});