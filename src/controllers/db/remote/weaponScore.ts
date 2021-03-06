/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";

export async function weaponScoreActionsRead(obj: any): Promise<typings.IWeaponDictionary[]> {
    return new Promise((resolve, reject) => {
        dbModels.weaponScoreModel.find(obj, (err: any, weaponDictionary: typings.IWeaponDictionary[]) => {
            if (err) { reject(err); }
            resolve(weaponDictionary);
        });
    });
}

export async function weaponScoreActionsReadWeapon(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.weaponScoreModel.find({_id: obj.typeName}, (err: any, weaponscore: typings.IWeaponDictionary[]) => {
            if (err) { reject(err); }

            const firstWeaponScore = weaponscore[0];
            if (firstWeaponScore) {
                const curWeaponScore = new dbModels.weaponScoreModel({
                    _id: obj.typeName,
                    name: obj.typeName,
                    displayName: obj.displayName,
                    category: obj.category,
                    unitType: obj.unitType
                });
                curWeaponScore.save((saveErr: any) => {
                    if (saveErr) {
                        reject(saveErr);
                    }
                    resolve();
                });
            } else {
                // console.log('curweaponscore: ', curWeaponScore);
                resolve();
            }
        });
    });
}

export async function weaponScoreActionUpdate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.weaponScoreModel.findOneAndUpdate(
            {_id: obj._id},
            {$set: obj},
            (err: any) => {
                if (err) { reject(err); }
                resolve();
            }
        );
    });
}

export async function weaponScoreActionsCheck(obj: any) {

    dbModels.weaponScoreModel.find({_id: obj._id}, async (err: any, weaponScore: typings.IWeaponDictionary[]) => {
        if (err) {
            console.log("line:396: ", err);
        }
        if (weaponScore.length === 0) {
            const curWeaponScore = new dbModels.weaponScoreModel(obj);
            await curWeaponScore.save((saveErr: any) => {
                if (saveErr) {
                    console.log("line:406: Cannot save weapon score", saveErr, obj);
                }
            });
        } else {
            // update records
            await weaponScoreActionUpdate(obj);
        }
    });
}
