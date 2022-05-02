/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

export function weatherModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("weatherdictionary", new mongoose.Schema({
            _id: {
                type: String,
                required: true
            },
            enabled: {
                type: Boolean,
                required: true,
                default: false
            },
            theaters: {
                type: [],
                required: true,
                default: []
            },
            start_time: {
                type: Number,
                required: true
            },
            date: {
                type: {},
                required: true
            },
            weather: {
                type: {},
                required: true
            }
        },
        {
            timestamps: true
        }
    ));
}
