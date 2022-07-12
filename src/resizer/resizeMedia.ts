import { createFFmpeg } from "@ffmpeg/ffmpeg";
import sharp = require('sharp');
import { FETCHFAILED, FFMPEGERROR, FFMPEGRESIZEERROR, IMGRESIZEERROR, INVALIDDATA, INVALIDHASH, INVALIDRESIZED, INVALIDTYPE } from "../exceptions"
import { BufferFetcher } from "../helpers";
import { Data, MediaType, ResizedMediaRes } from "../schema";

const IPFS: string = `https://ipfs.io/ipfs`;

export const resize = async (hash: string | undefined): Promise<Data> => {

    let res: ResizedMediaRes = {
        data: {
            buffer: undefined,
            mime: ''
        },
        error: ''
    }

    if (hash) {

        const downloadRes: Data = await downloadBuffer(hash);

        if (!downloadRes.error && downloadRes.data) {

            const buffer: Buffer = downloadRes.data;
            
            const fileCheckRes: Data = await checkFileType(buffer);

            if (!fileCheckRes.error && fileCheckRes.data) {

                const mediaType: MediaType = fileCheckRes.data;

                res.data.mime = mediaType.mime;

                if (mediaType.media === 'img') {

                    const resizedImgData: Data 
                        = await resizeImage(buffer);

                    if (!resizedImgData.error && resizedImgData.data) {

                        res.data.buffer = resizedImgData.data;
                    } else {

                        res.error = resizedImgData.error;
                    }
                } else {

                    const resizedVideoData: Data    
                        = await resizeVideo(buffer, hash, mediaType.ext);

                    if (!resizedVideoData.error && resizedVideoData.data) {

                        res.data.buffer = resizedVideoData.data;
                    } else {

                        res.error = resizedVideoData.error;
                    }
                }
            } else {

                res.error = fileCheckRes.error;
            }
        } else {

            res.error = downloadRes.error;
        }
    } else {

        res.error = INVALIDHASH;
    }

    return res;
}

const downloadBuffer = async (hash: string): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }
    console.log('started download');

    const d: Data = await BufferFetcher(`${IPFS}/${hash}`);

    console.log(d);

    if (!d.error && d.data) {

        const arrayBuffer: ArrayBuffer = d.data;

        if (arrayBuffer) {

            res.data = Buffer.from(arrayBuffer);
        } else {

            res.error = INVALIDDATA;
        }
    } else {

        res.error = FETCHFAILED;
    }

    return res;
}

const checkFileType = async (file: Buffer): Promise<Data> => {

    let res: Data = {
        data: '',
        error: ''
    }

    const imgTypes: string[] = ['3g2', '3gp', '3mf', 'arw', 'avif',
        'bmp', 'bpg', 'cr2', 'cr3', 'cur', 'dcm', 'dng', 'icns', 'ico',
        'jp2', 'jpg', 'jpm', 'jpx', 'jxl', 'jxr', 'ktx', 'png',
        'tif', 'rw2', 'raf', 'orf', 'gif']

    const { fileTypeFromBuffer } 
        = await (eval('import("file-type")') as Promise<typeof import('file-type')>);

    const fileType = await fileTypeFromBuffer(file).catch(err => {
        res.error = INVALIDTYPE;
    });

    console.log(fileType)

    if (fileType) {
        
        const ext: string = fileType.ext;

        const mediaType: MediaType = {
            media: imgTypes.includes(ext) ? 'img': 'video',
            ext: ext,
            mime: fileType.mime
        }
    
        res.data = mediaType;
    } else {

        res.error = INVALIDDATA
    }

    return res;
}

const resizeImage = async (file: Buffer): Promise<Data> => {

    const w: number = 370;
    const h: number = 370;

    let res: Data = {
        data: '',
        error: ''
    }

    const resizedFile: Buffer | void = 
        await sharp(file, { failOnError: false })
            .resize(w, h, {
                fit: 'inside',
                withoutEnlargement: true
            }).toBuffer()
            .catch(err => {
                res.error = IMGRESIZEERROR
            });

    console.log(resizedFile)

    if (resizedFile) {

        res.data = resizedFile;
    } else {

        res.data = INVALIDRESIZED
    }

    return res;
} 

const resizeVideo = async (file: Buffer, hash: string, 
        ext: string): Promise<Data> => {

    const res: Data = {
        data: '',
        error: ''
    }

    const ffmpegInstance = createFFmpeg({ log: true });
    await ffmpegInstance.load();

    if (ffmpegInstance) {

        const inputFile: string = hash;
        const outputFile: string = `${hash}.${ext}`;

        try {

            ffmpegInstance.FS('writeFile', hash, file);
            await ffmpegInstance.run(
                '-i',
                inputFile,
                '-vf',
                'scale=360:trunc(ow/a/2)*2',
                outputFile
            );
            
            const outputData: ArrayBuffer 
                = ffmpegInstance.FS('readFile', outputFile);
            ffmpegInstance.FS('unlink', hash);
            ffmpegInstance.FS('unlink', outputFile);

            console.log(outputData)

            res.data = Buffer.from(outputData);
        } catch (error) {
            
            res.error = FFMPEGRESIZEERROR
        }
    } else {

        res.error = FFMPEGERROR
    }

    return res;
}