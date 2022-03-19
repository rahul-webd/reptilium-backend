import * as admin from 'firebase-admin';
import { getAcctBurns, getAcctStats, getTableRows, mintHarvestNft } from './helpers';

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
    energy_holding_capacity: number,
    energy_holder_points: number,
    claim_timestamp: number,
    harvest_boosters: harvestBoosters
}

interface harvestBoosters {
    [type: string]: harvestBooster
}

interface harvestBooster {
    count: number,
    prev_burns: number
}

interface simpleStat {
    id: string,
    count: number
}

const energyGenPoints: simpleCount = {
    "382045": 1,
    "363214": 1,
    "363215": 1
}

// For these Ids, the asset count is not being calculated
const basicEnergyIds: Array<string> = ['382045', '363214', '363215']

const energyHolderPoints: simpleCount = {
    "382048": 2,
    "363214": 2,
    "363215": 2
}

const harvestBoosterNames: simpleNames = {
    "363230": "super_food",
    "363235": "table_scraps"
}

const colNames = ['nft.reptile', 'nrgsyndicate']

const energyMultipler = 5;
const renewInterval = 1 * 60 * 60 * 1000;

export const getUser = async (addr: string, tmpts: Array<simpleStat>) => {
    let u = addr;

    /*
    taking chain fetch load to client and doing first check by comparing it 
    with prev val in db to save calls to chain.
    If different - then doing check on server side for truth.
    */

    const p: number = calcEnergyBoosterPoints(tmpts);
    const hp: number = calcEnergyHolderPoints(tmpts);
    u = getDbUserName(addr);
    const usersRef = admin.database().ref(`users/${u}`);
    let res = {}
    await usersRef.get().then(async snapshot => {

        if (snapshot.exists()) {
            const user = snapshot.val();
            const userToUpdate = { ...user };
            const e = user.energy;
            const gp = user.energy_generation_points;
            const ehc = user.energy_holding_capacity;
            const uhp = user.energy_holder_points;
            const prevTime = user.claim_timestamp;

            const es = await checkEnergyStats(gp, p, hp, uhp, addr);
            if (es !== -1) {
                userToUpdate.energy_generation_points = es.egp;
                userToUpdate.energy_holder_points = es.ehp;
            }

            const ie = checkIntervalEnergy(prevTime, gp, ehc, e);
            if (ie !== -1) {
                userToUpdate.energy = ie.ne;
                userToUpdate.claim_timestamp = ie.curTime;
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
    const { e, egp, hc, ehp } = await getEnergyStats(addr);
    const usersRef = admin.database().ref('users');
    const curTime: number = getCurTime();
    const userVal: user = {
        energy: e,
        energy_generation_points: egp,
        energy_holding_capacity: hc,
        energy_holder_points: ehp,
        claim_timestamp: curTime,
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
        userVal.harvest_boosters[harvestBoosterNames[id]].prev_burns = hbb[id];
    });

    let res = {}
    await usersRef.child(u).update(userVal, (err) => {
        if (err) {
            res = { error: err };
        }
        res = userVal;
    });
    
    return res;
}

// getting burns of assets can be expanded for other assets when added.
export const addHarvestBoosters = async (addr: string, tmptIds: Array<string>) => {
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
    const harvestBoostersRef = admin.database().ref(`users/${u}/harvest_boosters`);
    let res = {}
    await harvestBoostersRef.get().then(async snapshot => {
        if (snapshot.exists()) {
            const hbVal = snapshot.val();
            harvestBoosters = { ...hbVal }
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
        await harvestBoostersRef.update(harvestBoosters, (err) => {
            if (err) {
                res = { error: err };
            } 
            res = harvestBoosters;
        })
    }, err => {
        res = { error: err };
    });
    console.log(res);
    
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
            const userToUpdate = { ...userVal };
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
                    userToUpdate['harvest_boosters'][enhancer].count = ec - 1;
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
                harvestBoosterBurns[bt.template_id] = Number(bt.assets);
            });
        }
    }
    return harvestBoosterBurns;
}

export const setShopItems = async () => {
    const shopCode: string = `shop.cait`;
    const scope: string = `shop.cait`;
    const tables: simpleNames = {
        menu: `menu`,
        limits: `limits`
    }
    const limit: number = 9999;

    const menuRows: any = (await getTableRows(shopCode, scope, tables.menu, limit) as any).rows;
    const limitsRows: any = (await getTableRows(shopCode, scope, tables.limits, limit) as any).rows;

    if (menuRows && limitsRows) {
        const colMenuRows = menuRows.filter((menuRow: any) => 
            menuRow.CollectionName === colNames[0]);
        const colMenuMemos = colMenuRows.map((colMenuRow: any) =>
            colMenuRow.Memo)
        const colLimitsRows = limitsRows.filter((limitsRow: any) =>
            colMenuMemos.includes(limitsRow.Memo));
        const sortedColLimitRows: Array<any> = [colMenuMemos.length];

        colLimitsRows.forEach((colLimitRow: any) => {
            const limitRowMemo = colLimitRow.Memo;
            const menuRowIndex = colMenuMemos.indexOf(limitRowMemo);
            sortedColLimitRows[menuRowIndex] = colLimitRow;
        });

        const shopItemRows = colMenuRows.map((menuRow: any, index: number) => {
            const memo = menuRow.Memo;
            const templateId = menuRow.TemplateId;
            const price = menuRow.Price;
            const limitRow = sortedColLimitRows[index];
            
            let limit = {}
            if (limitRow) {
                const startTime = limitRow.StartTime;
                const stopTime = limitRow.StopTime;
                const leftToSell = limitRow.LeftToSell;
                const maxToSell = limitRow.MaxToSell;
                const maxPerAccount  = limitRow.MaxPerAccount;
                const secondsBetween = limitRow.SecondsBetween;
                limit = { startTime, stopTime, leftToSell, maxToSell,
                    maxPerAccount, secondsBetween }
            }    
            return { memo, templateId, price, limit }
        });

        const shopItemsRef = admin.database().ref('shop_items');
        await shopItemsRef.set(shopItemRows, err => {
            if (err) {
                console.log(err);
                return;
            }
            console.log(`shop items update completed`);
        });
    }
    return;
}

export const getShopItems = async () => {
    const shopItemsRef = admin.database().ref('shop_items');
    let res = {}
    await shopItemsRef.get().then(snapshot => {
        if (snapshot.exists()) {            
            res = snapshot.val();
        } else {
            res = { error: 'no shop items found' }
        }
    }, err => {
        res = { error: err }
    });
    return res;
}

export const refreshBurns = async (addr: string) => {
    const boosterIds = ['363230', '363235']
    const harvestBoosters = await addHarvestBoosters(addr, boosterIds);
    return harvestBoosters;
}

export const setTgUserName = async (addr: string, tgUserName: string) => {
    const u = getDbUserName(addr);
    const userRef = admin.database().ref(`users/${u}`);
    const usersTgRef = admin.database().ref(`usersTg`);
    const val = { tgUserName }
    const tgVal = { [tgUserName]: addr }
    let res: any = {}
    await userRef.child('tgUserName').get().then(snapshot => {
        if (snapshot.exists()) {
            return snapshot.val();
        }
        return false;
    }, err => {
        res = { error: err }
        return false;
    }).then(async tgUserName => {
        let r;
        if (tgUserName) {
            await usersTgRef.child(tgUserName).remove((err) => {
                if (err) {
                    res = { error: err }
                    r = false;
                } else {
                    r = true;
                }
            })
        }
        if (res.error) {
            r = false;
        } else {
            r = true;
        }
        return r;
    }).then(async resp => {
        let r;
        if (resp) {
            await userRef.update(val, err => {
                if (err) {
                    res = { error: err }
                    r = false;
                } else {
                    res = { val };
                    r = true;
                }
            });
        } else {
            r = false;
        }
        return r;
    }).then(async resp => {
        if (resp) {
            await usersTgRef.update(tgVal, err => {
                if (err) {
                    res = { error: err }
                } else {
                    res = { ...res, tgVal }
                }
            });
        }
    });
    return res;
}

export const getTgUserName = async (addr: string) => {
    const u = getDbUserName(addr);
    const tgUserNameRef = admin.database().ref(`users/${u}/tgUserName`);
    let res = {}
    await tgUserNameRef.get().then(snapshot => {
        if (snapshot.exists()) {
            res = { val: snapshot.val() };
        } else {
            res = { error: 'no data existis' }
        }
    }, err => {
        res = { error: err }
    });
    return res;
}

export const getUserAddr = async (tgUserName: string) => {
    const addrRef = admin.database().ref(`usersTg/${tgUserName}`);
    let res = {}
    await addrRef.get().then(snapshot => {
        if (snapshot.exists()) {
            res = { addr: snapshot.val() }  
        } else {
            res = { error: 'no data exists' }
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

const getEnergyStats = async (addr: string) => {
    const acctStats = await getColStats(addr);
    const energy = await getEnergy(acctStats);
    const energyHolderPoints = await getEnergyHolderPoints(acctStats);
    return {
        e: energy.e,
        egp: energy.p,
        hc: energyHolderPoints.hc,
        ehp: energyHolderPoints.p
    }
}

const getEnergy = async (acctStats: any) => {
    const p = await getEnergyBoosters(acctStats).then(res => calcEnergyBoosterPoints(res));
    const e = p * energyMultipler;
    return { e, p }
}

const getEnergyHolderPoints = async (acctStats: any) => {
    const p = await getEnergyHolders(acctStats).then(res => calcEnergyHolderPoints(res));
    const hc = p * energyMultipler;
    return { hc, p }
}

const calcEnergyBoosterPoints = (tmpts: Array<simpleStat>) => {
    const tmptIds: Array<string> = tmpts.map((tmpt: any) => tmpt.id);
    const p: number = tmptIds.reduce((prev, cur, i) => {
        const ep = energyGenPoints[cur];
        const ec = tmpts[i].count;
        if (basicEnergyIds.includes(cur)) {
            return prev + ep * 1; // more than 1 of these templates do not provide extra energy
        } else {
            return prev + (ep * ec);
        }
    }, 0);
    return p;
}

const calcEnergyHolderPoints = (tmpts: Array<simpleStat>) => {
    const tmptIds: Array<string> = tmpts.map((tmpt: any) => tmpt.id);
    const p: number = tmptIds.reduce((prev, cur, i) => {
        const hp = energyHolderPoints[cur];
        const hc = tmpts[i].count;
        return prev + (hp * hc);
    }, 0);
    return p;
}

const getEnergyBoosters = async (acctStats: any) => {
    const btKeys: Array<string> = Object.keys(energyGenPoints);
    const ubt = acctStats.data.templates.filter((tmpt: any) => 
        btKeys.includes(tmpt.template_id));
    const res = ubt.map((tmpt: any) => {
        return {
            id: tmpt.template_id,
            count: tmpt.assets
        }
    });
    return res;
}

const getEnergyHolders = async (acctStats: any) => {
    const hdKeys: Array<string> = Object.keys(energyHolderPoints);
    const uht = acctStats.data.templates.filter((tmpt: any) => 
        hdKeys.includes(tmpt.template_id));
    const res = uht.map((tmpt: any) => {
        return {
            id: tmpt.template_id,
            count: tmpt.assets
        }
    });
    return res;
}

const getColStats = async (addr: string) => {
    const acctStats = await getAcctStats(addr, colNames);
    return acctStats;
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

const getCurTime = () => {
    const d = new Date();
    const curTime = d.getTime();
    return curTime;
}

const checkIntervalEnergy = (prevTime: number, gp: number, ehc: number, 
    e: number) => {
    const curTime = getCurTime();

    // adding energy if renewal interval has passed
    if (curTime >= (prevTime + renewInterval)) {
        const passedTime = curTime - prevTime;
        const intervalsPassed = Number((passedTime/renewInterval).toFixed(0));
        let be = gp * energyMultipler; // base energy
        let ne = 0;

        const te = (be * intervalsPassed) + e;
        if (ehc >= te)  {
            ne = te;
        } else {
            ne = ehc;
        }
        return { ne, curTime }
    }
    return -1;
}

const checkEnergyStats = async (gp: number, p: number, hp: number, uhp: number, 
    addr: string) => {
    // checking if energy gen points have changed

    if (gp !== p || hp !== uhp) {
        const { egp, ehp } = await getEnergyStats(addr);
        return { egp, ehp }
    }
    return -1;
}