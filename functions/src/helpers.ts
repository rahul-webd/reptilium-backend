import { JsonRpc, RpcError } from 'eosjs';
import fetch from 'node-fetch';
import 'dotenv/config';

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

const rpcEndpoint: string = `https://${rpcEndpoints[0]}`;

const rpc = new JsonRpc(rpcEndpoint, { fetch });

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
