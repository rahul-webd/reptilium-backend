export type simpleCount = {
    [id: string]: number
}

export type simpleNames = {
    [id: string]: string
}

export type Data = {
    data: any,
    error: any
}

export type MediaType = {
    media: 'img' | 'video',
    ext: string,
    mime: string
}

export type ResizedMedia = {
    buffer: Buffer | undefined,
    mime: string
}

export type ResizedMediaRes = {
    data: ResizedMedia,
    error: string
}