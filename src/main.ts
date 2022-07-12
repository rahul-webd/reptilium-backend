import { 
    Data,
    ResizedMedia,
} from './schema';
import { Storage } from '@google-cloud/storage';
import { FILESAVEERROR, INVALIDHASH } from './exceptions';
import { resize } from './resizer/resizeMedia';

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