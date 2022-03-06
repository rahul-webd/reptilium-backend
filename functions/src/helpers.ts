import { Api, JsonRpc, RpcError } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { TextEncoder, TextDecoder } from 'text-encoding';
import fetch from 'node-fetch';
import 'dotenv/config';

const chatReptilePvk: string | undefined = process.env.CHAT_REPTILE_KEY;
const signatureProvider = typeof chatReptilePvk === 'string' 
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
    `wax.blockcrafters.io`,
    `api.wax-aa.bountyblok.io`,
    `atomic-wax-mainnet.wecan.dev`,
    `aa.dapplica.io`,
    `api-wax-aa.eosarabia.net`,
    `aa-api-wax.eosauthority.com`,
    `wax-aa.eosdublin.io`,
    `wax-atomic-api.eosphere.io`,
    `atomic.wax.eosrio.io`,
    `api.atomic.greeneosio.com`,
    `aa-wax-public1.neftyblocks.com`,
    `wax.hkeos.com/aa`,
    `atomic.ledgerwise.io`,
    `atomic.tokengamer.io`,
    `atomic.hivebp.io`,
    `atomic2.hivebp.io`,
]

const collectionName: string = `nft.reptile`;

const rpcEndpoint: string = `https://${rpcEndpoints[0]}`;
const atomicEndpoint: string = `https://${atomicEndpoints[0]}/atomicassets/v1`;

const rpc = new JsonRpc(rpcEndpoint, { fetch });
const api = signatureProvider 
    && new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), 
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
    const enhancedProbs: Array<number> = [20, 100, 180, 700];

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
                const res = await mintNft(recipient, typeSchmName, tmptToReward);
                return res;
            }
        }
        return -1;
    }

    if (enhancer !== 'none') {
        const res = await reward(enhancedProbs);
        return res;
    } else  {
        const res = await reward(probs);
        return res;
    }
}

const transferTokens = async (recipient: string, quantity: string, memo: string) => {
    try {
        const code: string = `metatoken.gm`;
        const actor: string = `chat.reptile`;

        const actions = [{
            account: code,
            name: `transfer`,
            authorization: [{
                actor: actor,
                permission: `active`
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

        const result = api && await api.transact(transaction, config);
        console.log(result);
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
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

        const result = api && await api.transact(transaction, config);
        return result
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
    return -1;
}

export const getShopTableRows = async () => {
    try {
        const tableRows = await rpc.get_table_rows({
            json: true,
            code: `shop.cait`,
            scope: `shop.cait`,
            table: `menu`,
            limit: 9999
        });
        return tableRows;
    } catch (error) {
        console.log(error);
        if (error instanceof RpcError) {
            console.log(error.json, null, 2);
        }
    }
    return -1;
}

const chooseRand = (probs: Array<number>) => {
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
    const acctColEndpoint: string = `${atomicEndpoint}/accounts/${account}/${colName}`;
    try {
        const result = await fetch(acctColEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getAcctStats = async (account: string, colNames: Array<string>) => {
    const collectionNames: string = colNames.join(`%2C%20`);
    const acctEndpoint: string = `${atomicEndpoint}/accounts/${account}?collection_whitelist=${collectionNames}`;
    try {
        const result = await fetch(acctEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getAcctBurns = async (account: string, colNames: Array<string>) => {
    const collectionNames: string = colNames.join('%2C%20');
    const burnEndpoint: string = `${atomicEndpoint}/burns/${account}?collection_whitelist=${collectionNames}`;
    try {
        const result = await fetch(burnEndpoint).then(resp => resp.json());
        return result;
    } catch (error) {
        console.log(error);
    }
    return false;
}