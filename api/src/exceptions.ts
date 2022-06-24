import { Data } from "./interfaces";

export const NOTFOUND = 'data not found';
export const INVALIDHASH = 'hash is not defined or invalid';
export const FETCHFAILED = 'error while fetching data';
export const INVALIDDATA = 'fetched data is invalid';
export const INVALIDRESIZED = 'invalid resized file'
export const INVALIDTYPE = 'invalid file type';
export const IMGRESIZEERROR = 'some error occured while resizing image';
export const FFMPEGERROR = 'error initializing FFMPEG';
export const FFMPEGRESIZEERROR = 'error while resizing video';
export const FILESAVEERROR = 'error while saving file to cloud';

export const UNAUTHORIZEDEXCEPTION: Data = {
    data: '',
    error: 'user not authorized'
}