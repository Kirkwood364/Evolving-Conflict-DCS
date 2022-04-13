/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../../";

export async function processEventBirth(eventObj: any): Promise<void> {
    const curUnitId = eventObj.data.initiator.unitId;
    await new Promise((f) => setTimeout(f, 1000));
    // console.log("Birth Event Object",eventObj);
    if (curUnitId) {
        let iUnit = await ddcsControllers.unitActionRead({unitId: curUnitId});
        if (iUnit.length > 1) {
            console.log("More than one, a total of", iUnit.length, "units with that unit ID in the database | Refining further for only non-dead units. Units found with that unitId", iUnit);
            iUnit = await ddcsControllers.unitActionRead({unitId: curUnitId, dead: false});
            console.log("Refined search returned,", iUnit.length, "entries with iUnit returning:", iUnit);
            if (iUnit.length > 1) {
                console.log("Look for UnitID of non-Dead units, with isAI false and unitCatergory 0 (Aircraft)");
                iUnit = await ddcsControllers.unitActionRead({unitId: curUnitId, dead: false, isAI : false, unitCategory: 0});
                console.log("Found a total of:", iUnit.length, "units. iUnit:", iUnit);
            }
        }
        const curIUnit = iUnit[0];

        if (curIUnit && curIUnit.playername && curIUnit.playername !== "") {
            const curBaseName = curIUnit.groupName.split(" @")[0];
            const curSlotSide = _.includes(ddcsControllers.getEngineCache().campaign.countrySides[2],
                ddcsControllers.countryId[curIUnit.country]) ? 2 : 1;
            const bases = await ddcsControllers.campaignAirfieldActionRead({_id: curBaseName});
            // initial spawn is not owned by same side, immediate spectator kick
            // console.log("Player Spawn Event");
            const playerArray = await ddcsControllers.srvPlayerActionsRead({sessionName: ddcsControllers.getSessionName()});
            // console.log("PA: ", playerArray);
            if (curIUnit) {
                console.log("Player with name", curIUnit.playername, "event birth");
                const iPlayer = _.find(playerArray, {name: curIUnit.playername});
                // console.log("playerarray: ", iPlayer, curIUnit);
                if (iPlayer) {
                    if (bases.length > 0) {
                        if (bases[0].baseType === "FOB") {
                            const shelterAlive = await ddcsControllers.unitActionRead({
                                _id:  bases[0]._id + " Shelter",
                                dead: false,
                                coalition: bases[0].side
                            });
                            if (shelterAlive.length > 0) {
                                if (curSlotSide !== shelterAlive[0].coalition) {
                                    console.log(iPlayer.name + " cannot spawn at base you do not own ", bases[0]._id);
                                    await ddcsControllers.forcePlayerSpectator(
                                        iPlayer.playerId,
                                        "Player cannot spawn at a base you dont currently own"
                                    );
                                }
                            }
                        }
                        if (bases[0].baseType === "MOB") {
                            if (curSlotSide !== bases[0].side) {
                                console.log(iPlayer.name + " cannot spawn at base you do not own ", bases[0]._id);
                                await ddcsControllers.forcePlayerSpectator(
                                    iPlayer.playerId,
                                    "Player cannot spawn at a base you dont currently own"
                                );
                            }
                        }
                    }

                    const iCurObj = {
                        sessionName: ddcsControllers.getSessionName(),
                        eventCode: ddcsControllers.shortNames[eventObj.action],
                        iucid: iPlayer.ucid,
                        iName: curIUnit.playername,
                        displaySide: curIUnit.coalition,
                        roleCode: "I",
                        msg: "C: " + curIUnit.playername + " enters a brand new " + curIUnit.type,
                        groupId: curIUnit.groupId
                    };
                    // console.log(iCurObj.msg)
                    let enemyCoalition = 0;
                    // console.log("Spawning Unit Coalition:",iPlayer.sideLock)
                    if (iPlayer.sideLock === 1 || iPlayer.side === 1) {
                        // console.log("I'm sidelocked to 1")
                        enemyCoalition = 2;
                    }
                    if (iPlayer.sideLock === 2 || iPlayer.side === 2) {
                        // console.log("I'm sidelocked to 2")
                        enemyCoalition = 1;
                    }
                    const enemiesNearby = await ddcsControllers.getCoalitionGroundUnitsInProximity(curIUnit.lonLatLoc, 0.5, enemyCoalition);
                    console.log("enemiesNearby.length:", enemiesNearby.length);
                    if (enemiesNearby.length > 0) {
                        console.log("There were enemies nearby to", iPlayer.name, ". one of the Units were:", enemiesNearby[0].type);
                        await ddcsControllers.forcePlayerSpectator(
                            iPlayer.playerId,
                            "There are enemy ground units near(<500m) the aircraft you attempted to spawn in, you were unable to reach the aircraft."
                        );
                    }
                    /*
                    if (iCurObj.iucid) {
                        await ddcsControllers.sendToCoalition({payload: {action: eventObj.action, data: _.cloneDeep(iCurObj)}});
                        // await ddcsControllers.simpleStatEventActionsSave(iCurObj);
                    }
                     */
                    await ddcsControllers.srvPlayerActionsClearTempWarbonds({_id: iCurObj.iucid, groupId: iCurObj.groupId});
                }
            }
        }

        /*
        // give them a menu
        if (eventObj.data.initiator.groupId) {
            // Only players can get a menu
            // console.log("spawning player menu");
            await ddcsControllers.initializeMenu(eventObj.data.initiator);
        }
         */
    }
}
