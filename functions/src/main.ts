import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { getEnergyLeft, deductMasterEnergy, getMasterEnergyInv, getBatteryAndCollector, getMasterBurnStats, calcBatteryEnergyStar, calcBoosterEnergy, calcMasterEnergyStar, updateEnergy } from './masterEnergy';
import { getAcctBurns, getAcctColStats, getAcctStats, mintHarvestNft } from './helpers';

const connectionString = process.env.CONNECTION_STRING_REP;
const client = connectionString && new MongoClient(connectionString);

const db = client && client.db(`Reptilium`);
const accounts = db && db.collection(`Accounts`);

const colName = `nft.reptile`;

export const harvest = async (addr: string, foodType: string, enhancer: string) => {
    client && await client.connect();
    let userStats = await getUserStats(addr);
    if (userStats) {
        const tableScrapsLeft: number = userStats.tableScrapsLeft;
        const superFoodLeft: number = userStats.superFoodLeft
        const mouseFarmCount: number = userStats.RodentFarm;
        const cricketFarmCount: number = userStats.CricketFarm;
        const energyLeft: number = userStats.reptileEnergyLeft;
        interface count {
            [type: string]: number
        }
        const foodFarmCount: count = {
            mouse: mouseFarmCount,
            cricket: cricketFarmCount
        }
        const enhancerTypeCount: count = {
            superfood: superFoodLeft,
            tablescraps: tableScrapsLeft
        }
        const farmCount: number = foodFarmCount[foodType];
        const enhancerCount: number = enhancerTypeCount[enhancer];
        
        if (farmCount > 0 && enhancer === `none`) {
            const masterEnergyStats: any = await getEnergyLeft(addr);
            let mel: number = 0;
            if (masterEnergyStats !== null && masterEnergyStats.hasOwnProperty(`Collector`)
                && masterEnergyStats.Collector === true) {
                mel = masterEnergyStats.masterEnergyLeft;
            }
            if (mel + energyLeft >= 5) {
                let energyToDeduct: number = 0;
                let nrgIncrement: number = 0;
                if (mel >= 5) {
                    mel -= 5;
                    energyToDeduct = 5;
                    nrgIncrement = 0;
                } else if (mel < 5 && mel > 0) {
                    nrgIncrement = 5 - mel;
                    energyToDeduct = mel;
                    energyToDeduct -= nrgIncrement;
                    mel = 0;
                } else {
                    energyToDeduct -= 5;
                    nrgIncrement = 5;
                }
                let de: Array<any> = [2];
                if (nrgIncrement < 5) {
                    de[0] = await deductMasterEnergy(addr, energyToDeduct);
                } else {
                    de[0] = false;
                }
                de[1] = await deductEnergy(addr, nrgIncrement);
                const res = await checkUserHasFarm(addr, foodType).then(async userHasFarm => {
                    if (userHasFarm) {
                        const res = await tryHarvest(addr, foodType, enhancer, 150);
                        return res;
                    } else {
                        nrgIncrement = 0;
                        energyToDeduct = 0;
                        return false;
                    }
                });
                return {res, de}
            }
            return `not enough energy`;
        } else if (farmCount > 0 && (enhancer === `superfood` 
            || enhancer === `tablescraps`) && enhancerCount > 0) {
            const der = await deductEnhancer(addr, enhancer);
            let res = {}
            if (enhancer === `superfood` && der) {
                res = await tryHarvest(addr, foodType, enhancer, 500);
            } else if (enhancer === `tablescraps` && der) {
                res = await tryHarvest(addr, foodType, enhancer, 100);
            }
            return {res, der}
        }
        return `no farm found`;
    }
    return `user does not exist in the database`;
}

export const getInv = async (addr: string) => {
    const userStats = await getUserStats(addr);
    const masterEnergyData = await getMasterEnergyInv(addr);

    if (userStats) {
        let superFoodUsed: number = userStats.SuperFoodUsed;
        let tableScrapsUsed: number = userStats.tableScrapsUsed;
        const tableScrapsLeft: number = userStats.tableScrapsLeft;
        const reptileEnergyCap: number = userStats.reptileEnergyCap;

        if (superFoodUsed === undefined) superFoodUsed = 0;
        if (tableScrapsUsed === undefined) tableScrapsUsed = 0;

        const burnStats = await getBurnStats(addr);
        const itemsLeft = await getItemsLeft(addr, tableScrapsUsed, superFoodUsed);

        if (masterEnergyData) {
            let batteries = masterEnergyData.Batteries;
            const burnedBatteriesOnFile = masterEnergyData.burnedBatteriesOnFile;
            let masterEnergyUsed = masterEnergyData.masterEnergyUsed;
            let masterEnergyLeft = masterEnergyData.masterEnergyLeft;
            const masterNRGburned = masterEnergyData.masterNRGburned;
            const masterEnhancerBurns = masterEnergyData.masterEnhancerBurns;
            let tokensNRG = masterEnergyData.tokensNRG;
            const masterStarBurnUsed = masterEnergyData.masterStarBurnUsed;
            let collector = masterEnergyData.Collector;
            const monthlyBooster = masterEnergyData.masterBoosters;

            while (masterEnergyUsed >= 240) {
                masterEnergyUsed -= 240;
                tokensNRG++;
            }

            const batteryAndColStats = await getBatteryAndCollector(itemsLeft.userData);
            const masterBurnStats = await getMasterBurnStats(burnStats);

            if (masterBurnStats) {
                batteries = batteryAndColStats[0];
                // TRUE OR FALSE IF HOLDING COLLLECTOR
                collector = batteryAndColStats[1];
                // USER HOLDING ENAHCNERS FOR ME    
                let masterEnergyEnhancer = batteryAndColStats[6]; // TOTAL BOOSTER COUNT
                let totalBurnedBatteries = masterBurnStats[0];
                let masterStarBurn = masterBurnStats[1];
                let totalMasterBoosterBurn = masterBurnStats[2];    
    
                if (masterStarBurn - masterStarBurnUsed > 0) {
                    let starEnergy = calcMasterEnergyStar(masterStarBurnUsed, masterStarBurn);
                    masterEnergyLeft += starEnergy;
                    masterStarBurn -= masterStarBurnUsed;
                } else {
                    masterStarBurn = 0;
                }
    
                if (totalBurnedBatteries - burnedBatteriesOnFile > 0) {
                    let batteryEnergy = calcBatteryEnergyStar(totalBurnedBatteries, burnedBatteriesOnFile);
                    tokensNRG += batteryEnergy;
                    totalBurnedBatteries -= burnedBatteriesOnFile;
                } else {
                    totalBurnedBatteries = 0;
                }
    
                if (totalMasterBoosterBurn - monthlyBooster > 0) {
                    let boosterEnergy = calcBoosterEnergy(totalMasterBoosterBurn, monthlyBooster);
                    masterEnergyLeft += boosterEnergy;
                    totalMasterBoosterBurn -= monthlyBooster;
                } else {
                    totalMasterBoosterBurn = 0;
                }
    
                if (masterEnergyLeft == undefined) {
                    masterEnergyLeft = 0;
                }
                try {
                    await updateEnergy({addr, batteries,
                        masterEnergyUsed, masterEnergyLeft, masterNRGburned, masterEnhancerBurns,
                        masterEnergyEnhancer, tokensNRG, collector,
                        totalBurnedBatteries, masterStarBurn, totalMasterBoosterBurn
                    });
                } catch (error) {
                    console.log(error);
                }
            }
            const filter = { Account: (addr) };
            const options = { upsert: false };
            const updateDoc = {
                $set: {
                    CricketFarm: itemsLeft.cricketFarm,
                    RodentFarm: itemsLeft.rodentFarm,
                    superFoodLeft: itemsLeft.superFoodlLeft,
                    tableScrapsLeft: tableScrapsLeft,
                    burnedMice: itemsLeft.burnedMice,
                    burnedCrickets: itemsLeft.burnedCrickets,
                    reptileEnergyCap: reptileEnergyCap,
                },
            };
            try {
                if (accounts) {
                    const result = await accounts.updateOne(filter, updateDoc, options);
                    return result;
                }
            } catch (error) {
                console.log(error);
            }
        }
    }
    return false;
}

const tryHarvest = async (addr: string, foodType: string, enhancer: string, 
    chance: number) => {
    const rand = getRand();
    if (rand <= chance) {
        const res = await mintHarvestNft(addr, foodType, enhancer);
        return res;
    } else {
        return false;
    }
}

const getUserStats = async (addr: string) => {
    try {
        const query = { Address: addr }
        const findOptions = {
            projection: {
                tableScrapsLeft: 1, 
                superFoodLeft: 1,
                tableScrapsUsed: 1,
                superFoodUsed: 1,
                RodentFarm: 1, 
                CricketFarm: 1,
                reptileEnergyLeft: 1,
                reptileEnergyCap: 1
            }
        }
        if (accounts) {
            const stats = await accounts.findOne(query, findOptions);
            return stats;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

const getRand = () => {
    const x = (Number(Math.random().toFixed(3)) * 1000) + 1;
    return x;
}

const checkUserHasFarm = async (addr: string, farmType: string) => {
    interface tempIds {
        [type: string]: string,
    }
    const tempIds: tempIds = {
        mouse: `363215`,
        cricket: `363214`
    }
    const userHasFarm = await getAcctColStats(addr, colName).then(res => {
        if (res) {
            const data = (res as any).data;
            const templates = data.templates;
            const templateIds: Array<string> = templates.map((template: any) => template.template_id);
            if (templateIds.includes(tempIds[farmType])) {
                return true;
            }
        }
        return false;
    });
    return userHasFarm;
}

const deductEnergy = async (addr: string, amt: number) => {
    try {
        const filter = { Address: addr }
        const options = { upsert: false }
        const newData = {
            $inc: {
                reptileEnergyLeft: -amt
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

const deductEnhancer = async (addr: string, enhancerType: string) => {
    try {
        const filter = { Address: addr }
        let newData = {};
        if (enhancerType === `superfood`) {
            newData = {
                $inc: {
                    superFoodLeft: -1,
                    superFoodUsed: +1
                }
            }
        } else if (enhancerType === `tablescraps`) {
            newData = {
                $inc: {
                    tableScrapsLeft: -1,
                    tableScrapsUsed: +1
                }
            }
        }
        if (accounts) {
            const res = await accounts.updateOne(filter, newData);
            return res;
        }
    } catch (error) {
        console.log(error);
    }
    return false;
}

export const getColStats = async (addr: string) => {
    const reptiliumData: Array<any> = []
    const res = await getAcctStats(addr, [`nft.reptile`, `nrgsyndicate`]).then(stats => {
        for (let i = 0; i < stats.data.templates.length; i++) {
            const temp = JSON.stringify(stats.data.templates[i]);
            if (temp.includes('"template_id":"363214"')) {
                const splitMe = temp.split('"')[11];
                const thenum = splitMe.match(/\d+/)![0] // "3"
                reptiliumData[0] = parseInt(thenum, 10);
            }
            if (temp.includes('"template_id":"363215"')) {
                var splitMe = temp.split('"')[11];
                const thenum = splitMe.match(/\d+/)![0] // "3"
                reptiliumData[1] = parseInt(thenum, 10);
            }
        }
        return reptiliumData;
    });
    return res;
}

export const getBurnStats = async (addr: string) => {
    const burnData = [5];
    burnData[0] = 0; // tableScraps burns [0] 
    burnData[1] = 0; // superFood [1] 
    burnData[2] = 0; // burned mice [2]
    burnData[3] = 0; // burned crickets [3]
    
    const colBurnStats = await getAcctBurns(addr, [`nft.reptile`]);

    var x = JSON.stringify(colBurnStats);
    // 245059 returns all tableScraps burns 
    if (x.includes('"collection_name":"nft.reptile","template_id":"363235","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363235"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[0] = parseInt(thenum, 10);
    }
    else {
        burnData[0] = 0;
    }
    // 245059 returns all superFood burns
    if (x.includes('"collection_name":"nft.reptile","template_id":"363230","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363230"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[1] = parseInt(thenum, 10);
    }
    else {
        burnData[1] = 0;
    }
    //  1 x mice
    if (x.includes('"collection_name":"nft.reptile","template_id":"363217","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363217"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[2] += parseInt(thenum, 10);
    }
    else {
        burnData[2] += 0;
    }
    //  5 x mice
    if (x.includes('"collection_name":"nft.reptile","template_id":"363220","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363220"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[2] += (5 * parseInt(thenum, 10));
    }
    else {
        burnData[2] += 0;
    }
    //  10 x mice
    if (x.includes('"collection_name":"nft.reptile","template_id":"363222","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363222"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[2] += (10 * parseInt(thenum, 10));
    }
    else {
        burnData[2] += 0;
    }
    //  100 x mice
    if (x.includes('"collection_name":"nft.reptile","template_id":"374720","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"374720"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[2] += (100 * parseInt(thenum, 10));
    }
    else {
        burnData[2] += 0;
    }


    //  1 x cricket
    if (x.includes('"collection_name":"nft.reptile","template_id":"363216","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363216"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[3] += parseInt(thenum, 10);
    }
    else {
        burnData[3] += 0;
    }
    //  5 x cricket
    if (x.includes('"collection_name":"nft.reptile","template_id":"363218","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363218"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[3] += (5 * parseInt(thenum, 10));
    }
    else {
        burnData[3] += 0;
    }

    //  10 x cricket
    if (x.includes('"collection_name":"nft.reptile","template_id":"363221","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"363221"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[3] += (10 * parseInt(thenum, 10));
    }
    else {
        burnData[3] += 0;
    }
    //  100 x cricket
    if (x.includes('"collection_name":"nft.reptile","template_id":"374732","assets"')) {
        const myArr = x.split('"collection_name":"nft.reptile","template_id":"374732"');
        var splitMe = myArr[1].split('"')[3];
        const thenum = splitMe.match(/\d+/)![0] // "3"
        burnData[3] += (100 * parseInt(thenum, 10));
    }
    else {
        burnData[3] += 0;
    }
    burnData[4] = colBurnStats;

    return burnData
}

const getItemsLeft = async (addr: string, tableScrapsUsed: number, 
    superFoodUsed: number) => {
    const reptiliumData = await getColStats(addr);
    const cricketFarm = reptiliumData[0];
    const rodentFarm = reptiliumData[1];
    const userData = reptiliumData[2];
    const reptileEnergyCap = (cricketFarm * 10) + (rodentFarm * 10);
    
    const burnData = await getBurnStats(addr);
    const tableScrapsBurned = burnData[0];
    const superFoodBurned = burnData[1];
    const burnedMice = burnData[2];
    const burnedCrickets = burnData[3];

    const tableScrapsLeft = (tableScrapsBurned - tableScrapsUsed);
    const superFoodlLeft = (superFoodBurned - superFoodUsed);
    return { burnedMice, burnedCrickets, userData, tableScrapsLeft, superFoodlLeft, cricketFarm,
        rodentFarm, reptileEnergyCap }
}