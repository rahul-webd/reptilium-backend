import { db } from "..";
import { breedableReptilesBySchemas, breedableReptilesBysex } from "../data";
import { BreedableReptile, Data, Pair, Schema, Sex } from "../interfaces";
import { getDbUserName } from "../main";
import { sortBySchema, sortBySex } from "./upgrade";

export const getBreedableReptileBySchema = async (schema: Schema, 
    addr: string) => {

    const u = getDbUserName(addr);
    const path: string = `users/${u}/breedableReptiles`
    
    const res: any = await sortBySchema(path, breedableReptilesBySchemas, schema);

    return res;
}


export const getSortedBreedableReptiles = async (schema: Schema, sex: Sex,
    addr: string) => {

    const u = getDbUserName(addr);
    const path: string = `users/${u}/breedableReptiles`;

    const res: any = await sortBySex(path, breedableReptilesBysex, schema, sex);

    return res;
}

export const getBreedableReptilesBothSex 
    = async (schema: Schema, addr: string) => {

    let res: Data = {
        data: '',
        error: ''
    }

    const u: string = getDbUserName(addr);
    const path: string = `users/${u}/breedableReptiles`;

    const males: any = await sortBySex(path, breedableReptilesBysex,
        schema, 'male');

    if (!males.error) {

        const females: any = await sortBySex(path, breedableReptilesBysex,
            schema, 'female');

        if (!females.error) {

            res.data = {
                males: males,
                females: females
            }
        } else {

            res.error = females.error;
        }
    } else {

        res.error = males.error;
    }

    return res;
}

export const createPair = async (maleId: string, femaleId: string, 
    addr: string) => {

    console.log(maleId, femaleId);

    const u = getDbUserName(addr);
    let res: Data = {
        data: '',
        error: ''
    }

    const ref = db.ref(`users/${u}`);
    const brRef = ref.child('breedableReptiles');
    const pairRef = ref.child('pairs');

    try {
        
        const m = await brRef.child(maleId).once('value');

        if (m.exists()) {

            const f = await brRef.child(femaleId).once('value');

            if (f.exists()) {

                const mv: BreedableReptile[] = m.val();
                const fv: BreedableReptile[] = f.val();

                if (mv.length && fv.length) {

                    const pairId: string = `${maleId}${femaleId}`;

                    const pair: Pair = {
                        life: 6,
                        male: maleId,
                        female: femaleId,
                        expired: false,
                        breeding: false,
                        claimed: false,
                        breedingStartedAt: 0
                    }

                    const pd = await pairRef.child(pairId).once('value');

                    if (!pd.exists()) {

                        await pairRef.child(pairId).set([pair]);
                    } else {

                        const pairs: Pair[] = pd.val();

                        await pairRef
                            .child(pairId)
                            .child(`${pairs.length}`)
                            .set(pair);
                    }

                    await brRef
                        .child(maleId)
                        .child(`${mv.length - 1}`)
                        .remove();

                    await brRef
                        .child(femaleId)
                        .child(`${fv.length - 1}`)
                        .remove();

                    res.data = 'pair successfully created'
                } else {

                    res.error = 'missing reptiles'
                }
            } else {

                res.error = 'no such female found'
            }
        } else {

            res.error = 'no such male found' 
        }
    } catch (error: any) {
        
        res.error = error.toString()
    }

    console.log(res);

    return res;
}

export const getPairs = async (addr: string) => {

    const u = getDbUserName(addr);
    const ref = db.ref(`users/${u}/pairs`);

    let res = {}

    try {
        
        const d = await ref.once('value');

        if (d.exists()) {

            const dv = d.val();
            res = dv;
        } else {

            res = { error: 'no pairs found' }
        }
    } catch (error) {
        
        res = { error }
    }

    return res;
}
