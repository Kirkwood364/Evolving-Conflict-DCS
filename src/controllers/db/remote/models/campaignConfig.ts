/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as mongoose from "mongoose";

export function campaignConfigModel(dbconn: mongoose.Connection): mongoose.Document | {} {
    return dbconn.model("campaignconfig", new mongoose.Schema({
            _id: {
                type: String,
                required: true
            },
            enabled: {
                type: Boolean,
                required: true,
                default: false
            },
            theater: {
                type: String,
                required: true,
                default: "Caucasus"
            },
            replenThresholdBase: {
                type: Number,
                required: true,
                default: 25
            },
            replenTimer: {
                type: Number,
                required: true,
                default: 1800
            },
            baseWarbondIncome: {
                type: Number,
                required: true,
                default: 10
            },
            startWarbonds: {
                type: Number,
                required: true,
                default: 4000
            },
            slingableDiscount: {
                type: Number,
                required: true,
                default: 0.5
            },
            ejectionRefundModifier: {
                type: Number,
                required: true,
                default: 0.2
            },
            maxUnits: {
                type: Number,
                required: true,
                default: 15
            },
            jtacSpotDistance: {
                type: Number,
                required: true,
                default: 10
            },
            baseSpotDistance: {
                type: Number,
                required: true,
                default: 10
            },
            troopUnloadDistance: {
                type: Number,
                required: true,
                default: 3.4
            },
            troopLoadDistance: {
                type: Number,
                required: true,
                default: 3.4
            },
            crateUnpackDistance: {
                type: Number,
                required: true,
                default: 0.8
            },
            intCargoUnloadDistanceAirfield: {
                type: Number,
                required: true,
                default: 3.4
            },
            intCargoLoadDistanceAirfield: {
                type: Number,
                required: true,
                default: 3.4
            },
            intCargoUnloadDistanceFarp: {
                type: Number,
                required: true,
                default: 0.1
            },
            intCargoLoadDistanceFarp: {
                type: Number,
                required: true,
                default: 0.1
            },
            baseCaptureProximity: {
                type: Number,
                required: true,
                default: 3
            },
            heliOnlyResupply: {
                type: Boolean,
                required: true,
                default: false
            },
            tacCommAccessAcqCount: {
                type: Number,
                required: true,
                default: 8
            },
            spwnLimitsPerTick: {
                type: {},
                required: true,
                default: {}
            },
            maxCrates: {
                type: Number,
                required: true,
                default: 10
            },
            maxTroops: {
                type: Number,
                required: true,
                default: 1
            },
            maxUnitsMoving: {
                type: Number,
                required: true,
                default: 7
            },
            weaponRules: {
                type: [],
                required: true,
                default: []
            },
            pveAIConfig: {
                type: [],
                required: true,
                default: []
            },
            timePeriod: {
                type: String,
                required: true,
                default: "modern"
            },
            isJtacLocked: {
                type: Boolean,
                required: true,
                default: true
            },
            aiConvoysEnabled: {
                type: Boolean,
                required: true,
                default: false
            },
            reactiveConvoyAI: {
                type: Boolean,
                required: true,
                default: false
            },
            reactiveBaseAI: {
                type: Boolean,
                required: true,
                default: false
            },
            GCIDetectTypes: {
                type: [],
                required: true,
                default: []
            },
            countrySides: {
                type: [],
                required: true,
                default: []
            },
            lockedUsernames: {
                type: [],
                required: true,
                default: []
            },
            currentCampaignBubble: {
                type: Number,
                required: true,
                default: 0
            },
            bubbleMap: {
                type: {},
                required: true,
                default: {}
            },
            kudosAmount: {
                type: Number,
                default: 200
            },
        },
        {
            timestamps: true
        }
    ));
}
