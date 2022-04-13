/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as types from "../../../typings";
import { dbModels } from "../common";
import * as ddcsController from "../../";

export async function strategicPointRead(obj: any): Promise<types.IStrategicPoint[]> {
    return new Promise( async (resolve, reject) => {
        await dbModels.strategicPointModel.find(obj, (err: any, strategicPoints: Promise<types.IStrategicPoint[]>) => {
            if (err) { reject(err); }
            resolve(strategicPoints);
        });
    });
}

export async function strategicPointUpdate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.strategicPointModel.updateOne(
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

export async function strategicPointSave(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.strategicPointModel.find({_id: obj._id}, (findErr: any, strategicPointObj: types.IStrategicPoint[]) => {
            if (findErr) { reject(findErr); }
            if (strategicPointObj.length === 0) {
                const sObj = new dbModels.strategicPointModel(obj);
                sObj.save((err: any) => {
                    if (err) { reject(err); }
                    resolve();
                });
            } else {
                // console.log("strategicPoint already exists: ", obj);
            }
        });
    });
}

export async function strategicPointModelRemoveAll(): Promise<void> {
    return dbModels.strategicPointModel.deleteMany({});
}
