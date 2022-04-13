import * as _ from "lodash";
import * as typings from "../../typings";
import * as ddcsControllers from "../";

export async function reclaimInactiveAcquisitions(unit: typings.IUnit, player: typings.ISrvPlayers) {
    const engCache = ddcsControllers.getEngineCache();
    // pull all units not in active bubble
    const inactiveAcquisitionUnits = await ddcsControllers.unitActionRead({
        playerOwnerId: player._id,
        isBubbleMapCategorized: true,
        bubbleMapParents: {$ne: _.toString(engCache.campaign.currentCampaignBubble)}
    });
    if (inactiveAcquisitionUnits.length > 0) {
        // delete units
        let totalWarbondsDeleted = 0;
        for (const inactiveUnitObj of inactiveAcquisitionUnits) {
            const unitDeletedDictionary = engCache.unitDictionary.find((ud: { _id: string; }) => ud._id === inactiveUnitObj.type);
            if (unitDeletedDictionary) {
                await ddcsControllers.unitActionDelete({_id: inactiveUnitObj._id});
                totalWarbondsDeleted += unitDeletedDictionary.warbondCost;
            }
        }
        // refund warbonds for units
        if (totalWarbondsDeleted > 0) {
            console.log("Player: " + player.name + " Has reclaimed ", totalWarbondsDeleted + " from inactive bubbles");
            await ddcsControllers.addWarbonds(
                player,
                unit,
                "reclaimAcq",
                totalWarbondsDeleted
            );
            await ddcsControllers.sendMesgToGroup(
                player,
                unit.groupId,
                "G: You have gained " + totalWarbondsDeleted + " acquisitions from inactive units",
                10
            );
        }
    } else {
        await ddcsControllers.sendMesgToGroup(
            player,
            unit.groupId,
            "G: No inactive acquisitions found",
            10
        );
    }
}
