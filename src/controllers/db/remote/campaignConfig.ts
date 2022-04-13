/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";


export async function campaignConfigActionsCreate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const campaignConfig = new dbModels.campaignConfigModel(obj);
        campaignConfig.save((err: any) => {
            if (err) { reject(err); }
            resolve();
        });
    });
}

export async function campaignConfigActionsRead(obj: any): Promise<typings.ICampaignConfig[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignConfigModel.find(obj, (err: any, campaignConfig: typings.ICampaignConfig[]) => {
            if (err) { reject(err); }
            resolve(campaignConfig);
        }).catch((err: any) => {
            console.log("ERR: ", err);
        });
    });
}

export async function campaignConfigActionsUpdate(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.campaignConfigModel.findOneAndUpdate(
            {_id: obj._id},
            {$set: obj},
            {upsert: true},
            (err: any) => {
                if (err) { reject(err); }
                resolve();
            }
        )
            .catch((err: any) => {
                console.log("ERR: ", err);
            });
    });
}

export async function campaignConfigActionsDelete(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.campaignConfigModel.findOneAndRemove({_id: obj._id}, (err: any) => {
            if (err) { reject(err); }
            resolve();
        })
            .catch((err: any) => {
                console.log("ERR: ", err);
            });
    });
}
