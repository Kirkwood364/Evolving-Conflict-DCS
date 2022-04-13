/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

// Schema defines how chat messages will be stored in MongoDB
export function campaignAirfieldModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("campaignairfield", new mongoose.Schema({
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
            side: {
                type: Number,
                required: true,
                default: 0
            },
            awacsReplenTime: {
                type: Date
            },
            markId: {
                type: Number
            },
            baseMarkId: {
                type: Number
            },
            replenTime: {
                type: Date
            },
            underAttack: {
                type: Number
            },
            polygonLoc: {
                type: {},
                required: true,
                default: {}
            },
            baseType: {
                type: String,
                required: true,
                default: "FOB"
            },
            defaultStartSide: {
                type: Number,
                required: true,
                default: 0
            },
            bubbleMapIds: {
                type: [],
                required: true,
                default: []
            }
        },
        {
            timestamps: true
        }
    ));
}
