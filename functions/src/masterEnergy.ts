import { MongoClient } from "mongodb";
import "dotenv/config";

const connectionString = process.env.CONNECTION_STRING_NRG; 
const client = connectionString && new MongoClient(connectionString);
const database = client && client.db('NRG');
const accounts = database && database.collection(`MasterNrgAccounts`);


//@ts-ignore
interface account {
    userName: string,
    Batteries: number,
    burnedBatteriesOnFile: number,
    masterEnergyUsed: number,
    masterEnergyLeft: number,
    masterNRGburned: number,
    masterEnergyEnhancer: number,
    masterEnhancerBurns: number,
    tokensNRG: number,
    masterStarBurnUsed: number,
    Collector: number,
    masterBoosters: number
}

const connect = async () => {
    client && await client.connect();
}

export const getMasterEnergyInv = async (addr: string) => {
    await connect();
    try {
        const query = { Address: addr };
        const findOptions = {
            projection: {
                Batteries: 1,
                burnedBatteriesOnFile: 1,
                masterEnergyUsed: 1,
                masterEnergyLeft: 1,
                masterNRGburned: 1,
                masterEnergyEnhancer: 1,
                masterEnhancerBurns: 1,
                tokensNRG: 1,
                masterStarBurnUsed: 1,
                Collector: 1,
                masterBoosters: 1
            }
        }
        if (accounts)  {
            const data = await accounts.findOne(query, findOptions);
            return data;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
};

export const getEnergyLeft = async (addr: string) => {
    await connect();
    try {
        const query = { Account: addr };
        const findOptions = {
            projection: {
                masterEnergyLeft: 1,
                Collector: 1
            }
        }
        if (accounts) {
            const data = accounts && await accounts.findOne(query, findOptions);
            return data;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const updateEnergy = async (data: any) => {
    await connect();
    try {
        const filter = { Account: (data.addr) }
        const options = { upsert: false }
        const newData = {
            $set: {
                Batteries: data.batteries,
                Collector: data.collector,
                masterEnergyUsed: data.masterEnergyUsed,
                masterEnergyLeft: data.masterEnergyLeft,
                masterNRGburned: data.masterNRGburned,
                masterEnhancerBurns: data.masterEnhancerBurns,
                masterEnergyEnhancer: data.masterEnergyEnhancer,
                tokensNRG: data.tokensNRG
            },
            $inc: {
                burnedBatteriesOnFile: +(data.totalBurnedBatteries),
                masterBoosters: +(data.totalMasterBoosterBurn),
                masterStarBurnUsed: +(data.masterStarBurn)
            }
        }
        if (accounts) {
            const res = await accounts.updateOne(filter, newData, options);
            return res;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const deductMasterEnergy = async (addr: string, amt: number) => {
    await connect();
    try {
        const filter = { Account: addr }
        const newData = {
            $inc: {
                masterEnergyLeft: -amt,
                masterEnergyUsed: +amt
            }
        }
        if (accounts) {
            const res = accounts.updateOne(filter, newData);
            return res;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getMasterBurnStats = async (stats: any) => {
    try {
        // array containing 
        // battery [0]
        // NRG star [1]
        // monthly booster [2]
        var nrgBurns = [3];
        var i = JSON.stringify(stats.data.templates);

        // BURNED BATTERIES [0] 
        nrgBurns[0] = 0;
        if (i.includes('"collection_name":"nrgsyndicate","template_id":"382048","assets"')) {
            const myArr = i.split('{"collection_name":"nrgsyndicate","template_id":"382048"');
            const splitMe = myArr[1].split('"')[3];
            const thenum = splitMe.match(/\d+/)![0] // "3"
            nrgBurns[0] = parseInt(thenum, 10);
        } else {
            nrgBurns[0] = 0;
        }
        // NRG STAR  [1] 
        nrgBurns[2] = 0;
        if (i.includes('"collection_name":"nrgsyndicate","template_id":"383203","assets"')) {
            const myArr = i.split('{"collection_name":"nrgsyndicate","template_id":"383203"');
            const splitMe = myArr[1].split('"')[3];
            const thenum = splitMe.match(/\d+/)![0] // "3"
            nrgBurns[1] = parseInt(thenum, 10);
        } else {
            nrgBurns[1] = 0;
        }
        if (i.includes('"collection_name":"nrgsyndicate","template_id":"410889","assets"')) {
            const myArr = i.split('{"collection_name":"nrgsyndicate","template_id":"410889"');
            const splitMe = myArr[1].split('"')[3];
            const thenum = splitMe.match(/\d+/)![0] // "3"
            nrgBurns[1] += parseInt(thenum, 10);
        } else {
            nrgBurns[1] += 0;
        }
        const query = ({ Account: 'teagranny' });
            const findOptions = { projection: { BoosterTemplates: 1 } };
            if (accounts) {
                let cursor = await accounts.findOne(query, findOptions);
                const items = cursor && cursor.BoosterTemplates;// EXPIRED BOOSTERS
                for (let i = 0; i < stats.data.templates.length; i++) {
                    for (const item of Object.entries(items)) {
                        if (JSON.stringify(item).includes(stats.data.templates[i].template_id)) {
                            const templateCount = 
                                parseInt(stats.data.templates[i].assets, 10);
                            nrgBurns[2] += templateCount;
                        }
                    }
                }
            }
        return nrgBurns;
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getBatteryAndCollector = async (stats: any) => {
    const nftsNRG: Array<any> = [6];
    nftsNRG[1] = false;
    nftsNRG[3] = 0;
    try {
        for (let i = 0; i < stats.data.templates.length; i++) {
            var temp = JSON.stringify(stats.data.templates[i]);
            if (temp.includes('"collection_name":"nrgsyndicate"')) {
                // batteries
                if (temp.includes('"template_id":"382048"')) {
                    var splitMe = temp.split('"')[11];
                    nftsNRG[0] = parseInt(splitMe, 10);
                }
                // collectors
                if (temp.includes('"template_id":"382045"')) {
                    nftsNRG[1] = true;
                }
            }
        }
        let boosters = 0;
        const query = ({ Account: 'teagranny' });
        const findOptions = { projection: { CurrentBoosters: 1 } };
        if (accounts) {
            const cursor = await accounts.findOne(query, findOptions);
            const items = cursor && cursor.CurrentBoosters;
            for (let i = 0; i < stats.data.templates.length; i++) {
                for (const item of Object.entries(items)) {
                    if (JSON.stringify(item).includes(stats.data.templates[i].template_id)) {
                        const templateCount = parseInt(stats.data.templates[i].assets, 10);
                        boosters += templateCount;
                        const tempNew = JSON.stringify(item);
                        var splitMe = tempNew.split(',')[2];
                        const project = splitMe.replace(/[^a-zA-Z ]/g, "");
                        switch (project) {
                            case 'ATG':
                                nftsNRG[5] = templateCount;
                                break;
                            case 'Bear':
                                nftsNRG[4] = templateCount;
                                break;
                            case 'SS':
                                //  nftsNRG[3]
                                break;
                            case 'David':
                                //nftsNRG[3]
                                break;
                            case 'PT':
                                //nftsNRG[3]
                                break;
                            default:
                                console.log('none');
                        }
                    }
                }
            }
        }
        nftsNRG[6] = boosters;
    } catch (error) {
        console.log(error);
    }
    return nftsNRG;
}

export const calcMasterEnergyStar = (a: number, b: number) => {
    const stars = a - b;
    const starEnergy = stars * 100;
    return starEnergy;
}

export const calcBatteryEnergyStar = (a: number, b: number) => {
    if (b === undefined) b = 0;
    const batteries = a - b;
    const batteryEnergy = batteries * 90;
    return batteryEnergy;
}

export const calcBoosterEnergy = (a: number, b: number) => {
    if (a === undefined) a = 0;
    const boosters = a - b;
    const boostersEnergy = boosters * 1000;
    return boostersEnergy;
}