import * as functions from "firebase-functions";
import { getShopTableRows, harvest } from './helpers';
import * as cors from 'cors';

const corsOptions = {
    origin: 'https://reptilium-farm.web.app'
}
const corsHandler = cors(corsOptions);

export const harvestFood = functions.https.onRequest(async (request, response) => {
    await harvest('rweue.wam', 'mice', 'none').then(res => {
        response.send(res);
    })
});

export const getShopItems = functions.https.onRequest(async (request, response) => {
    corsHandler(request, response, async () => {
        await getShopTableRows().then(res => {
            const rows: any = (res as any).rows;
            const rplmRows = rows.filter((row: any) => row.CollectionName === 'nft.reptile');
            response.send(rplmRows);
        });
    })
});