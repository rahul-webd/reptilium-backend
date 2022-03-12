import * as admin from 'firebase-admin';
import { getAcctBurns, getAcctStats, mintHarvestNft } from './helpers';

admin.initializeApp();

interface simpleCount {
    [id: string]: number
}

interface simpleNames {
    [id: string]: string
}

interface user {
    energy: number,
    energy_generation_points: number,
    claim_timestamp: object,
    harvest_boosters: harvestBoosters
}

interface harvestBoosters {
    [type: string]: harvestBooster
}

interface harvestBooster {
    count: number,
    prev_burns: number
}

interface energyBoosters {
    id: string,
    count: number
}

const energyGenPoints: simpleCount = {
    "382048": 1,
    "382045": 2,
    "363214": 5,
    "363215": 5
}

const harvestBoosterNames: simpleNames = {
    "363235": "super_food",
    "363230": "table_scraps"
}

const colNames = ['nft.reptile', 'nrgsyndicate']

const energyMultipler = 5;
const renewInterval = 2 * 60 * 60 * 1000;

export const getUser = async (addr: string, tmpts: Array<energyBoosters>) => {
    let u = addr;
    // check if tmptIds actually exist with the user
    const p: number = getEnergyBoosterPoints(tmpts);
    u = getDbUserName(addr);
    const usersRef = admin.database().ref(`users/${u}`);
    let res = {}
    await usersRef.get().then(async snapshot => {

        if (snapshot.exists()) {
            const user = snapshot.val();
            const userToUpdate = { ...user };
            const gp = user.energy_generation_points;
            const prevTimeStamp = user.claim_timestamp;
            const curTimestamp = admin.database.ServerValue.TIMESTAMP;

            // checking if energy gen points have changed
            if (gp !== p) {
                const { p } = await getEnergy(addr);
                userToUpdate.energy_generation_points = p;
            }
            
            // adding energy if renewal interval has passed
            if (curTimestamp >= (prevTimeStamp + renewInterval)) {
                const gp = userToUpdate.energy_generation_points;
                userToUpdate.energy = gp * energyMultipler; 
                userToUpdate.claim_timestamp = curTimestamp;
            }

            //TODO remove extra unnecessary calls to db
            await usersRef.update(userToUpdate, (err) => {
                if (err) {
                    res =  { error: err };
                }
                res = userToUpdate;
            });
        } else {
            const newUser = await createUser(addr, u);
            res = newUser;
        }
    }, err => {
        res = { error: err };
    });
    return res;
}

const createUser = async (addr: string, u: string) => {
    const { e, p } = await getEnergy(addr);
    const usersRef = admin.database().ref('users');
    const userVal: user = {
        energy: e,
        energy_generation_points: p,
        claim_timestamp: admin.database.ServerValue.TIMESTAMP,
        harvest_boosters: {
            super_food: {
                count: 0,
                prev_burns: 0
            },
            table_scraps: {
                count: 0,
                prev_burns: 0
            }
        }
    }
    const hbb = await getHarvestBoosterBurns(addr);
    const hbbKeys = Object.keys(hbb);
    hbbKeys.forEach(id => {
        userVal.harvest_boosters[harvestBoosterNames[id]].count = hbb[id];
    });

    let res = {}
    await usersRef.child(u).set(userVal, (err) => {
        if (err) {
            res = { error: err };
        }
        res = userVal;
    });
    
    return res;
}

// only adding harvest boosters now when the user burned them in app
export const addHarvestBoosters = async (addr: string, tmptIds: Array<string>) => {
    const u = getDbUserName(addr);
    const harvestBoosters: harvestBoosters = {
        super_food: {
            count: 0,
            prev_burns: 0
        },
        table_scraps: {
            count: 0,
            prev_burns: 0
        }
    }
    const curBurns = await getHarvestBoosterBurns(addr);
    const harvestBoostersRef = admin.database().ref(`users/${u}/harvest_boosters`);
    let res = {}
    harvestBoostersRef.get().then(snapshot => {

        if (snapshot.exists()) {
            const hbVal = snapshot.val();
            tmptIds.forEach((tmptId: string) => {
                const tmptName = harvestBoosterNames[tmptId];
                const shb = hbVal[tmptName];
                const count = shb.count;
                const p = shb.prev_burns;
                const c = curBurns[tmptId];
                const countToAdd = c - p;
                harvestBoosters[tmptName].count = count + countToAdd;
                harvestBoosters[tmptName].prev_burns = c;
            });
        }
        harvestBoostersRef.update(harvestBoosters, (err) => {
            if (err) {
                res = { error: err };
            } 
            res = harvestBoosters;
        })
    }, err => {
        res = { error: err };
    });
    return res;
}

export const harvestFood = async (addr: string, foodType: string, enhancer: string) => {
    const odds: simpleCount = {
        none: 150,
        super_food: 500,
        table_scraps: 100
    }

    const u = getDbUserName(addr);
    let rewardOdd = odds[enhancer];
    let res = {}

    const userRef = admin.database().ref(`users/${u}`);

    await userRef.get().then(async snapshot => {
        if (snapshot.exists()) {
            const userVal = snapshot.val();
            const userToUpdate = userVal;
            const energy = userVal.energy;

            //TODO interface for res
            const harvest = async () => {
                const harvestRes = await tryHarvest(addr, foodType, enhancer, rewardOdd);
                await userRef.update(userToUpdate, (err) => {
                    if (err) {
                        res = { error: err, harvest: harvestRes }
                    } else {
                        res = { user: userToUpdate, harvest: harvestRes }
                    }
                })
            };

            if (enhancer === 'none') {
                if (energy !== 0) {
                    userToUpdate.energy = energy - energyMultipler;
                    await harvest();
                } else {
                    res = { error: 'user has no energy' }
                }
            } else {
                let ec = userVal['harvest_boosters'][enhancer].count;

                if (ec !== 0) {
                    userToUpdate[enhancer].count = ec--;
                    await harvest();
                } else {
                    res = { error: `user has no ${enhancer}` }
                }
            }
        } else {
            res = { error: 'user does not exist' }
        }
    }, err => {
        res = { error: err }
    });
    return res;
}

const tryHarvest = async (addr: string, foodType: string, enhancer: string, odds: number) => {
    const luck = getUserLuck();
    let res = {}
    if (luck <= odds) {
        res = await mintHarvestNft(addr, foodType, enhancer);
    } else {
        res = { error: 'harvest unsuccessful' }
    }
    return res;
}

const getEnergy = async (addr: string) => {
    const p = await getEnergyBoosters(addr).then(res => getEnergyBoosterPoints(res));
    const e = p * energyMultipler;
    return { e, p }
}

const getEnergyBoosterPoints = (tmpts: Array<energyBoosters>) => {
    const tmptIds: Array<string> = tmpts.map((tmpt: any) => tmpt.id);
    const p: number = tmptIds.reduce((prev, cur, i) => {
        return prev + (energyGenPoints[cur] * tmpts[i].count);
    }, 0);
    return p;
}

const getEnergyBoosters = async (addr: string) => {
    const acctStats = await getAcctStats(addr, colNames);
    const btKeys: Array<string> = Object.keys(energyGenPoints);
    const ubt = acctStats.data.templates.filter((tmpt: any) => 
        btKeys.includes(tmpt.template_id));
    const res = ubt.map((tmpt: any) => {
        return {
            id: tmpt.template_id,
            count: tmpt.assets
        }
    })
    return res;
}

const getHarvestBoosterBurns = async (addr: string) => {
    const boosterIds = ['363235', '363230'];
    const harvestBoosterBurns: simpleCount = {
        '363235': 0,
        '363230': 0
    }

    const res = await getAcctBurns(addr, [colNames[0]]);
    const templates = res.data.templates
    if (templates.length !== 0) {
        const burnTemplates = templates.filter((template: any) => 
            boosterIds.includes(template.template_id));

        if (burnTemplates.length !== 0) {
            burnTemplates.forEach((bt: any) => {
                harvestBoosterBurns[bt.template_id] = bt.assets;
            });
        }
    }
    return harvestBoosterBurns;
}

const getDbUserName = (addr: string) => {
    let dbName = addr;
    if (addr.includes('.')) {
        dbName = addr.split('.').join('_');
    }
    return dbName;
}

// luck calculated in 1000
const getUserLuck = () => {
    let rand = Math.random();
    rand = Number(rand.toFixed(3));
    rand = rand * 1000;
    rand = rand + 1;
    return rand;
}