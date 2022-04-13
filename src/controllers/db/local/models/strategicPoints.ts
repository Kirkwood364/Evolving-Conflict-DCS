/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

// Schema defines how chat messages will be stored in MongoDB
export function strategicPointModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("strategicPoint", new mongoose.Schema({
            _id: {
                type: String,
                required: true
            },
            enabled: {
                type: Boolean,
                required: true,
                default: true
            },
            markId: {
                type: []
            },
            strategicType: {
                type: String,
                required: true
            },
            polyMode: {
                type: String
            },
            mapType: {
                type: String,
                required: true
            },
            radius: {
                type: Number
            },
            polygonPoints: {
                type: Array
            },
            polygonPointsXY: {
                type: Array
            },
            details: {
                spawnBuildingAmount: {
                    type: Number,
                    required: true,
                    default: 1
                },
                crateCost: {
                    type: Number,
                    required: true
                },
                strategicPointOptions: {
                    type: String,
                    required: true
                }
            }
        },
        {
            timestamps: true
        }
    ));
}
