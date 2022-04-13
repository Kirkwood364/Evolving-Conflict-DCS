import * as typings from "../../typings";
import * as ddcsControllers from "../";

export async function checkForLockedCA() {
    const getOccupiedUnits = await ddcsControllers.unitActionRead({
        dead: false,
        playerOwnerId: {$ne: ""},
        unitCategory: 2,
        playerCanDrive: true,
        $and: [
            {playername: {$ne: null}},
            {playername: {$ne: ""}}
        ]
    });
    if (getOccupiedUnits.length > 0) {
        for (const unit of getOccupiedUnits) {
            const getPlayerRecord = await ddcsControllers.srvPlayerActionsRead({
                sessionName: ddcsControllers.getSessionName(),
                name: unit.playername,
                $or: [
                    {slot: new RegExp("artillery_commander")},
                    {slot: new RegExp("forward_observer")}
                ]
            });
            if (getPlayerRecord.length > 0) {
                if (getPlayerRecord[0]._id !== unit.playerOwnerId) {
                    // kick user to spectator for being in a locked unit
                    const getOwner = await ddcsControllers.srvPlayerActionsRead({_id: unit.playerOwnerId});
                    if (getOwner.length > 0) {
                        if (getOwner[0].name && getOwner[0].caLockedToOwner) {
                            console.log(unit.playername + ": This Combat Arms Ground Unit " + unit.type +
                                " Is Locked To Its Owner " + getOwner[0].name);
                            await ddcsControllers.forcePlayerSpectator(
                                getPlayerRecord[0].playerId,
                                "This Combat Arms Ground Unit " + unit.type + " Is Locked To Its Owner " + getOwner[0].name
                            );
                        }
                    }
                }
                if (getPlayerRecord.length > 1) {
                    console.log("More than 1 server player record for username: ", unit.playername);
                }
            }
        }
    }
}

