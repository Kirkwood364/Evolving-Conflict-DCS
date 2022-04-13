/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";
export function simpleStatEventModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("simplestatevents", new mongoose.Schema({
        _id : {
            type: String,
            required: true
        },
        sessionName: {
            type: String
        },
        eventCode: {
            type: String
        },
        iucid: {
            type: String
        },
        iName: {
            type: String
        },
        tucid: {
            type: String
        },
        tName: {
            type: String
        },
        displaySide: {
            type: String
        },
        roleCode: {
            type: String
        },
        msg: {
            type: String
        },
        score: {
            type: Number
        },
        showInChart: {
            type: Boolean,
            default: false
        },
        initiator: {
            type: Object
        },
        target: {
            type: Object
        },
        weapon: {
            type: Object
        },
        killer: {
            type: String
        },
        killerType: {
            type: String
        },
        killerControlledBy: {
            type: String
        },
        victim: {
            type: String
        },
        victimType: {
            type: String
        },
        victimControlledBy: {
            type: String
        },
        weapon_name: {
            type: String
        }
    },
    {
        timestamps: true
    }
    ));
}
