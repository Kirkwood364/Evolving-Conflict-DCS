import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import * as ddcsControllers from "../";
import {zip} from "zip-a-folder";
import {format, setUpDefaultMissionFile, templateExportFormatFixes} from "../";

export async function updateWeather() {
    const curEngineCache = ddcsControllers.getEngineCache();
    const pathToCampaignFolder = "../../../missions/" + curEngineCache.campaign._id;
    const directoryPath = path.join(__dirname, pathToCampaignFolder);
    // console.log("DirectoryPath: ", directoryPath);
    const fullFilePath = directoryPath + "\\export\\" + _.toString(curEngineCache.campaign.currentCampaignBubble);
    const curMission = ddcsControllers.parse(`return {${fs.readFileSync(fullFilePath + "\\mission", "ascii")}}`);
    const getTheaterWeather = await ddcsControllers.weatherRead({enabled: true, theaters: curEngineCache.campaign.theater});
    const pickWeather = _.sample(getTheaterWeather);
    if (pickWeather) {
        console.log("Weather Chosen: " + pickWeather._id);
        curMission.mission.date = pickWeather.date;
        curMission.mission.weather = pickWeather.weather;
        curMission.mission.start_time = pickWeather.start_time;

        // rewrite file
        ddcsControllers.curWriteFile(
            format(curMission)
            .replace("return {\n  ", "")
            .replace(",\n}", "")
            .replace("[\"mission\"]", "mission")
            .replace(/\[\"onboard_num\"\] = ([0-9]+)/g, "[\"onboard_num\"] = \"$1\""),
        fullFilePath + "\\mission");

        const mizFolder = directoryPath + "\\run";
        console.log("Read: " + fullFilePath + " Write: " + mizFolder);
        await zip(fullFilePath, mizFolder + "/" + curEngineCache.campaign._id + "_" +
            _.toString(curEngineCache.campaign.currentCampaignBubble) + ".miz");
    }
}
