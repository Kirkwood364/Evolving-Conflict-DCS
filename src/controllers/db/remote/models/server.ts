/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

export function serverModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("server", new mongoose.Schema({
            _id: {
                type: String,
                required: true
            },
            ip: {
                type: String,
                required: true,
                default: "localhost"
            },
            inGameHitMessages: {
                type: Boolean,
                required: true,
                default: true
            },
            DCSLogFileLocation: {
                type: String,
                required: true,
                default: ""
            },
            discordWebHookURL: {
                type: String,
                required: true,
                default: ""
            },
            SRSFilePath: {
                type: String,
                required: true,
                default: ""
            },
            isDiscordAllowed: {
                type: Boolean,
                required: true,
                default: true
            },
            curTimer: {
                type: Number,
                required: true,
                default: 0
            },
            isServerUp: {
                type: Boolean,
                required: true,
                default: false
            },
            isDiscordOnline: {
                type: Boolean,
                required: true,
                default: false
            },
            restartTime: {
                type: Number,
                required: true,
                default: 21600.0
            },
            timePeriod: {
                type: String,
                required: true,
                default: "modern"
            },
            fullServerRestartOnCampaignWin: {
                type: Boolean,
                required: true,
                default: true
            },
            resetFullCampaign: {
                type: Boolean,
                required: true,
                default: false
            },
            guildedSubGroups: {
                type: Array,
                required: true,
                default: []
            },
            campaignRotation: {
                type: Array,
                required: true,
                default: []
            },
            campaignRotationCategory: {
                type: String,
                required: true,
                default: ""
            },
            currentCampaignId: {
                type: String,
                required: true,
                default: ""
            },
            maxAllowedSpectatorSlotKicks: {
                type: Number,
                required: true,
                default: 5
            },
            maxAllowedServerKicks: {
                type: Number,
                required: true,
                default: 3
            },
            discordCurrentOnlineVoice: {
                type: {},
                required: true,
                default: {}
            },
            patreonLvl: {
                type: {},
                required: true,
                default: {}
            }
        },
        {
            timestamps: true
        }
    ));
}
