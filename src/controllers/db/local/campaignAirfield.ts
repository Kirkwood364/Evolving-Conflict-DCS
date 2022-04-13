/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as types from "../../../typings";
import { dbModels } from "../common";
import * as ddcsControllers from "../../";

// real dictionary db functions, dont use this for anything other than importing, or pulling for cache
export async function campaignAirfieldActionRead(obj: any): Promise<types.ICampaignAirfield[]> {
    return new Promise( async (resolve, reject) => {
        await dbModels.campaignAirfieldModel.find(obj, (err: any, airfields: Promise<types.ICampaignAirfield[]>) => {
            if (err) { reject(err); }
            resolve(airfields);
        });
    });
}

export async function campaignAirfieldActionUpdate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        delete obj.__v;
        dbModels.campaignAirfieldModel.updateOne(
            {_id: obj._id},
            {$set: obj},
            {upsert: true, new: true, setDefaultsOnInsert: true},
            (err: any) => {
                if (err) { reject(err); }
                resolve();
            }
        );
    });
}

export async function campaignAirfieldActionDelete(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.findOneAndRemove({_id: obj._id}, (err: any) => {
            if (err) { reject(err); }
            resolve();
        })
            .catch((err: any) => {
                console.log("ERR: ", err);
            });
    });
}

export async function campaignAirfieldActionGetClosestBase(obj: { unitLonLatLoc: number[] }): Promise<types.ICampaignAirfield> {
    const engineCache = ddcsControllers.getEngineCache();
    // console.log("SpawnTanker: ", obj, engineCache.campaign.currentCampaignBubble);
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.find(
            {
                baseType: "MOB",
                enabled: true,
                centerLoc: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: obj.unitLonLatLoc
                        }
                    }
                },
                bubbleMapIds: _.toString(engineCache.campaign.currentCampaignBubble)
            },
            (err: any, campaignAirfield: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(campaignAirfield[0]);
            }
        );
    });
}

export async function campaignAirfieldActionGetClosestFriendlyBase(obj: {
    playerSide: number,
    unitLonLatLoc: number[]
}): Promise<types.ICampaignAirfield> {

    const engineCache = ddcsControllers.getEngineCache();
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.find(
            {
                baseType: "MOB",
                enabled: true,
                side: obj.playerSide,
                centerLoc: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: obj.unitLonLatLoc
                        }
                    }
                },
                bubbleMapIds: _.toString(engineCache.campaign.currentCampaignBubble)
            },
            (err: any, campaignAirfield: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(campaignAirfield[0]);
            }
        );
    });
}

export async function campaignAirfieldActionGetClosestEnemyBase(obj: {
    playerSide: number,
    unitLonLatLoc: number[]
}): Promise<types.ICampaignAirfield> {

    const engineCache = ddcsControllers.getEngineCache();
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.find(
            {
                baseType: "MOB",
                enabled: true,
                side: ddcsControllers.enemyCountry[obj.playerSide],
                centerLoc: {
                    $near: {
                        $geometry: {
                            type: "Point",
                            coordinates: obj.unitLonLatLoc
                        }
                    }
                },
                mapType: engineCache.campaign.theater,
                bubbleMapIds: _.toString(engineCache.campaign.currentCampaignBubble)
            },
            (err: any, dbairfields: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(dbairfields[0]);
            }
        );
    });
}


export async function campaignAirfieldActionGetBaseSides(): Promise<types.ICampaignAirfield[]> {

    const engineCache = ddcsControllers.getEngineCache();
    return new Promise((resolve, reject) => {
        if (!engineCache.campaign.theater) {
            dbModels.campaignAirfieldModel.find(
                {mapType: engineCache.campaign.theater, enabled: true},
                (err: any, dbAirfields: types.ICampaignAirfield[]) => {
                    if (err) { reject(err); }
                    resolve(_.transform(dbAirfields, (result: any, value: any) => {
                        result.push({name: value.name, baseType: value.baseType, side: value.side});
                    }, []));
                }
            );
        } else {
            dbModels.campaignAirfieldModel.find(
                {mapType: engineCache.campaign.theater, enabled: true},
                (err: any, dbAirfields: types.ICampaignAirfield[]) => {
                    if (err) { reject(err); }
                    resolve(_.transform(dbAirfields, (result: any, value: any) => {
                        result.push({name: value.name, baseType: value.baseType, side: value.side});
                    }));
                }
            );
        }
    });
}

export async function campaignAirfieldActionUpdateSide(obj: {
    _id: string,
    side: number
}): Promise<types.ICampaignAirfield[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.updateMany(
            {_id: new RegExp(obj._id)},
            {$set: {side: obj.side, replenTime: new Date()}},
            (err: any, airfields: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(airfields);
            }
        );
    });
}

export async function campaignAirfieldActionUpdateSpawnZones(obj: {
    _id: string,
    spawnZones: object
}): Promise<types.ICampaignAirfield[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.updateOne(
            {_id: obj._id},
            {$set: {spawnZones: obj.spawnZones}},
            (err: any, airfield: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(airfield);
            }
        );
    });
}

export async function campaignAirfieldActionUpdateReplenTimer(obj: {
    _id: string,
    replenTime: number
}): Promise<types.ICampaignAirfield[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.updateOne(
            {_id: obj._id},
            {$set: {replenTime: obj.replenTime}},
            (err: any, airfield: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(airfield);
            }
        );
    });
}

export async function campaignAirfieldActionUpdateAwacsTimer(obj: {
    _id: string,
    awacsReplenTime: number
}): Promise<types.ICampaignAirfield[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.updateOne(
            {_id: obj._id},
            {$set: {awacsReplenTime: obj.awacsReplenTime}},
            (err: any, airfield: types.ICampaignAirfield[]) => {
                if (err) { reject(err); }
                resolve(airfield);
            }
        );
    });
}

export async function campaignAirfieldActionSave(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.campaignAirfieldModel.find({_id: obj._id}, (findErr: any, airfieldObj: types.ICampaignAirfield[]) => {
            if (findErr) { reject(findErr); }
            if (airfieldObj.length === 0) {
                const aObj = new dbModels.campaignAirfieldModel(obj);
                aObj.save((err: any) => {
                    if (err) { reject(err); }
                    resolve();
                });
            } else {
                dbModels.campaignAirfieldModel.updateOne(
                    {_id: obj._id},
                    {$set: {side: obj.side}},
                    (err: any) => {
                        if (err) { reject(err); }
                        resolve();
                    }
                );
            }
        });
    });
}

export async function campaignAirfieldModelRemoveAll(): Promise<void> {
    return dbModels.campaignAirfieldModel.deleteMany({});
}
