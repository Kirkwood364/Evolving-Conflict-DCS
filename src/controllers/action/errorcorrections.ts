/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */


import * as _ from "lodash";
import * as ddcsControllers from "../";


export async function correctPlayerAircraftDuplicates(): Promise<void> {
    const aircraftFlying = await ddcsControllers.unitActionRead({unitCategory: 0, objectCategory: 1, playername: { $ne : "" }});
    if (aircraftFlying.length > 1) {
        for (const aircraftFlyingItem of aircraftFlying) {
            let playerAircraft = await ddcsControllers.unitActionRead({
                unitCategory: 0,
                objectCategory: 1,
                playername: aircraftFlyingItem.playername
            });
            if (playerAircraft.length > 1) {
                const deadPlayerAircraft = await ddcsControllers.unitActionRead({
                    unitCategory: 0,
                    objectCategory: 1,
                    playername: playerAircraft[0].playername, dead: true
                });
                if (deadPlayerAircraft.length >= 1) {
                    // console.log("Dead Player Aircraft Found:", deadPlayerAircraft.length);
                    for (const aircraft of deadPlayerAircraft) {
                        /*
                        console.log(
                            "Removing dead", aircraft.type,
                            "belonging to", aircraft.playername, "from the database"
                        );
                         */
                        await ddcsControllers.unitActionDelete(aircraft);
                    }
                }
                playerAircraft = await ddcsControllers.unitActionRead({
                    unitCategory: 0,
                    objectCategory: 1,
                    playername: playerAircraft[0].playername});
                if (playerAircraft.length > 1) {
                    // console.log("Still too many aircraft in DB showing controlled by",
                    // playerAircraft[0].playername, "removing the oldest");
                    const oldestPlayerAircraft = await ddcsControllers.unitActionReadOldest({
                        unitCategory: 0,
                        objectCategory: 1,
                        playername: playerAircraft[0].playername
                    });
                    await ddcsControllers.unitActionDelete(oldestPlayerAircraft[0]);
                }
            }
        }
    }
}

export async function disconnectionDetction(): Promise<void> {
    const iCurObj = {
        sessionName: ddcsControllers.getSessionName(),
        secondsAgo: 2
    };
    const totalDisconnects = await ddcsControllers.simpleStatEventActionsReadDisconnectsInLastSeconds(iCurObj);
    if (totalDisconnects.length > 2 && ddcsControllers.getCurSeconds() >
        (ddcsControllers.getMaxTime() - ddcsControllers.time.threeMinutes)) {
        console.log("Clients Disconnected en masse - There were a total of disconnects",
            totalDisconnects.length, "in the past", iCurObj.secondsAgo, "seconds.");
        const mesg = "**Clients Disconnected en masse** \n DCS.exe stopped sending network traffic for a time \n LP will be refunded \n DCS.log:";
        await ddcsControllers.sendMessageToDiscord(mesg);
        await ddcsControllers.sendDCSLogFileToDiscord();
        for (const player of totalDisconnects) {
            await ddcsControllers.simpleStatEventActionUpdate({
                _id: player._id,
                showInChart : false
            });
        }
        const playerArray = await ddcsControllers.srvPlayerActionsRead({sessionName: ddcsControllers.getSessionName()});
        for (const player of totalDisconnects) {
            const iPlayer = _.find(playerArray, {name: player.iName});
            if (iPlayer) {
                let iObject = {_id: iPlayer._id,
                    warbonds: iPlayer.warbonds + iPlayer.tmpWarbonds,
                    tmpWarbonds: 0
                };
                if (!isFinite(iObject.warbonds)) {
                    iObject = {_id: iPlayer._id,
                        warbonds: 2000,
                        tmpWarbonds: 0
                    };
                    console.log("ERROR-INFWB Warbonds for infinity found in iObject, line 59 , errorCorrection.ts");
                }
                await ddcsControllers.srvPlayerActionsUpdate({iObject});
                console.log("Refunded ", iPlayer.tmpWarbonds, " to ", iPlayer.name, "due to a mass disconnect event");
                // console.log("iObject:",iObject)
            }
        }
    }
}

export async function fixInfinityWarbonds(): Promise<void> {
    const playersWithInfinityWarbonds = await ddcsControllers.srvPlayerActionsRead({warbonds: Infinity});
    if (playersWithInfinityWarbonds.length > 0) {
        for (const player of playersWithInfinityWarbonds) {
            await ddcsControllers.srvPlayerActionsUpdate({_id: player._id, warbonds: 2000});
            console.log(player.name, " had Infinity warbonds, resetting to 1000. player._id", player._id);
        }
    }
}
