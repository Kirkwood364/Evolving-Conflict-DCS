/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";
import * as ddcsControllers from "../../";

export async function campaignsActionsRead(): Promise<typings.ICampaigns[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignsModel.find((err: any, campaigns: typings.ICampaigns[]) => {
            if (err) { reject(err); }
            resolve(campaigns);
        });
    });
}

export async function campaignsActionsReadLatest(): Promise<typings.ICampaigns> {
    return new Promise((resolve, reject) => {
        dbModels.campaignsModel.find().sort({createdAt: -1 }).limit(1)
            .exec((err: any, campaigns: typings.ICampaigns[]) => {
            if (err) { reject(err); }
            if (campaigns.length > 0) {
                resolve(campaigns[0]);
            }
        });
    });
}

export async function campaignsActionsUpdate(obj: any): Promise<typings.ICampaigns[]> {
    return new Promise((resolve, reject) => {
        dbModels.campaignsModel.updateOne(
            {_id: obj._id},
            {$set: obj},
            (err: any, campaigns: typings.ICampaigns[]) => {
                if (err) { reject(err); }
                resolve(campaigns);
            }
        );
    });
}

export async function campaignsActionsSave(obj: {
    _id: string
}): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.campaignsModel.find({_id: obj._id}, (err: any, campaignsObj: typings.ICampaigns[]) => {
            if (err) {reject(err); }
            if (campaignsObj.length === 0) {
                const campaigns = new dbModels.campaignsModel(obj);
                campaigns.save((saveErr: any) => {
                    if (saveErr) {reject(saveErr); }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}
