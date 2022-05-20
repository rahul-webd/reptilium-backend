import { Api, JsonRpc, RpcError } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { TextEncoder, TextDecoder } from 'text-encoding';
import { redeemValues } from './data';
import fetch from 'node-fetch';
import { Data } from './interfaces';
require('dotenv').config({ path: '../.env' });

const coinReptilePvk: string | undefined = process.env.COIN_REPTILE_KEY;
const tokenSignatureProvider = typeof coinReptilePvk === 'string'
    && new JsSignatureProvider([coinReptilePvk]);

const chatReptilePvk: string | undefined = process.env.CHAT_REPTILE_KEY;
const nftSignatureProvider = typeof chatReptilePvk === 'string' 
    && new JsSignatureProvider([chatReptilePvk]);

const rpcEndpoints: Array<string> = [
    `wax.greymass.com`,
    `api.wax.alohaeos.com`,
    `wax.eu.eosamsterdam.net`,
    `wax.blacklusion.io`,
    `wax.blokcrafters.io`,
    `api-wax-mainnet.wecan.dev`,
    `wax.cryptolions.io`,
    `api-wax.eosarabia.net`,
    `wax.eosdublin.io`,
    `wax.eoseoul.io`,
    `wax.eosphere.io`,
    `wax-public1.neftyblocks.com`,
    `wax-public2-neftyblocks.com`,
    `wax.api.eosnation.io`,
    `api2.hivebp.io`,
    `api.waxsweden.org`
]

const atomicEndpoints: Array<String> = [
    `wax.api.atomicassets.io`,
    `wax-aa.eu.eosamsterdam.net`,
    `aa.wax.blacklusion.io`,
    `api.wax-aa.bountyblok.io`,
    `atomic-wax-mainnet.wecan.dev`,
    `aa.dapplica.io`,
    `wax-aa.eosdublin.io`,
    `wax-atomic-api.eosphere.io`,
    `atomic.wax.eosrio.io`,
    `api.atomic.greeneosio.com`,
    `aa-wax-public1.neftyblocks.com`,
    `wax.hkeos.com/aa`,
    `atomic.ledgerwise.io`,
    `atomic.tokengamer.io`,
]

const collectionName: string = `nft.reptile`;

const rpcEndpoint: string = `https://${rpcEndpoints[0]}`;

const getAtomicEndpoint = () => {
    const rand = Math.floor(Math.random() * atomicEndpoints.length);
    return `https://${atomicEndpoints[rand]}/atomicassets/v1`;
}

const rpc = new JsonRpc(rpcEndpoint, { fetch });

const tokenApi = tokenSignatureProvider 
    && new Api({ rpc,
        signatureProvider: tokenSignatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder()});

const nftApi = nftSignatureProvider 
    && new Api({ rpc, 
            signatureProvider: nftSignatureProvider,
            textDecoder: new TextDecoder(), 
            textEncoder: new TextEncoder() });

export const rewardChatTokens = (recipient: string) => {
    const quantity: string = `0.5000 RPLM`;
    const memo: string = `Reptilium Chat Participation 🦎`;
    transferTokens(recipient, quantity, memo);
}

export const rewardRplmNft = (recipient: string) => {
    const schemaName: string = `packs`;
    const templateId: string = `283606`;
    mintNft(recipient, schemaName, templateId);
}

export const mintHarvestNft = async (recipient: string, type: string, enhancer: string) => {
    interface templateStats {
        [type: string]: {
            schema: string,
            templateIds: templateIds
        }
    }

    interface templateIds {
        [type: string]: string
    }

    const templateStats: templateStats = {
        mouse: {
            schema: `food`,
            templateIds: {
                hundred: `374720`,
                ten: `363222`,
                five: `363220`,
                one: `363217`
            }
        },
        cricket: {
            schema: `food`,
            templateIds: {
                hundred: `374732`,
                ten: `363221`,
                five: `363218`,
                one: `363216`
            }
        }
    }

    // probabilities within 1000
    const probs: Array<number> = [0, 20, 130, 850];
    const enhancedProbs: Array<number> = [50, 200, 250, 500];

    const typeSchmName = templateStats[type].schema;
    const typeTmptIds = templateStats[type].templateIds;

    const probsMap: Map<number, string> = new Map([
        [0, typeTmptIds.hundred],
        [1, typeTmptIds.ten],
        [2, typeTmptIds.five],
        [3, typeTmptIds.one]
    ]);

    const reward = async (probType: Array<number>) => {
        const chosenRand: number = chooseRand(probType);
        if (chosenRand !== -1 && chosenRand < 4) {
            const tmptToReward = probsMap.get(chosenRand);
            if (typeof tmptToReward !== 'undefined') {
                const trx = await mintNft(recipient, typeSchmName, tmptToReward);
                return { tmptToReward, trx};
            }
        }
        return { error: 'some error occurred' };
    }

    if (enhancer !== 'none') {
        const res = await reward(enhancedProbs);
        return res;
    } else  {
        const res = await reward(probs);
        return res;
    }
}

export const mintBreedableNft = async (recipient: string, 
    templateId: string) => {

    const redeemId = redeemValues[templateId];
    const schemaName = 'game';
    const res = await mintNft(recipient, schemaName, redeemId);
    return res;
} 

export const transferTokens = async (recipient: string, quantity: string, memo: string) => {
    try {
        const code: string = `metatoken.gm`;
        const actor: string = `coin.reptile`;

        const actions = [{
            account: code,
            name: `transfer`,
            authorization: [{
                actor: actor,
                permission: `owner`
            }],
            data: {
                from: actor,
                to: recipient,
                quantity: quantity,
                memo: memo
            }
        }]

        const transaction = { actions: actions }

        const config = {
            blocksBehind: 3,
            expireSeconds: 30
        }

        const result = tokenApi && await tokenApi.transact(transaction, config);
        return result;
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
    return false;
}

const mintNft = async (recipient: string, schemaName: string, templateId: string) => {
    try {
        const code: string = `atomicassets`;
        const actor: string = `chat.reptile`;

        const actions = [{
            account: code,
            name: `mintasset`,
            authorization: [{
                actor: actor,
                permission: `active`
            }],
            data: {
                authorized_minter: actor,
                collection_name: collectionName,
                schema_name: schemaName,
                template_id: templateId,
                new_asset_owner: recipient,
                immutable_data: [],
                mutable_data: [],
                tokens_to_back: []
            }
        }]

        const transaction = { actions: actions }

        const config = {
            blocksBehind: 3,
            expireSeconds: 30
        }

        const result = nftApi && await nftApi.transact(transaction, config);
        return result
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
    return { error: 'some error occured' };
}

export const getTableRows = async (code: string, scope: string, table: string, 
    limit: number) => {
    try {
        const tableRows = await rpc.get_table_rows({
            json: true,
            code: code,
            scope: scope,
            table: table,
            limit: limit
        });
        return tableRows;
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
    return false;
}

export const chooseRand = (probs: Array<number>) => {
    const rand: String = ((Math.random() * 1000) + 1).toFixed(3);
    for (let i = 0; i < probs.length; i++) {
        let probFraction: number = 0;
        for (let j = 0; j <= i; j++) {
            probFraction += probs[j];
        }
        if (Number(rand) <= probFraction) {
            return i;
        }
    }
    return -1;
}

export const getAcctColStats = async (account: string, colName: string) => {
    const ae = getAtomicEndpoint();
    const acctColEndpoint: string = `${ae}/accounts/${account}/${colName}`;
    try {
        const result = await fetch(acctColEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getAcctStats = async (account: string, colNames: Array<string>) => {
    const ae = getAtomicEndpoint();
    const collectionNames: string = colNames.join(`%2C`);
    const acctEndpoint: string = `${ae}/accounts/${account}?collection_whitelist=${collectionNames}`;
    try {
        const result = await fetch(acctEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getAcctBurns = async (account: string, colNames: Array<string>) => {
    const ae = getAtomicEndpoint();
    const collectionNames: string = colNames.join('%2C');
    const burnEndpoint: string = `${ae}/burns/${account}?collection_whitelist=${collectionNames}`;
    try {
        const result = await fetch(burnEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getTemplates = async (colName: string, schema: string | boolean) => {
    const ae = getAtomicEndpoint();
    const page: number = 1;
    const limit: number = 1000;
    const order: string = 'desc';
    const sort: string = 'created';
    let tmptEndpoint: string = '';
    if (schema) {
        tmptEndpoint = `${ae}/templates?collection_name=${colName}&schema_name=${schema}&page=${page}&limit=${limit}&order=${order}&sort=${sort}`;
    } else {
        tmptEndpoint = `${ae}/templates?collection_name=${colName}&page=${page}&limit=${limit}&order=${order}&sort=${sort}`
    }
    const res = await fetch(tmptEndpoint).then(resp => resp.json())
        .catch(err => console.log(err));
    return res;
}

export const fetcher = async (url: string): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }

    const r = await fetch(url)
        .then(resp => resp.json())
        .catch(err => {
            res.error = err;
        })

    res.data = r;

    return res;
}

export const BufferFetcher = async (url: string): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }

    const r = await fetch(url)
        .then(resp => resp.arrayBuffer())
        .catch(err => {
            res.error = err;
        })

    res.data = r;

    return res;
}