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