import * as functions from "firebase-functions";
import { getShopTableRows } from './helpers';
import { harvest } from "./main";
import * as cors from 'cors';

const corsOptions = {
    origin: 'https://reptilium-farm.web.app'
}
const corsHandler = cors(corsOptions);

export const harvestFood = functions.https.onRequest(async (request, response) => {
    corsHandler(request, response, async () => {
        const addr = request.body.addr;
        const foodType = request.body.foodType;
        const enhancer = request.body.enhancer;
        await harvest(addr, foodType, enhancer).then(res => {
            response.send(res);
        });
    });
});

export const getShopItems = functions.https.onRequest(async (request, response) => {
    corsHandler(request, response, async () => {
        await getShopTableRows().then(res => {
            const rows: any = (res as any).rows;
            const rplmRows = rows.filter((row: any) => row.CollectionName === 'nft.reptile');
            response.send(rplmRows);
        });
    });
});