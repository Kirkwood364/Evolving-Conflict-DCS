import * as mongoose from "mongoose";
import * as localModels from "../local/models";
import * as remoteModels from "../remote/models";
import * as ddcsController from "../../";

export let localConnection: mongoose.Connection;
export let remoteConnection: mongoose.Connection;
export const dbModels: any = {};

export async function getDbConnection(
    host: string = "",
    database: string = "",
    user: string = "",
    password: string = ""
): Promise<mongoose.Connection> {
    const login = (!!user && !!password) ? user + ":" + password + "@" : "";
    const authSource = (!!user && !!password) ? "?authSource=admin" : "";
    return mongoose.createConnection(
        "mongodb://" + login + host + ":27017/" + database + authSource,
        { useCreateIndex: true, useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true }
    );
}

export async function updateAirfieldDictionary(): Promise<void> {
    const curAirfieldDictionaries = await ddcsController.airfieldDictionaryActionRead({});
    if (curAirfieldDictionaries.length > 0) {
        ddcsController.setAirfieldDictionaries(curAirfieldDictionaries);
    }
}

export async function updateBases(): Promise<void> {
    const curCampaignAirfields = await ddcsController.campaignAirfieldActionRead({});
    if (curCampaignAirfields.length > 0) {
        ddcsController.setBases(curCampaignAirfields);
    }
}

export async function updateConfig(): Promise<void> {
    const curServer = await ddcsController.serverActionsRead({_id: process.env.SERVER_NAME});
    ddcsController.setConfig(curServer[0]);
}

export async function updateCampaign(curCampaignId: string): Promise<void> {
    const curCampaigns = await ddcsController.campaignConfigActionsRead({_id: curCampaignId});
    ddcsController.setCampaign(curCampaigns[0]);
}

export async function updateI18n(): Promise<void> {
    ddcsController.setI18n(await ddcsController.i18nActionsRead());
}

export async function updateUnitDictionary(curTimePeriod: string): Promise<void> {
    ddcsController.setUnitDictionary(await ddcsController.unitDictionaryActionsRead({ timePeriod: curTimePeriod }));
}

export async function updateWeaponDictionary(): Promise<void> {
    ddcsController.setWeaponDictionary(await ddcsController.weaponScoreActionsRead({}));
}

export async function updateMenuCommands(): Promise<void> {
    ddcsController.setMenuCommands(await ddcsController.menuCommandsRead({}));
}

export function updateDBModels(dbConnection: mongoose.Connection, modelsLibrary: any) {
    for (const [key, value] of Object.entries(modelsLibrary)) {
        // @ts-ignore
        dbModels[key] = value(dbConnection);
    }
}

export async function initV3EngineMaster(): Promise<void> {
    remoteConnection = await getDbConnection(
        process.env.DB_REMOTE_HOST,
        process.env.DB_REMOTE_DATABASE,
        process.env.DB_USER,
        process.env.DB_PASSWORD
    );

    updateDBModels(remoteConnection, remoteModels);
}

export async function initV3Engine(): Promise<void> {

    localConnection = await getDbConnection(
        process.env.DB_LOCAL_HOST,
        process.env.DB_LOCAL_DATABASE,
        process.env.DB_USER,
        process.env.DB_PASSWORD
    );

    updateDBModels(localConnection, localModels);

    remoteConnection = await getDbConnection(
        process.env.DB_REMOTE_HOST,
        process.env.DB_REMOTE_DATABASE,
        process.env.DB_USER,
        process.env.DB_PASSWORD
    );

    updateDBModels(remoteConnection, remoteModels);

    await updateConfig();
    await updateI18n();
    await updateCampaign(ddcsController.getEngineCache().config.currentCampaignId);
    await updateUnitDictionary(ddcsController.getEngineCache().campaign.timePeriod);
    await updateWeaponDictionary();
    await updateAirfieldDictionary();
    await updateBases();
    // run npm run start -- import "name of the campaign checked into the mission folder uncompressed"
    // this code will create/re-create a campaign table insert from the master mission file
    // 1. npm run start -- import "campaign file name under missions ex: DDCS-Modern-CA"
    // 2. boot up a game and let the end of this process connect into it
    // 3. In game chat run -admin updateAirfields  (this updates the airfield dictionary tables)
    // 4. In game chat run -admin importlonlat (this updates the campaign config with the server lonLat values for yx)
    // 5. wait for number 4. to finish, takes a few mins, it will say "Finished Importing Polys" when done
    // if any of these processes are run out of order or you update the map in any way, you need to run all of these processes

    // do NOT run this command when a server is running, it WILL destroy the server and take it down and lose session information
    if (process.argv[2] === "import") {
        console.log("running campaign importer");
        // arg 3 will be campaign name
        await ddcsController.processCampaignMissionFile(process.argv[3], !!process.argv[4]);
        await ddcsController.startUpReceiveUDPSocket();
    } else {
        await updateMenuCommands();
        await ddcsController.setResetFullCampaign(ddcsController.getEngineCache().config.resetFullCampaign);
        await ddcsController.startUpReceiveUDPSocket();

        setInterval( async () => {
            if (ddcsController.getServerSynced()) {
                await ddcsController.processOneSecActions(ddcsController.getServerSynced());
            }
        }, ddcsController.time.sec);

        setInterval( async () => {
            await ddcsController.processFiveSecActions(ddcsController.getServerSynced());
            await ddcsController.processTimer(ddcsController.getCurAbsTime());
        }, ddcsController.time.fiveSecs);

        setInterval( async () => {
            await ddcsController.processThirtySecActions(ddcsController.getServerSynced());
        }, ddcsController.time.thirtySecs);

        setInterval( async () => {
            if (ddcsController.getSessionName() !== "") {
                await ddcsController.sessionsActionsUpdate({
                    _id: ddcsController.getSessionName(),
                    startAbsTime: ddcsController.getStartAbsTime(),
                    curAbsTime: ddcsController.getCurAbsTime()
                });
            }

            if (ddcsController.getServerSynced()) {
                await ddcsController.processOneMinuteActions(ddcsController.getServerSynced());
            }

        }, ddcsController.time.oneMin);

        setInterval( async () => {
            await ddcsController.processFiveMinuteActions(ddcsController.getServerSynced());
        }, ddcsController.time.fiveMins);

        setInterval( async () => {
            if (ddcsController.getServerSynced()) {
                await ddcsController.processTenMinuteActions(ddcsController.getServerSynced());
            }
        }, ddcsController.time.tenMinutes);

        setInterval( async () => {
            if (ddcsController.getServerSynced()) {
                await ddcsController.processThirtyMinuteActions(ddcsController.getServerSynced());
            }
        }, ddcsController.time.thirtyMinutes);

        setInterval( async () => {
            if (ddcsController.getServerSynced()) {
                await ddcsController.processOneHourActions(ddcsController.getServerSynced());
            }
        }, ddcsController.time.oneHour);
    }
}
