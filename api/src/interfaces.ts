export interface simpleCount {
    [id: string]: number
}

export interface simpleNames {
    [id: string]: string
}

export interface user {
    energy: number,
    energy_generation_points: number,
    energy_holding_capacity: number,
    energy_holder_points: number,
    claim_timestamp: number,
    harvest_boosters: harvestBoosters
}

export interface harvestBoosters {
    [type: string]: harvestBooster
}

export interface harvestBooster {
    count: number,
    prev_burns: number
}

export interface simpleStat {
    id: string,
    count: number
}

export interface reptileTemplate {
    name: string,
    img: string,
    video: string,
    Rarity: string,
    animalName: string,
    Breed: string,
    genusSpecies: string,
    genesTraits: string,
    Region: string,
    rplmPerWeek: number,
    Breeder: string,
    Set: string
}

export interface reptileTemplateObj {
    [templateId: string]: reptileTemplate
}

export interface userReptiles {
    [id: string]: Array<simpleCount>
}

export interface incomeTemplates {
    id: string,
    schema: string,
    rpw: number
}

export type Schema = 'pythons' | 'geckos' | 'boas' | 'beardedragons'

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

export type Sex = 'male' | 'female'

export type BreedableReptile = {
    life: number,
    expired: false
}

export type BreedableReptiles = {
    [id: string]: BreedableReptile[]
}

export type BreedableSortedReptiles = {
    pythons: BreedableReptiles,
    geckos: BreedableReptiles,
    boas: BreedableReptiles,
    beardedragons: BreedableReptiles
}

export type Pair = {
    life: number,
    male: string,
    female: string,
    expired: boolean,
    breeding: boolean,
    claimed: boolean,
    breedingStartedAt: number
}

export type Pairs = {
    [id: string]: Pair[]
}