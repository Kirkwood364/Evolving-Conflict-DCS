/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as typings from "../../../typings";
import { dbModels } from "../common";

export async function sessionsActionsRead(obj: any): Promise<typings.ISessions[]> {
    return new Promise((resolve, reject) => {
        dbModels.sessionsModel.find(obj).exec((err: any, sessions: typings.ISessions[]) => {
            if (err) { reject(err); }
            resolve(sessions);
        });
    });
}

export async function sessionsActionsReadLatest(): Promise<typings.ISessions> {
    return new Promise((resolve, reject) => {
        dbModels.sessionsModel.find().sort({createdAt: -1 }).limit(1).exec((err: any, session: typings.ISessions[]) => {
            if (err) { reject(err); }
            if (session.length > 0) {
                resolve(session[0]);
            }
        });
    });
}

export async function sessionsActionsReadLatestTwo(): Promise<typings.ISessions[]> {
    return new Promise((resolve, reject) => {
        dbModels.sessionsModel.find().sort({ createdAt: -1 }).limit(2).exec((err: any, session: typings.ISessions[]) => {
            if (err) { reject(err); }
            resolve(session);
        });
    });
}

export async function sessionsActionsUpdate(obj: any): Promise<typings.ISessions[]> {
    return new Promise((resolve, reject) => {
        dbModels.sessionsModel.updateOne(
            {_id: obj._id},
            {$set: obj},
            { upsert : true },
            (err: any, sessions: typings.ISessions[]) => {
                if (err) { reject(err); }
                resolve(sessions);
            }
        );
    });
}

export async function sessionsActionsSave(obj: any): Promise<void> {
    return new Promise((resolve, reject) => {
        dbModels.sessionsModel.find({_id: obj._id}, (err: any, sessionsObj: typings.ISessions[]) => {
            if (err) {reject(err); }
            if (sessionsObj.length === 0) {
                const sessions = new dbModels.sessionsModel(obj);
                sessions.save((saveErr: any) => {
                    if (saveErr) {reject(saveErr); }
                    resolve();
                });
            }
        });
    });
}

/* not used anymore, dont turn on
export async function sessionsActionsEndLastCampaign() {
    const allSessions = await sessionsActionsRead({campaignName: "DDCSModernCaucasus_1642677394000"});
    allSessions.pop();
    const date = new Date().toJSON().slice(0, 10).replace(/-/g, "/");
    for (const session of allSessions) {
        session.campaignName = "Ended On:" + date;
        await sessionsActionsUpdate({
            _id: session._id,
            campaignName: session.campaignName
        });
    }
}
 */
