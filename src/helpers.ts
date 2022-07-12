import fetch from 'node-fetch';
import { Data } from './schema';

export const fetcher = async (url: string): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }

    const r = await fetch(url)
        .then(resp => resp.json())
        .catch(err => {
            res.error = err;
        })

    res.data = r;

    return res;
}

export const BufferFetcher = async (url: string): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }

    const r = await fetch(url)
        .then(resp => resp.arrayBuffer())
        .catch(err => {
            res.error = err;
        })

    res.data = r;

    return res;
}