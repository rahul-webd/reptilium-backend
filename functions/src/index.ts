import * as functions from 'firebase-functions';
import * as cors from 'cors';
import * as express from 'express';
// import * as session from 'express-session';
import 'dotenv/config';
import { WaxAuthServer } from "wax-auth";
import { addHarvestBoosters, getUser, harvestFood } from './dbHelpers';
// const { FirestoreStore } = require('@google-cloud/connect-firestore');
// const { Firestore } = require('@google-cloud/firestore');

const auth = new WaxAuthServer();

const app = express();
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true
}));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Methods', 'GET, POST OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Cache-Control', 'private');
    return next();
});

const secret = process.env.SESS_SECRET;
if (typeof secret === 'string') {
    //TODO resolve cors error for plefight
    //TODO use session.addr in place of addr after successfully adding session

    // app.use(session({
    //     store: new FirestoreStore({
    //         dataset: new Firestore(),
    //         kind: 'express-sessions'
    //     }),
    //     name: '__session',
    //     secret: JSON.parse(secret),
    //     resave: false,
    //     saveUninitialized: true,
    //     cookie: {
    //         maxAge: 7 * 24 * 60 * 60 * 1000,
    //         sameSite: 'none'
    //     }
    // }));
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json());

    app.options('*', (cors({
        credentials: true
    }) as any));

    app.post('/getNonce', (req, res) => {
        const { waxAddress } = req.body;
        if (!waxAddress) {
            res.send({
                error: 'no username'
            });
            return;
        }

        const nonce = auth.generateNonce();
        const sess: any = req.session;
        sess.waxAddress = waxAddress;
        sess.nonce = nonce;
        res.send({
            nonce
        });
    });

    app.post('/verify', async (req, res) => {
        console.log(req.session);
        
        const sess: any = req.session;
        const body = req.body;
        if (!sess.nonce || !sess.waxAddress || !body.proof) {
            console.log(sess.nonce, sess.waxAddress, body.proof);
            
            res.send({
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
                sess.loggedIn = true;
                res.send({
                    loggedIn: sess.loggedIn
                });
            } else {
                res.send({
                    error: 'login failed, please try again'
                })
            }
        } catch (error) {
            res.send({
                error: 'invalid proof, please try again'
            });
        }
    });

    app.get('/user', (req, res) => {
        const sess: any = req.session;

        if (!sess.loggedIn) {
            sess.loggedIn = false;
        }
        res.send({
            loggedIn: sess.loggedIn
        });
    });

    app.post('/getUser', async (req, res) => {
        const body = req.body;
        const addr = body.addr;
        const tmpts = body.tmpts;
        // const addr = 'ansb.wam';
        // const tmpts = [
        //     {
        //         id: '382048',
        //         count: 1
        //     }
        // ]
        const user = await getUser(addr, tmpts);
        console.log('res', user);
        
        res.send(user);
    });

    app.post('/addHarvestBoosters', async (req, res) => {
        const body = req.body;
        const addr = body.addr;
        const tmptIds = body.tmptIds;
        const updatedBoosters = await addHarvestBoosters(addr, tmptIds);
        res.send(updatedBoosters);
    });

    app.post('/harvest', async (req, res) => {
        const body = req.body;
        const addr = body.addr;
        const foodType = body.foodType;
        const enhancer = body.enhancer;
        // const addr = 'ansb.wam';
        // const foodType = 'mouse';
        // const enhancer = 'none';
        const result = await harvestFood(addr, foodType, enhancer);
        res.send(result);
    });
}

exports.api = functions.https.onRequest(app);