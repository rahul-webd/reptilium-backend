import { db } from "..";
import { Reference, DataSnapshot } from '@firebase/database-types/index';

export const changeOdds = async (odds: {
    none: number,
    super_food: number,
    table_scraps: number
}) => {
    const oddsRef: Reference = db.ref('config/enhancers/odds');

    try {
        
        await oddsRef.update(odds);

        return {
            data: {
                success: true
            },
            error: ''
        }
    } catch (error) {
        
        console.log(error);
        return {
            data: {
                success: false
            },
            error: `${error}`
        }
    }
}

export const getOdds = async () => {
    const oddsRef: Reference = db.ref('config/enhancers/odds');

    try {
        
        const s: DataSnapshot = await oddsRef.get();
        
        if (s.exists()) {

            return {
                data: s.val(),
                error: ''
            }
        } else {

            return {
                data: '',
                error: 'no data found'
            }
        }
    } catch (error) {
        
        console.log(error);
        return {
            data: '',
            error: `${error}`
        }
    }
}

export const changeFoodRewardOdds = async (odds: {
    none: number[],
    super_food: number[],
    table_scraps: number[]
}) => {
    const oddsRef: Reference = db.ref('config/food/odds');

    try {
        
        await oddsRef.update(odds);

        return {
            data: {
                success: true
            },
            error: ''
        }
    } catch (error) {
        
        console.log(error);
        return {
            data: {
                success: false
            },
            error: `${error}`
        }
    }
}

export const getFoodRewardOdds = async () => {
    const oddsRef: Reference = db.ref('config/food/odds');

    try {
        
        const s: DataSnapshot = await oddsRef.get();
        
        if (s.exists()) {

            return {
                data: s.val(),
                error: ''
            }
        } else {

            return {
                data: '',
                error: 'no data found'
            }
        }
    } catch (error) {
        
        console.log(error);
        return {
            data: '',
            error: `${error}`
        }
    }
}