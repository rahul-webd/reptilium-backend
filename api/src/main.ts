import { 
    getAcctBurns, 
    getAcctStats, 
    getTemplates, 
    getAcctColStats, 
    transferTokens,
} from './helpers';
import { 
    simpleCount, 
    simpleNames, 
    user, 
    simpleStat, 
    userReptiles, 
    Data,
    ResizedMedia,
    BreedableReptile,
    BreedableReptiles,
} from './interfaces';
import { 
    breedableReptileIds,
    initialProgress, 
    initialSoulProgress, 
    reptileIds, 
    reptileRarites, 
} from './data';
import { Storage } from '@google-cloud/storage';
import { FILESAVEERROR, INVALIDHASH } from './exceptions';
import { resize } from './resizeMedia';
import { db } from '.';

const energyGenPoints: simpleCount = {
    "382045": 2,
    "363214": 2,
    "363215": 2
}

const basicEnergyIds: Array<string> = ['382045', '363214', '363215']

const energyHolderPoints: simpleCount = {
    "382048": 2,
    "363214": 2,
    "363215": 2
}

export const harvestBoosterNames: simpleNames = {
    "363230": "super_food",
    "363235": "table_scraps"
}

const colNames = ['nft.reptile', 'nrgsyndicate']

export const energyMultipler = 5;
const renewInterval = 1 * 60 * 60 * 1000;

export const getUser = async (addr: string, tmpts: Array<simpleStat>) => {
    let u = addr;

    const p: number = calcEnergyBoosterPoints(tmpts);
    const hp: number = calcEnergyHolderPoints(tmpts);
    u = getDbUserName(addr);
    const usersRef = db.ref(`users/${u}`);
    let res = {}
    const snapshot = await usersRef.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists() && 
        snapshot.val().hasOwnProperty('energy')) {
        const user = snapshot.val();

        res = await setUserUpdatedData(user, p, hp, addr, usersRef, res);            
    } else {
        const newUser = await createUser(addr, u);
        res = newUser;
    }
    return res;
}

const setUserUpdatedData = async (user: any, p: any, hp: any, addr: any,
    usersRef: any, res: any) => {
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
        userToUpdate.energy_holding_capacity = es.ehp * energyMultipler;
    }

    const ie = checkIntervalEnergy(prevTime, gp, ehc, e);
    if (ie !== -1) {
        userToUpdate.energy = ie.ne;
        userToUpdate.claim_timestamp = ie.curTime;
    }
    
    //TODO remove extra unnecessary calls to db
    await usersRef.update(userToUpdate, (err: any) => {
        if (err) {
            res =  { error: err.name };
        }
        res = userToUpdate;
    });
    return res;
}

const createUser = async (addr: string, u: string) => {
    const { e, egp, hc, ehp } = await getEnergyStats(addr);
    const usersRef = db.ref('users');
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
        userVal.harvest_boosters[harvestBoosterNames[id]].prev_burns 
            = hbb[id];
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

export const getHarvestBoosterBurns = async (addr: string) => {
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

export const getFoodCount = async (addr: string, foodType: string) => {
    const a = getDbUserName(addr);
    const foodRef = db.ref(`foodCount/${a}/${foodType}`);
    let res: any;

    const snapshot = await foodRef.once('value', snapshot => {
    }, error => {
        res = { error: error.name }
    });

    if (snapshot && snapshot.exists()) {
        res = { count: snapshot.val() };
    } else {
        res = { count: 0 }
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
    const p = await getEnergyBoosters(acctStats)
        .then(res => calcEnergyBoosterPoints(res));
    const e = p * energyMultipler;

    return { e, p }
}

const getEnergyHolderPoints = async (acctStats: any) => {
    const p = await getEnergyHolders(acctStats)
        .then(res => calcEnergyHolderPoints(res));
    const hc = p * energyMultipler;

    return { hc, p }
}

const calcEnergyBoosterPoints = (tmpts: Array<simpleStat>) => {
    const tmptIds: Array<string> = tmpts.map((tmpt: any) => tmpt.id);

    const p: number = tmptIds.reduce((prev, cur, i) => {
        const ep = energyGenPoints[cur];
        const ec = tmpts[i].count;

        if (basicEnergyIds.includes(cur)) {
            return prev + ep * 1; 
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
        '253709': 1,
        '253707': 1,
        '363220': 5,
        '363218': 5,
        '363222': 10,
        '363221': 10,
        '374720': 100,
        '374732': 100
    }

    const mouseTemplateIds = ['363217', '253709', '363220', '363222', 
        '374720'];
    const cricketTemplateIds = ['363216', '253707', '363218', '363221', 
        '374732'];
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
    const foodRef = db.ref(`foodCount/${u}`);
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
            const mouseToAdd 
                = newBurnedFood.mouse - food.burnedFood.mouse;
            const cricketToAdd 
                = newBurnedFood.cricket - food.burnedFood.cricket;

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

const handleAcctBurns = async (addr: string, idsToCheck: string[]) => {
    const res = await getAcctBurns(addr, [colNames[0]]);
    const ts = res.data.templates;
    const urt 
        = ts.filter((t: any) => idsToCheck.includes(t.template_id));

    const r = urt.map((t: any) => {
        const id = t.template_id;
        const count = t.assets;
        const progress = initialProgress[reptileRarites[id]]
        return { id, count, progress }
    });

    return r;
}

const getAllReptileBurns = async (addr: string) => {
    
    const r: any = handleAcctBurns(addr, reptileIds);
    return r;
}

const getAllBreedableReptileBurns = async (addr: string) => {

    const r: any = handleAcctBurns(addr, breedableReptileIds);
    return r;
}

export const importBurnedReptiles = async (addr: string) => {
    const u = getDbUserName(addr);
    const tRef = db.ref(`reptileCount/${u}`);
    let res = {}
    const snapshot = await tRef.once('value').catch(err => {
        res = { error: err }
    })

    let ts: userReptiles = {}
        if (snapshot && snapshot.exists()){
            ts = snapshot.val();
        }
        try {
            const newTs = await getAllReptileBurns(addr);
            newTs.forEach((t: any) => {
                const id = t.id;
                const count = t.count;
                // const initProg = t.progress;
                if (!ts.hasOwnProperty(id)) {
                    let ur: Array<simpleCount> = []
                    for (let i = 0; i < count; i++) {
                        ur.push({
                            progress: initialProgress[reptileRarites[id]],
                            soulProgress: initialSoulProgress[reptileRarites[id]]
                        });
                    }
                    ts[id] = ur;
                } else {
                    const prevCount = ts[id].length;
                    const countToAdd = count - prevCount;
                    for (let i = 0; i < countToAdd; i++) {
                        ts[id].push({
                            progress: initialProgress[reptileRarites[id]],
                            soulProgress: initialSoulProgress[reptileRarites[id]]
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

    return res;
}

export const importBreedableReptiles = async (addr: string) => {

    const u = getDbUserName(addr);
    const tRef = db.ref(`users/${u}/breedableReptiles`);
    let res = {}

    const defBreedableReptile: BreedableReptile = {
        life: 0,
        expired: false
    }

    const snapshot = await tRef.once('value').catch(err => {
        res = { error: err }
    })

    let ts: BreedableReptiles = {}

    if (snapshot && snapshot.exists()){
        ts = snapshot.val();
    }

    try {
        const newTs = await getAllBreedableReptileBurns(addr);
        newTs.forEach((t: any) => {
            const id = t.id;
            const count = t.count;

            if (!ts.hasOwnProperty(id)) {

                let b: BreedableReptile[] = []
                for (let i = 0; i < count; i++) {
                    b.push(defBreedableReptile);
                }


                ts[id] = b;
            } else {

                const prevCount = ts[id].length;
                const countToAdd = count - prevCount;
                for (let i = 0; i < countToAdd; i++) {
                    ts[id].push(defBreedableReptile);
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

    return res;
}

export const getFood = async (addr: string, foodType: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`foodCount/${u}/${foodType}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = { count: snapshot.val() };
    }

    return res;
}

export const getReptileBurns 
    = async (templateId: string, addr: string) => {

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

const getSoulStoneBurns = async (addr: string) => {
    const col1 = 'nft.reptile';
    const soulStoneIds = ['516764'];
    const res = await getAcctBurns(addr, [col1]);
    const templates = res.data.templates;
    const template = templates.filter((t: any) => {
        return soulStoneIds.includes(t.template_id);
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
    const soulStoneRef = db.ref(`foodCount/${u}/soulStone`);
    const snapshot = await soulStoneRef.once('value').catch(err => {
        res = { error: err }
    })

    let pb = 0;
        let c = 0;
        if (snapshot && snapshot.exists()) {
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

    return res;
}

export const getSoulStone = async (addr: string) => {
    const u = getDbUserName(addr);
    const soulStoneRef = db.ref(`foodCount/${u}/soulStone`);
    let res = {}
    const snapshot = await soulStoneRef.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    } else {
        res = { count: 0 }
    }

    return res;
}

const getColStats = async (addr: string) => {
    const acctStats = await getAcctStats(addr, colNames);
    return acctStats;
}

export const getDbUserName = (addr: string) => {
    let dbName = addr;
    if (addr.includes('.')) {
        dbName = addr.split('.').join('_');
    }
    return dbName;
}

const getCurTime = () => {
    const d = new Date();
    const curTime = d.getTime();
    return curTime;
}

const checkIntervalEnergy = (prevTime: number, gp: number, ehc: number, 
    e: number) => {
    const curTime = getCurTime();

    if (curTime >= (prevTime + renewInterval)) {
        const passedTime = curTime - prevTime;
        const intervalsPassed 
            = Number((passedTime/renewInterval).toFixed(0));
        let be = gp * energyMultipler;
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

    if (gp !== p || hp !== uhp) {
        const { egp, ehp } = await getEnergyStats(addr);
        return { egp, ehp }
    }
    return -1;
}

export const setRewardStats = async () => {
    const rewardStats: simpleCount = {}
    const rewardKeys = ['Reptilium Per Week', 'RPLM/Week', 'RPLM Per Week']

    const templates = await getTemplates(colNames[0], false).then(res => res.data);

    for (const t of templates) {
        const imData = t.immutable_data;

        for (const rk of rewardKeys) {

            if (imData.hasOwnProperty(rk)) {
                rewardStats[t.template_id] = Number(imData[rk]);
                break;
            }
        }
    }

    const ref = db.ref('rewardStats');
    ref.update(rewardStats, error => {
        if (error) {
            console.log(error);
        } else {
            console.log('data successfully added');
        }
    }).catch(error => {
        console.log(error);
    });
}

export const claimReward = async (addr: string) => {
    const u = getDbUserName(addr);
    let res = {}

    const userTemplateStats = await getAcctColStats(addr, colNames[0])
        .then(res => res.data);

    if (userTemplateStats) {
        const rsRef = db.ref('rewardStats');
    
        const snapshot = await rsRef.once('value').catch(err => {
            res = { error: err }
        })

        if (snapshot && snapshot.exists()) {

            const ref = db.ref(`users/${u}/reward_timestamp`);

            const s1 = await ref.once('value').catch(err => {
                res = { error: err }
            })

            const lastTs = s1?.val() || -1;
            const curTs: number = getCurTime();

            if (lastTs && (lastTs === -1 
                || (curTs >= (lastTs + 24 * 60 * 60 * 1000) 
                && curTs !== -1))) {

                const rewardStats = snapshot.val();
                const rewardIds = Object.keys(rewardStats);
                const templates = userTemplateStats.templates;

                const claimableAmt: number = 
                templates.reduce((prev: number, cur: any) => {
                    const id = cur.template_id;
                    const count = cur.assets;

                    if (rewardIds.includes(id)) {
                        return prev + (Number(rewardStats[id]) * count);
                    }
                    return prev; 
                }, 0);

                const qty: string = `${(claimableAmt/7).toFixed(4)} RPLM`;
                const memo = `Reptilium Reward`;

                let tsSet = true;

                await ref.set(curTs, error => {
                    if (error) {
                        tsSet = false;
                    }
                });

                if (tsSet) {
                    const trxRes: any = await transferTokens(addr, qty, memo);

                    if (trxRes && trxRes.processed) {
                        res = { result: 'claimed successfully', trxRes }
                    } else {
                        ref.set(lastTs, error => {
                            if (error) {

                                res = { error };
                            } else {
                                res = { error: 'claiming unsuccessful' }
                            }
                        });
                    }
                }
            } else {
                res = { error: 'interval not completed' }
            }

        } else {
            res = { error: `no data found` }
        }

    } else {
        res = { error: `couldn't fetch data` }
    }

    return res;
}

export const getLastClaim = async (addr: string) => {
    const u = getDbUserName(addr);
    let res = {}

    const ref = db.ref(`users/${u}/reward_timestamp`);
    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = { lastClaim: snapshot.val() }
    } else {
        res = { error: 'no data found' }
    }

    return res;
}


export const getReptileTemplates = async () => {
    const reptileTemplatesRef = db.ref('templates/reptileTemplates');
    let res: any = {}

    const snapshot = await reptileTemplatesRef.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    } else {
        res = { error: 'no data exists' }
    }
    return res;
}

const uploadResizedMedia = async (resizedMedia: ResizedMedia, 
    name: string): Promise<Data> => {

    const res: Data = {
        data: '',
        error: ''
    }

    const storage = new Storage();

    if (resizedMedia.buffer) {

        await storage.bucket('reptilium-3e457.appspot.com')
            .file(`resized/${name}`)
            .save(resizedMedia.buffer, {
                metadata: {
                    contentType: resizedMedia.mime
                }
            })
            .then(() => {
                res.data = 'file saved succesfully';
            }).catch(err => {
                res.error = FILESAVEERROR
            })
    } else {

        res.error = 'no media to upload';
    }

    return res;
}

export const resizeMedia 
    = async (hash: string | undefined): Promise<Data> => {

    const res: Data = {
        data: '',
        error: ''
    }

    if (hash) {

        const resizedData: Data = await resize(hash);
    
        if (!resizedData.error && resizedData.data) {
    
            const resizedMedia: ResizedMedia = resizedData.data;
            const uploadRes: Data 
                = await uploadResizedMedia(resizedMedia, hash);
    
            if (!uploadRes.error && uploadRes.data) {
    
                res.data = 'file resized and saved successfully';
            } else {
    
                res.error = uploadRes.error
            }
        } else {
    
            res.error = resizedData.error;
        }
    } else {

        res.error = INVALIDHASH
    }
    
    return res;
}