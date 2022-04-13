/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

// Schema defines how chat messages will be stored in MongoDB
export function airfieldDictionaryModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("airfielddictionary", new mongoose.Schema({
            _id: {
                type: String,
                required: true
            },
            alt: {
                type: Number,
                required: true
            },
            baseId: {
                type: Number,
                required: true
            },
            category: {
                type: Number,
                required: true
            },
            centerLoc: {
                type: [Number],
                index: "2dsphere"
            },
            enabled: {
                type: Boolean,
                required: true,
                default: false
            },
            hdg: {
                type: Number,
                min: 0,
                max: 359,
                required: true
            },
            mapLoc: {
                type: {},
                required: true,
                default: {}
            },
            mapType: {
                type: String,
                required: true
            },
            campaignIds: {
                type: [],
                required: true,
                default: {}
            }
        },
        {
            timestamps: true
        }
    ));
}
