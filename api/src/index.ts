import * as cors from 'cors';
import * as express from 'express';
import { getFood, getFoodCount, getSoulStone, getUser, importBurnedFood,  
    setSoulStone, importBurnedReptiles, claimReward, getLastClaim, 
    resizeMedia, importBreedableReptiles } from './main';
import * as admin from 'firebase-admin';
import { Data, Schema } from './interfaces';
import { addHarvestBoosters, harvestFood, refreshBurns } from './game/harvest';
import { feedReptile, getReptile, getReptileAsset, getReptileBySchema, getReptiles, getSortedReptiles, redeem, spellSoulStone } from './game/upgrade';
import { createPair, getBreedableReptilesBothSex, getPairs } from './game/breed';
import { UNAUTHORIZEDEXCEPTION } from './exceptions';
import { addNotification, getNotifications } from './notifications/notifications';
import { changeFoodRewardOdds, changeOdds, getFoodRewardOdds, getOdds } from './admin/admin';
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

app.post('/getUser', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const tmpts = body.tmpts;

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

    const result = await harvestFood(addr, foodType, enhancer);
    resp.send(result);
});

app.post('/getFoodCount', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const foodType = body.foodType;

    const res = await getFoodCount(addr, foodType);
    resp.send(res);
});

app.post('/refreshBurns', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const hb = await refreshBurns(addr);
    resp.send(hb);
});

app.post('/importBurnedFood', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await importBurnedFood(addr);
    resp.send(res);
});

app.post('/importBurnedReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await importBurnedReptiles(addr);
    resp.send(res);
});

app.post('/importBreedableReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await importBreedableReptiles(addr);
    resp.send(res);
})

app.post('/getReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await getReptiles(addr);
    resp.send(res);
});

app.post('/getReptilesBySchema', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const schema: Schema = body.schema;

    const res = await getReptileBySchema(schema, addr);
    resp.send(res);
});

app.post('/getSortedReptiles', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const sex = body.sex;
    const schema: Schema = body.schema;

    const res = await getSortedReptiles(schema, sex, addr);
    resp.send(res);
});

app.post('/getReptile', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;

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

    const res = await feedReptile(addr, templateId, index, foodType, count);
    resp.send(res);
});

app.post('/setSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await setSoulStone(addr);
    resp.send(res);
});

app.post('/getSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await getSoulStone(addr);
    resp.send(res);
});

app.post('/spellSoulStone', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;
    const count = body.count;

    const res = await spellSoulStone(addr, count, templateId, index);
    resp.send(res);
});

app.post('/redeem', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;
    const templateId = body.templateId;
    const index = body.index;

    const res = await redeem(addr, templateId, index);
    resp.send(res);
});

app.post('/claim', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await claimReward(addr);
    resp.send(res);
});

app.post('/getLastClaim', async (req, resp) => {
    const body = req.body;
    const addr = body.addr;

    const res = await getLastClaim(addr);
    resp.send(res);
})

app.post('/resize', async (req, resp) => {
    const body = req.body;
    const hash: string | undefined = body.hash;

    const res: Data = await resizeMedia(hash);
    resp.send(res);
});

app.post('/getBreedableReptilesBothSex', async (req, resp) => {
    const body = req.body;
    const schema: Schema = body.schema;
    const addr: string = body.addr;

    const res: Data = await getBreedableReptilesBothSex(schema, addr);
    resp.send(res);
});

app.post('/createPair', async (req, resp) => {
    const body = req.body;
    const maleId: string = body.maleId;
    const femaleId: string = body.femaleId;
    const addr: string = body.addr;

    const res = await createPair(maleId, femaleId, addr);
    resp.send(res);
});

app.post('/pairs', async (req, resp) => {
    const body = req.body;
    const addr: string = body.addr;

    const res = await getPairs(addr);
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

app.post('/config/enhancers/odds/change', async (req, resp) => {
    
    const res = await changeOdds(req.body.odds);
    resp.send(res);
});

app.get('/config/enhancers/odds', async (req, resp) => {

    const res = await getOdds();
    resp.send(res);
});

app.post('/config/food/odds/change', async (req, resp) => {
    
    const res = await changeFoodRewardOdds(req.body.odds);
    resp.send(res);
});

app.get('/config/food/odds', async (req, resp) => {

    const res = await getFoodRewardOdds();
    resp.send(res);
});

app.listen(port, () => {
    console.log(`app listening on port ${port}`);
});