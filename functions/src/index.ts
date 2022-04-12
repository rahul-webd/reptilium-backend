import * as functions from 'firebase-functions';
import { setShopItems } from './main';

exports.setShopItems = functions.pubsub.schedule('every 24 hours').onRun(async () => {
    await setShopItems();
    return null;
});