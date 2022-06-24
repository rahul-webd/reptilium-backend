import { db } from "..";
import { reptileTemplatesBySchemas, reptileTemplatesBySex } from "../data";
import { mintBreedableNft } from "../helpers";
import { Schema, Sex, userReptiles } from "../interfaces";
import { getDbUserName } from "../main";

export const getPythons = async (addr: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    }

    return res;
}

export const sortBySchema = async (path: string, templates: any,
    schema: string) => {

    const ref = db.ref(path);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        const d = snapshot.val();
        const ids = Object.keys(d).filter((a: string) => {

            switch (schema) {

                case 'pythons':
                    return templates.pythons.includes(a);

                case 'geckos':
                    return templates.geckos.includes(a);

                case 'boas':
                    return templates.boas.includes(a);

                case 'beardedragons':
                    return templates.beardedragons.includes(a);

                default:
                    return;
            }
        });

        let geckos: userReptiles = {}

        if (ids) {

            for (const g of ids) {
    
                geckos[g] = d[g]
            }
            res = geckos;
        } else {

            res = { error: 'no reptiles with such Id found' }
        }

    } else {
        res = { error: 'no data found' }
    }

    return res;
}

export const getReptileBySchema = async (schema: Schema, addr: string) => {

    const u = getDbUserName(addr);
    const path: string = `reptileCount/${u}`
    
    const res: any = await sortBySchema(path, reptileTemplatesBySchemas, schema);

    return res;
}

export const sortBySex = async (path: string, templates: any,
    schema: Schema, sex: Sex) => {

    const ref = db.ref(path);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        const d = snapshot.val();
        const ids = Object.keys(d).filter((a: any) => {

            switch (schema) {

                case 'pythons':
                    return templates[sex].pythons.includes(a);

                case 'geckos':
                    return templates[sex].geckos.includes(a);

                case 'boas':
                    return templates[sex].boas.includes(a);

                case 'beardedragons':
                    return templates[sex].beardedragons.includes(a);
            }
        });

        let geckos: userReptiles = {}

        for (const g of ids) {

            geckos[g] = d[g]
        }
        res = geckos;

    } else {
        res = { error: 'no data found' }
    }

    return res;
}

export const getSortedReptiles = async (schema: Schema, sex: Sex,
    addr: string) => {

    const u = getDbUserName(addr);
    const path: string = `reptileCount/${u}`;

    const res: any = await sortBySex(path, reptileTemplatesBySex, schema, sex);

    return res;
}

export const getBeardedragons = async (addr: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    }

    return res;
}

export const getBoas = async (addr: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    }

    return res;
}

export const getReptiles = async (addr: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    }

    return res;
}

export const getReptile = async (addr: string, templateId: string) => {
    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}/${templateId}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    } else {
        res = { error: 'no data found' }
    }

    return res;
}

export const getReptileAsset 
    = async (addr: string, templateId: string, index: number) => {

    const u = getDbUserName(addr);
    const ref = db.ref(`reptileCount/${u}/${templateId}/${index}`);
    let res = {}

    const snapshot = await ref.once('value').catch(err => {
        res = { error: err }
    })

    if (snapshot && snapshot.exists()) {
        res = snapshot.val();
    }

    return res;
}


export const feedReptile = async (addr: string, templateId: string, index: number,
    foodType: string, foodCount: number) => {

    const u = getDbUserName(addr);
    const reptRef = db.ref(`reptileCount/${u}/${templateId}/${index}`);
    const foodRef = db.ref(`foodCount/${u}/${foodType}`);
    let res = {}

    const snapshot = await foodRef.once('value').catch(err => {
        res = { error: err }
    })

    let r;
    if (snapshot && snapshot.exists()) {
        const c = snapshot.val();
        if (foodCount <= c) {
            const nc = c - foodCount;
            r = false;
            await foodRef.set(nc, async error => {
                if (error) {
                    res = { error }
                    r = false;
                } else {
                    r = true;
                }
            });
        } else {
            res = { error: 'unsufficient food amount' }
            r = false;
        }
    } else {
        r = false;
    }

    if (r) {
        const snapshot = await reptRef.once('value', snapshot => {},
            error => {
                res = { error: error.name }
            });

        if (snapshot && snapshot.exists()) {
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
    }
    
    return res;
}

export const spellSoulStone = async (addr: string, count: number, templateId: string,
    index: number) => {
    const u = getDbUserName(addr);
    let res: any = {}
    const soulStoneRef = db.ref(`foodCount/${u}/soulStone/count`);
    const snapshot = await soulStoneRef.once('value').catch(err => {
        res = { error: err }
    })

    let c = 0;
    let r = false;
    if (snapshot && snapshot.exists()) {
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

    if (r) {
        const reptileRef = db.ref(`reptileCount/${u}/${templateId}/${index}/soulProgress`);
        const snapshot = await reptileRef.once('value').catch(err => {
            res = { error: err }
        })

        let p = 0;
        if (snapshot && snapshot.exists()) {
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
    }

    return res;
}

export const redeem = async (addr: string, templateId: string, 
    index: number) => {
    const u = getDbUserName(addr);
    let res = {}

    const reptRef 
        = db.ref(`reptileCount/${u}/${templateId}/${index}`);
    let d: any = {};
    const snapshot = await reptRef.once('value').catch(err => {
        res = { error: err }
    })

    let r = false;

    if (snapshot && snapshot.exists()) {
        d = snapshot.val();
        const p = d.progress;
        if (Number(p) === 1200 && !d.hasOwnProperty('redeemed')) {
            await reptRef
                .update({ ...d, redeemed: true }, async error => {
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

    return res;
}
