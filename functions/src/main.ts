import * as admin from 'firebase-admin';
import { chooseRand, getAcctBurns, getAcctStats, getTableRows, 
    getTemplates, 
    mintBreedableNft} from './helpers';
import { simpleCount, simpleNames, user, harvestBoosters,
    simpleStat, reptileTemplateObj, userReptiles } from './interfaces';
import { initialProgress, reptileIds, reptileRarites } from './data';

admin.initializeApp();

const energyGenPoints: simpleCount = {
    "382045": 2,
    "363214": 2,
    "363215": 2
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

        if (snapshot.exists() && snapshot.val().hasOwnProperty('energy')) {
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
        })
    }, err => {
        res = { error: err };
    });
    console.log(res);
    
    return res;
}

export const harvestFood = async (addr: string, foodType: string, enhancer: string) => {
    const dbName = getDbUserName(addr);
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
                const harvestRes = await tryHarvest(dbName, foodType, enhancer, rewardOdd);
                
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
    }, err => {
        res = { error: err }
    });
    return res;
}

export const getFoodCount = async (addr: string, foodType: string) => {
    const a = getDbUserName(addr);
    const foodRef = admin.database().ref(`foodCount/${a}/${foodType}`);
    let res: any;
    await foodRef.get().then(snapshot => {
        if (snapshot.exists()) {
            res = { count: snapshot.val() };
        } else {
            res = { count: 0 }
        }
    }).catch(err => {
        res = { error: err }
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
        res = await updateHarvestCount(addr, foodType, enhancer);
    } else {
        res = { error: 'harvest unsuccessful' }
    }
    return res;
}

const updateHarvestCount = async (addr: string, type: string, enhancer: string) => {
    // odds within 1000
    const probs: Array<number> = [0, 20, 130, 850];
    const enhancedProbs: Array<number> = [20, 100, 180, 700];

    let res = {}

    const probsMap: Map<number, number> = new Map([
        [0, 100],
        [1, 10],
        [2, 5],
        [3, 1]
    ]);

    const reward = async (probType: Array<number>) => {
        const chosenRand: number = chooseRand(probType);
        if (chosenRand !== -1 && chosenRand < 4) {
            const count = probsMap.get(chosenRand);
            if (count) {

                // TODO weird BUG - data not updating on children in firebase even when no validation is set.
                const farmTypeRef = admin.database().ref(`foodCount/${addr}/${type}`);
                await farmTypeRef.get().then(async snapshot => {
                    if (!snapshot.exists()) {
                        await farmTypeRef.set(count, err => {
                            if (err) {
                                res = { error: err }
                            } else {
                                res = { count: count }
                            }
                        });
                    } else {
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
                }).catch(err => {
                    console.log(err);
                    res = { error: err }
                });
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

const getFoodBurns = async (addr: string) => {
    const foodTemplateIds: simpleCount = {
        '363217': 1,
        '363216': 1,
        '363220': 5,
        '363218': 5,
        '363222': 10,
        '363221': 10,
        '374720': 100,
        '374732': 100
    }

    const mouseTemplateIds = ['363217', '363220', '363222', '374720'];
    const cricketTemplateIds = ['363216', '363218', '363221', '374732'];
    const res = await getAcctBurns(addr, [colNames[0]]);
    const templates = res.data.templates;
    const mt = templates.filter((template: any) => 
        mouseTemplateIds.includes(template.template_id));
    const ct = templates.filter((template: any) => 
        cricketTemplateIds.includes(template.template_id));
    const mouseCount = mt.reduce((prev: any, cur: any) => {
        return prev + ( cur.assets * foodTemplateIds[cur.template_id] )
    }, 0);
    const cricketCount = ct.reduce((prev: any, cur: any) => {
        return prev + ( cur.assets * foodTemplateIds[cur.template_id] )
    }, 0);
    return {
        mouse: mouseCount, 
        cricket: cricketCount
    }
}

export const importBurnedFood = async (addr: string) => {
    const u = getDbUserName(addr);
    const foodRef = admin.database().ref(`foodCount/${u}`);
    let res = {}
    await foodRef.get().then(async snapshot => {
        let food: any = {
            mouse: 0,
            cricket: 0,
            burnedFood: {
                mouse: 0,
                cricket: 0
            }
        }
        if (snapshot.exists()) {
            const val = snapshot.val();
            if (val.hasOwnProperty('mouse')) {
                food.mouse = val.mouse;
            }
            if (val.hasOwnProperty('cricket')) {
                food.cricket = val.cricket;
            }
            if (val.hasOwnProperty('burnedFood')) {
                food.burnedFood.mouse = val.burnedFood.mouse;
                food.burnedFood.cricket = val.burnedFood.cricket;
            }
        }
        try {
            const newBurnedFood = await getFoodBurns(addr);
            const mouseToAdd = newBurnedFood.mouse - food.burnedFood.mouse;
            const cricketToAdd = newBurnedFood.cricket - food.burnedFood.cricket;

            food.mouse += mouseToAdd;
            food.cricket += cricketToAdd;
            food.burnedFood.mouse = newBurnedFood.mouse;
            food.burnedFood.cricket = newBurnedFood.cricket;

            await foodRef.update(food, error => {
                if (error) {
                    res = { error }
                } else {
                    res = food;
                }
            });
        } catch (error) {
            res = { error }
        }
    }, error => {
        res = { error }
    });
    return res;
}

const getAllReptileBurns = async (addr: string) => {
    const res = await getAcctBurns(addr, [colNames[0]]);
    const ts = res.data.templates;
    const urt = ts.filter((t: any) => reptileIds.includes(t.template_id));
    const r = urt.map((t: any) => {
        const id = t.template_id;
        const count = t.assets;
        const progress = initialProgress[reptileRarites[id]]
        return { id, count, progress }
    });
    return r;
}

export const importBurnedReptiles = async (addr: string) => {
    const u = getDbUserName(addr);
    const tRef = admin.database().ref(`reptileCount/${u}`);
    let res = {}
    await tRef.get().then(async snapshot => {
        let ts: userReptiles = {}
        if (snapshot.exists()){
            ts = snapshot.val();
        }
        try {
            const newTs = await getAllReptileBurns(addr);
            newTs.forEach((t: any) => {
                const id = t.id;
                const count = t.count;
                const initProg = t.progress;
                if (!ts.hasOwnProperty(id)) {
                    let ur: Array<simpleCount> = []
                    for (let i = 0; i < count; i++) {
                        ur.push({
                            progress: initProg
                        });
                    }
                    ts[id] = ur;
                } else {
                    const prevCount = ts[id].length;
                    const countToAdd = count - prevCount;
                    for (let i = 0; i < countToAdd; i++) {
                        ts[id].push({
                            progress: initProg
                        });
                    }
                }
            }); 
            
            await tRef.update(ts, error => {
                if (error) {
                    res = { error }
                } else {
                    res = ts;
                }
            })
        } catch (error) {
            res = { error }
        }
    }, error => {
        res = { error }
    });
    return res;
}

export const getReptiles = async (addr: string) => {
    const u = getDbUserName(addr);
    const ref = admin.database().ref(`reptileCount/${u}`);
    let res = {}
    await ref.get().then(snapshot => {
        if (snapshot.exists()) {
            res = snapshot.val();
        }
    }, error => {
        if (error) {
            res = { error }
        }
    });
    return res;
}

export const getReptile = async (addr: string, templateId: string) => {
    const u = getDbUserName(addr);
    const ref = admin.database().ref(`reptileCount/${u}/${templateId}`);
    let res = {}
    await ref.get().then(snapshot => {
        if (snapshot.exists()) {
            res = snapshot.val();
        }
    }, error => {
        if (error) {
            res = { error }
        }
    });
    return res;
}

export const getFood = async (addr: string, foodType: string) => {
    const u = getDbUserName(addr);
    const ref = admin.database().ref(`foodCount/${u}/${foodType}`);
    let res = {}
    await ref.get().then(snapshot => {
        if (snapshot.exists()) {
            res = { count: snapshot.val() };
        }
    }, error => {
        if (error) {
            res = { error }
        }
    });
    return res;
}

export const getReptileBurns = async (templateId: string, addr: string) => {
    const res = await getAcctBurns(addr, [colNames[0]]);
    const templates = res.data.templates;
    const template = templates.filter((template: any) => {
        return template.template_id === templateId;
    });
    if (template.length !== 0) {
        return template[0].assets;
    } else {
        return 0;
    }
}

export const addReptile = async (templateId: string, addr: string) => {
    const u = getDbUserName(addr);
    const templateRef = admin.database().ref(`reptileCount/${u}/${templateId}`);
    let res: any;

    await templateRef.get().then(async snapshot => {
        let prevCount: number = 0;
        let ts: Array<simpleCount> = []
        if (snapshot.exists()) {
            ts = snapshot.val();
            prevCount = snapshot.val().length;
        }
        try {
            let count = await getReptileBurns(templateId, addr);
            const countToAdd = count - prevCount;
            for (let i = 0; i < countToAdd; i++) {
                ts.push({
                    progress: initialProgress[reptileRarites[templateId]]
                });
            }
            await templateRef.set(ts, err => {
                if (err) {
                    res = { error: err }
                } else {
                    res = { added: true };
                }
            });
        } catch (error) {
            res = { error }
        }
    }, err => {
        if (err) {
            res = { error: err }
            return;
        }
    });

    return res;
}

export const feedReptile = async (addr: string, templateId: string, index: number,
    foodType: string, foodCount: number) => {

    const u = getDbUserName(addr);
    const reptRef = admin.database().ref(`reptileCount/${u}/${templateId}/${index}`);
    const foodRef = admin.database().ref(`foodCount/${u}/${foodType}`);
    let res = {}

    await foodRef.get().then(async snapshot => {
        if (snapshot.exists()) {
            const c = snapshot.val();
            if (foodCount <= c) {
                const nc = c - foodCount;
                let r = false;
                await foodRef.set(nc, error => {
                    if (error) {
                        res = { error }
                        r = false;
                    } else {
                        r = true;
                    }
                });
                return r;
            } else {
                res = { error: 'unsufficient food amount' }
                return false;
            }
        } else {
            return false;
        }
    }, error => { res = { error } }).then(async r => {
        if (r) {
            await reptRef.get().then(async snapshot => {
                if (snapshot.exists()) {
                    const s = snapshot.val();
                    const p = Number(s.progress);
                    const nc = Number(p) + Number(foodCount);
                    const np = { progress: nc };
                    await reptRef.update(np, error => {
                        if (error) {
                            res = { error }
                        } else {
                            res = np
                        }
                    });
                }
            }, error => { res = { error } });
        }
    });
    
    return res;
}

const getSoulStoneBurns = async (addr: string) => {
    const soulStoneCol = 'davidsmorphs';
    const soulStoneId = '474613';
    const res = await getAcctBurns(addr, [soulStoneCol]);
    const templates = res.data.templates;
    const template = templates.filter((t: any) => {
        return t.template_id === soulStoneId;
    });
    if (template.length !== 0) {
        return template[0].assets;
    } else {
        return 0;
    }
}

export const setSoulStone = async (addr: string) => {
    let res = {}
    let b = await getSoulStoneBurns(addr);
    b = Number(b);
    const u = getDbUserName(addr);
    const soulStoneRef = admin.database().ref(`foodCount/${u}/soulStone`);
    await soulStoneRef.get().then(async snapshot => {
        let pb = 0;
        let c = 0;
        if (snapshot.exists()) {
            const v = snapshot.val();
            pb = v.prevBurn;
            c = v.count;
            pb = Number(pb);
            c = Number(c);
        }

        let npb;
        let nc;

        if (pb !== b) {
            npb = b;
            nc = c + (npb - pb)

            const nv = {
                prevBurn: npb,
                count: nc
            }
    
            await soulStoneRef.update(nv, error => {
                if (error) {
                    res = { error }
                } else {
                    res = nv;
                }
            });
        } else {
            res = { error: 'user has made no new burns' }
        }

    }, error => {
        if (error) {
            res = { error }
        } else {
            res = { error: 'some error occured' }
        }
    });

    return res;
}

export const getSoulStone = async (addr: string) => {
    const u = getDbUserName(addr);
    const soulStoneRef = admin.database().ref(`foodCount/${u}/soulStone`);
    let res = {}
    await soulStoneRef.get().then(snapshot => {
        if (snapshot.exists()) {
            res = snapshot.val();
        } else {
            res = { count: 0 }
        }
    }, error => {
        if (error) {
            res = { error }
        } else {
            res = { error: 'some error occured' }
        }
    });

    return res;
}

export const spellSoulStone = async (addr: string, count: number, templateId: string,
    index: number) => {
    const u = getDbUserName(addr);
    let res: any = {}
    const soulStoneRef = admin.database().ref(`foodCount/${u}/soulStone/count`);
    await soulStoneRef.get().then(async snapshot => {
        let c = 0;
        let r = false;
        if (snapshot.exists()) {
            c = snapshot.val();
            if (count <= c && count !== 0) {
                const nc = c - count;
                await soulStoneRef.set(nc, error => {
                    if (error) {
                        res = { error }
                        r = false;
                    } else {
                        r = true;
                    }
                });
            } else {
                res = { error: 'invalid amount' }
                r = false;
            }
        } else {
            r = false;
        }
        return r;
    }).then(async r => {
        if (r) {
            const reptileRef = admin.database().ref(`reptileCount/${u}/${templateId}/${index}/soulProgress`);
            await reptileRef.get().then(async snapshot => {
                let p = 0;
                if (snapshot.exists()) {
                    p = snapshot.val();
                }
                const np = p + count;
                await reptileRef.set(np, error => {
                    if (error) {
                        res = { error }
                    } else {
                        res = { progress: np };
                    }
                });
            });
        }
    });
    return res;
}

export const redeem = async (addr: string, templateId: string, 
    index: number) => {
    const u = getDbUserName(addr);
    let res = {}

    const reptRef = admin.database().ref(`reptileCount/${u}/${templateId}/${index}`);
    let d: any = {};
    await reptRef.get().then(async snapshot => {
        let r = false;

        if (snapshot.exists()) {
            d = snapshot.val();
            const p = d.progress;
            if (Number(p) === 1200 && !d.hasOwnProperty('redeemed')) {
                console.log('2');
                await reptRef.update({ ...d, redeemed: true }, async error => {
                    if (error) {
                        res = { error }
                        r = false;
                    } else {
                        r = true;
                    }
                });
            } else {
                res = { error: 'your reptile is not mature' }
            }
        } else {
            res = { error: 'no data found' }
        }
        return r;
    }, error => {
        if (error) {
            res = { error }
        } else {
            res = { error: 'some error occured' }
        }
    }).then(async r => {

        if (r && Object.keys(d).length !== 0) {
            const trx: any = await mintBreedableNft(addr, templateId);

            if (trx && !trx.error) {
                res = { trx, wasMinted: true }
            } else {
                await reptRef.update({ ...d, redeemed: false }, error => {
                    if (error) {
                        res = { error }
                    } else {
                        res = { error: 'please try again' }
                    }
                });
            }
        }
    })

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

export const setReptileTemplates = async () => {
    const colName: string = 'nft.reptile';
    const reptileSchemas: Array<string> = ['pythons', 'beardedragon', 'boas', 'geckos']
    let res: Array<reptileTemplateObj> = []
    const payload: any = {}

    for (const rs of reptileSchemas) {
        const templates = await getTemplates(colName, rs).then(res => res.data);
        const tmpts = await templates.map((template: any): reptileTemplateObj => {
            const templateId = template.template_id;
            const immutableData = template.immutable_data;
            return {
                [templateId]: {
                    name: immutableData.name || '',
                    img: immutableData.img || '',
                    video: immutableData.video || '',
                    Rarity: immutableData.Rarity || '',
                    animalName: immutableData["Animal's Name"] || '',
                    Breed: immutableData.Breed || '',
                    genusSpecies: immutableData["Genus Species"] || '',
                    genesTraits: immutableData["Genes/Unique Traits"] || '',
                    Region: immutableData.Region || '',
                    rplmPerWeek: Number(immutableData["RPLM Per Week"]) || 0,
                    Breeder: immutableData.Breeder || '',
                    Set: immutableData.Set || ''
                }
            }
        });
        res = res.concat(tmpts);
    }

    res.forEach(r => {
        const rk = Object.keys(r);
        const key = rk[0]
        payload[key] = r[key];
    })

    const reptileTemplatesRef = admin.database().ref('templates/reptileTemplates');
    await reptileTemplatesRef.set(payload, err => {
        if (err) {
            console.log(err);
        } else {
            console.log('Reptile Templates Updateed');
        }
    });
}

export const getReptileTemplates = async () => {
    const reptileTemplatesRef = admin.database().ref('templates/reptileTemplates');
    let res: any = {}
    await reptileTemplatesRef.get().then(snapshot => {
        if (snapshot.exists()) {
            res = snapshot.val();
        } else {
            res = { error: 'no data exists' }
        }
    });
    return res;
}