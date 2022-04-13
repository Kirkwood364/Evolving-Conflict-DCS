/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as types from "../../../typings";
import { dbModels } from "../common";

// real dictionary db functions, don't use this for anything other than importing, or pulling for cache
export async function airfieldDictionaryActionRead(obj: any): Promise<types.IAirfieldDictionary[]> {
    return new Promise( async (resolve, reject) => {
        await dbModels.airfieldDictionaryModel.find(obj, (err: any, airfields: Promise<types.IAirfieldDictionary[]>) => {
            if (err) { reject(err); }
            resolve(airfields);
        });
    });
}

export async function airfieldDictionaryActionUpdate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.airfieldDictionaryModel.updateOne(
            {_id: obj._id},
            {$set: obj},
            {upsert: true},
            (err: any) => {
                if (err) { reject(err); }
                resolve();
            }
        );
    });
}

export async function airfieldDictionaryActionDelete(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.airfieldDictionaryModel.findOneAndRemove({_id: obj._id}, (err: any) => {
            if (err) { reject(err); }
            resolve();
        })
            .catch((err: any) => {
                console.log("ERR: ", err);
            });
    });
}
