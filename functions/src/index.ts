import * as functions from 'firebase-functions';
import * as cors from 'cors';
import * as session from 'express-session';
import 'dotenv/config';
import { WaxAuthServer } from "wax-auth";
import { addHarvestBoosters, addReptile, feedReptile, getFood, getFoodCount, getReptile, 
    getReptiles, getReptileTemplates, getShopItems, getSoulStone, getTgUserName, getUser, 
    getUserAddr, harvestFood, importBurnedFood, importBurnedReptiles, redeem, refreshBurns, setReptileTemplates, 
    setShopItems, setSoulStone, setTgUserName, spellSoulStone } from './main';
const { FirestoreStore } = require('@google-cloud/connect-firestore');
const { Firestore } = require('@google-cloud/firestore');

const auth = new WaxAuthServer();

const corsHandler = cors({
    origin: '*',
    allowedHeaders: 'Content-Type',
    methods: ['POST', 'GET', 'OPTIONS'],
    optionsSuccessStatus: 200,
});

const secret = process.env.SESS_SECRET;

if (secret) {
    const sess = session({
            store: new FirestoreStore({
                dataset: new Firestore(),
                kind: 'express-sessions'
            }),
            name: '__session',
            secret: JSON.parse(secret),
            resave: false,
            saveUninitialized: true,
            cookie: {
                maxAge: 7 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: 'none',
                secure: false
            }
        });

    exports.getNonce = functions.https.onRequest((req, resp) => {
        resp.set('Access-Control-Allow-Origin', 'http://localhost:3000');
        resp.set('Access-Control-Allow-Credentials', 'true');
        resp.set('Cache-Control', 'private');
        if (req.method === 'OPTIONS') {
            resp.status(204).send('');
        } else {
            corsHandler(req, resp, () => {
                sess(req, resp, () => {
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
            });
        }
    });

    exports.verify = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            sess(req, resp, async () => {
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
        });
    });

    exports.getAuth = functions.https.onRequest((req, resp) => {
        corsHandler(req, resp, () => {
            sess(req, resp, () => {
                const sess: any = req.session;
                if (!sess.authorized) {
                    sess.authorized = false;
                }
                resp.send({
                    authorized: sess.authorized
                });
            });
        });
    });

    exports.getUser = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const tmpts = body.tmpts;
            // const addr = 'mspvi.wam';
            // const tmpts: any = []
            const user = await getUser(addr, tmpts);
            
            resp.send(user);
        });
    });

    exports.addHarvestBoosters = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const tmptIds = body.tmptIds;
            const updatedBoosters = await addHarvestBoosters(addr, tmptIds);
            resp.send(updatedBoosters);
        });
    });

    exports.harvest = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
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
    });

    exports.getFoodCount = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const foodType = body.foodType;
            // const addr = 'rweue.wam';
            // const foodType = 'mouse';
            const res = await getFoodCount(addr, foodType);
            resp.send(res);
        })
    })

    exports.setShopItems = functions.pubsub.schedule('every 24 hours').onRun(async () => {
        await setShopItems();
        return null;
    });

    exports.getShopItems = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const shopItems = await getShopItems();
            resp.send(shopItems);
        });
    });

    exports.refreshBurns = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const hb = await refreshBurns(addr);
            resp.send(hb);
        });
    });

    exports.setTgUserName = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const tgUserName = body.tgUserName;
            // const addr = 'rweue.wam';
            // const tgUserName = 'rahul_443';
            const res = await setTgUserName(addr, tgUserName);
            resp.send(res);
        });
    });

    exports.getTgUserName = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const res = await getTgUserName(addr);
            resp.send(res);
        });
    });

    exports.getUserAddr = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const tgUserName = body.tgUserName;
            // const tgUserName = 'rahul_443';
            const res = await getUserAddr(tgUserName);
            resp.send(res);
        });
    });

    exports.setReptileTemplates = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            await setReptileTemplates();
            resp.end();
        });
    });

    exports.getReptileTemplates = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const res = await getReptileTemplates();
            resp.send(res);
        })
    });

    exports.addReptile = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const templateId = body.templateId;
            const addr = body.addr;
            // const templateId = '256889';
            // const addr = 'rweue.wam';
            const res = await addReptile(templateId, addr);
            resp.send(res);
        })
    });

    exports.importBurnedFood = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            // const addr = 'rweue.wam';
            const res = await importBurnedFood(addr);
            resp.send(res);
        });
    });

    exports.importBurnedReptiles = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            // const addr = 'rweue.wam';
            const res = await importBurnedReptiles(addr);
            resp.send(res);
        });
    });

    exports.getReptiles = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            // const addr = 'rweue.wam';
            const res = await getReptiles(addr);
            resp.send(res);
        });
    });

    exports.getReptile = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const templateId = body.templateId;
            // const addr = 'rweue.wam';
            const res = await getReptile(addr, templateId);
            resp.send(res);
        });
    });

    exports.getFood = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const foodType = body.foodType;
            // const addr = 'rweue.wam';
            // const foodType = 'mouse';
            const res = await getFood(addr, foodType);
            resp.send(res);
        });
    });

    exports.feedReptile = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
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
    });

    exports.setSoulStone = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            // const addr = 'mspvi.wam';
            const res = await setSoulStone(addr);
            resp.send(res);
        });
    });

    exports.getSoulStone = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            // const addr = 'mspvi.wam';
            const res = await getSoulStone(addr);
            resp.send(res);
        });
    });

    exports.spellSoulStone = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
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
    });
    
    exports.redeem = functions.https.onRequest(async (req, resp) => {
        corsHandler(req, resp, async () => {
            const body = req.body;
            const addr = body.addr;
            const templateId = body.templateId;
            const index = body.index;

            // const addr = 'rweue.wam';
            // const templateId = '257174';
            // const index = 0;

            const res = await redeem(addr, templateId, index);
            resp.send(res);
        })
    })
}