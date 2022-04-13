import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "../";

// tslint:disable-next-line:no-var-requires
const os = require("os");
// tslint:disable-next-line:no-var-requires
const fse = require("fs-extra");
import * as fs from "fs";

const homeDirPath = "\\Saved Games\\DCS.openbeta_server\\Config\\serverSettings.lua";

export function defaultServerSettings(fullFilePath: string) {
    return {
        cfg: {
            current: 6,
            description: "",
            require_pure_textures: true,
            listStartIndex: 1,
            advanced: {
                allow_change_tailno: false,
                allow_ownship_export: true,
                allow_object_export: false,
                pause_on_load: false,
                allow_sensor_export: false,
                event_Takeoff: false,
                pause_without_clients: false,
                client_outbound_limit: 0,
                client_inbound_limit: 0,
                server_can_screenshot: true,
                allow_players_pool: false,
                voice_chat_server: false,
                allow_change_skin: false,
                event_Connect: true,
                event_Ejecting: false,
                event_Kill: false,
                event_Crash: false,
                allow_dynamic_radio: true,
                event_Role: false,
                maxPing: 0,
                resume_mode: 1,
                allow_trial_only_clients: false
            },
            port: "10308",
            mode: 0,
            bind_address: "",
            isPublic: true,
            lastSelectedMission: fullFilePath,
            listShuffle: false,
            password: "",
            listLoop: false,
            name: "DDCS Server|Player Driven Campaign|Combined Arms Supported",
            version: 1,
            missionList: {
                1: fullFilePath
            },
            require_pure_clients: true,
            require_pure_models: true,
            maxPlayers: 60
        }
    };
}


export function setNewMissionFile(campaign: string, bubbleMapId: number) {
    const curCache = ddcsControllers.getEngineCache();
    const pathToServerSettings = os.homedir() + homeDirPath;
    fse.copySync(pathToServerSettings, pathToServerSettings + "old");

    const curSettings = ddcsControllers.parse(`return {${fs.readFileSync(pathToServerSettings, "ascii")}}`);
    const oldFullFilePath = curSettings.cfg.missionList["1"].split("\\");
    const filePath = oldFullFilePath.pop();
    oldFullFilePath.splice(-2, 2);
    oldFullFilePath.push(campaign);
    oldFullFilePath.push("run");
    oldFullFilePath.push(campaign + "_" + _.toString(bubbleMapId) + ".miz");
    const serverSettingsFile = ddcsControllers.format(defaultServerSettings(oldFullFilePath.join("\\\\")))
        .replace("return {\n  ", "")
        .replace(",\n}", "")
        .replace("[\"cfg\"]", "cfg");
    ddcsControllers.curWriteFile(serverSettingsFile, pathToServerSettings);
    console.log("Setting Server To Bootup File: ", campaign + "_" + _.toString(bubbleMapId) + ".miz");

    // make sure mklink /J "C:\Users\afinegan\Saved Games\DCS.openbeta_server\bubbleMaps" "C:\Users\afinegan\IdeaProjects\DDCS\missions"
    // is created
    // C:\\Users\\andre\\Saved Games\\DCS.openbeta_server\\bubbleMaps\\DDCS-Modern-CA\\run\\DDCS-Modern-CA_-1.miz
}
