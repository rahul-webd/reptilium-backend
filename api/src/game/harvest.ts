import { db } from "..";
import { getFoodRewardOdds, getOdds } from "../admin/admin";
import { chooseRand } from "../helpers";
import { harvestBoosters, simpleCount } from "../interfaces";
import { energyMultipler, getDbUserName, getHarvestBoosterBurns, harvestBoosterNames } from "../main";

export const addHarvestBoosters = async (addr: string, 
    tmptIds: Array<string>) => {
    
    const u = getDbUserName(addr);
    let harvestBoosters: harvestBoosters = {
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
    const harvestBoostersRef 
        = db.ref(`users/${u}/harvest_boosters`);
    let res = {}
    const snapshot = await harvestBoostersRef.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        const hbVal = snapshot.val();

        harvestBoosters = { ...hbVal }
        tmptIds.forEach((tmptId: string) => {
            const tmptName = harvestBoosterNames[tmptId];
            const shb = hbVal[tmptName];
            const count = shb.count;
            const p = shb.prev_burns;
            const c = curBurns[tmptId];
            const countToAdd = c - p;
            const newCount = count + countToAdd;
            harvestBoosters[tmptName].count = newCount >= 0 ? newCount : 0;
            harvestBoosters[tmptName].prev_burns = c;
        });
    }

    await harvestBoostersRef.update(harvestBoosters, (err) => {
        if (err) {
            res = { error: err };
        } 
        res = harvestBoosters;
    });
    
    return res;
}

export const harvestFood = async (addr: string, foodType: string, enhancer: string) => {
    const dbName = getDbUserName(addr);

    let odds: simpleCount = {
        none: 150,
        super_food: 500,
        table_scraps: 100
    }    
    
    const oddData = await getOdds();

    if (!oddData.error && oddData.data) {
        odds = oddData.data
    }

    const u = getDbUserName(addr);
    let rewardOdd = odds[enhancer];
    let res = {}

    const userRef = db.ref(`users/${u}`);

    const snapshot = await userRef.once('value').catch(err => {
        res = { error: err }
    });

    if (snapshot && snapshot.exists()) {
        const userVal = snapshot.val();
        const userToUpdate = { ...userVal };
        const energy = userVal.energy;

        //TODO interface for res
        const harvest = async () => {                
            const harvestRes = await tryHarvest(dbName, foodType, enhancer, rewardOdd);
            
            await userRef.update(userToUpdate, (err: any) => {
                if (err) {
                    res = { error: err.name, harvest: harvestRes }
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
            const newEc = ec - 1

            if (ec !== 0) {
                userToUpdate['harvest_boosters'][enhancer].count = newEc >= 0 ? newEc : 0;
                await harvest();
            } else {
                res = { error: `user has no ${enhancer}` }
            }
        }

    } else {
        res = { error: 'user does not exist' }
    }

    return res;
}

export const refreshBurns = async (addr: string) => {
    const boosterIds = ['363230', '363235']
    const harvestBoosters = await addHarvestBoosters(addr, boosterIds);
    return harvestBoosters;
}

const tryHarvest = async (addr: string, foodType: string, 
    enhancer: string, odds: number) => {

    const luck = getUserLuck();
    let res = {}

    if (luck <= odds) {
        res = await updateHarvestCount(addr, foodType, enhancer);
    } else {
        res = { error: 'harvest unsuccessful' }
    }

    return res;
}

const getUserLuck = () => {
    let rand = Math.random();
    rand = Number(rand.toFixed(3));
    rand = rand * 1000;
    rand = rand + 1;
    return rand;
}

const updateHarvestCount = async (addr: string, type: string, enhancer: string) => {

    let probs: number[] = [0, 20, 130, 850];
    let enhancedProbs: number[] = [50, 200, 250, 500];

    if (enhancer === 'table_scraps') {

        enhancedProbs = [50, 200, 300, 450]
    } else if (enhancer === 'super_food') {

        enhancedProbs = [100, 200, 400, 300]
    }

    const s = await getFoodRewardOdds();

    if (!s.error && s.data) {

        probs = s.data.none;
        enhancedProbs = s.data[enhancer]
    }

    let res = {}

    const probsMap: Map<number, number> = new Map([
        [0, 100],
        [1, 10],
        [2, 5],
        [3, 1]
    ]);

    const reward = async (probType: number[]) => {
        const chosenRand: number = chooseRand(probType);
        if (chosenRand !== -1 && chosenRand < 4) {
            const count = probsMap.get(chosenRand);
            if (count) {

                const farmTypeRef = db
                    .ref(`foodCount/${addr}/${type}`);

                const snapshot = await farmTypeRef.once('value')
                .catch(err => {
                    res = { error: err }
                });

                if (snapshot && !snapshot.exists()) {
                    await farmTypeRef.set(count, err => {
                        if (err) {
                            res = { error: err }
                        } else {
                            res = { count: count }
                        }
                    });

                } else if (snapshot && snapshot.exists()) {
                    const pc = snapshot.val();
                    const nc = pc + count; 
                    await farmTypeRef.set(nc, 
                        err => {
                            if (err) {
                                res = { error: err }
                            } else {
                                res = { count }
                            }
                        });
                }
            }
        } else {
            res = { error: 'some error occured' }
        }
    }

    if (enhancer !== 'none') {
        await reward(enhancedProbs);
    } else  {
        await reward(probs);
    }

    return res;
}