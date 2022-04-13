import * as _ from "lodash";
import * as path from "path";
import * as fs from "fs";
import {zip} from "zip-a-folder";
import * as typings from "../../typings";
import * as ddcsControllers from "../";

// tslint:disable-next-line:no-var-requires
const {parse: parseLua} = require("luaparse");
// tslint:disable-next-line:no-var-requires
const fse = require("fs-extra");

const formatLuaString = (string: string, singleQuote: string) => {
    let formattedString: string;
    if (/^\d+$/.test(string)) {
        formattedString = `${string.replace(/'/g, "")}`;
    } else {
        formattedString = (singleQuote ? `'${string.replace(/'/g, "\\'")}'` :
            `"${string.replace(/"/g, "\\\"")}"`);
    }
    return formattedString;
};

const formatLuaKey = (string: string, singleQuote: string) => (string.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/) ? `["${string}"]` :
    `[${formatLuaString(string, singleQuote)}]`);

export const format = (value: any, options = {eol: "\n", singleQuote: false, spaces: 2}): string => {
    const curOptions: any = options || {};
    const eol = (curOptions.eol = _.isString(curOptions.eol) ? curOptions.eol : "\n");
    curOptions.singleQuote = _.isBoolean(curOptions.singleQuote) ? curOptions.singleQuote : true;
    curOptions.spaces = _.isNull(curOptions.spaces) || _.isNumber(curOptions.spaces) ||
    _.isString(curOptions.spaces) ? curOptions.spaces : 2;

    const rec = (curValue: any, i: number = 0): any => {
        if (_.isNull(curValue)) {
            return "nil";
        }
        if (_.isBoolean(curValue) || _.isNumber(curValue)) {
            return curValue.toString();
        }
        if (_.isString(curValue)) {
            return formatLuaString(curValue, curOptions.singleQuote);
        }
        if (_.isArray(curValue)) {
            if (_.isEmpty(curValue)) {
                return "{}";
            }
            if (curOptions.spaces) {
                const spaces = _.isNumber(curOptions.spaces) ? _.repeat(" ",
                    curOptions.spaces * (i + 1)) : _.repeat(curOptions.spaces, i + 1);
                const spacesEnd = _.isNumber(curOptions.spaces) ? _.repeat(" ",
                    curOptions.spaces * i) : _.repeat(curOptions.spaces, i);
                return `{${eol}${curValue.map((e) => `${spaces}${rec(e, i + 1)},`).join(eol)}${eol}${spacesEnd}}`;
            }
            return `{${curValue.map((e) => `${rec(e, i + 1)},`).join("")}}`;
        }
        if (_.isObject(curValue)) {
            if (_.isEmpty(curValue)) {
                return "{}";
            }
            if (curOptions.spaces) {
                const spaces = _.isNumber(curOptions.spaces) ? _.repeat(" ",
                    curOptions.spaces * (i + 1)) : _.repeat(curOptions.spaces, i + 1);
                const spacesEnd = _.isNumber(curOptions.spaces) ? _.repeat(" ",
                    curOptions.spaces * i) : _.repeat(curOptions.spaces, i);
                // @ts-ignore
                return `{${eol}${_.keys(curValue).map((key) => `${spaces}${formatLuaKey(key, curOptions.singleQuote)} = ${rec(curValue[key], i + 1)},`)
                    .join(eol)}${eol}${spacesEnd}}`;
            }
            // @ts-ignore
            return `{${_.keys(curValue).map((key) => `${formatLuaKey(key, curOptions.singleQuote)} = ${rec(curValue[key], i + 1)},`)
                .join("")}}`;
        }
        throw new Error(`can't format ${typeof curValue}`);
    };

    return `return${curOptions.spaces ? " " : ""}${rec(value)}`;
};

const luaAstToJson = (ast: any): any => {
    // console.log("AST: ", ast);
    // literals
    if (["NilLiteral", "BooleanLiteral", "NumericLiteral", "StringLiteral"].includes(ast.type)) {
        return ast.value;
    }
    // basic expressions
    if (ast.type === "UnaryExpression" && ast.operator === "-") {
        return -luaAstToJson(ast.argument);
    }
    if (ast.type === "Identifier") {
        return ast.name;
    }
    // tables
    if (["TableKey", "TableKeyString"].includes(ast.type)) {
        return {__internal_table_key: true, key: luaAstToJson(ast.key), value: luaAstToJson(ast.value)};
    }
    if (ast.type === "TableValue") {
        return luaAstToJson(ast.value);
    }
    if (ast.type === "TableConstructorExpression") {
        if (ast.fields[0] && ast.fields[0].key) {
            const object = _.fromPairs(
                _.map(ast.fields, (field) => {
                    const {key, value} = luaAstToJson(field);
                    return [key, value];
                })
            );
            return _.isEmpty(object) ? [] : object;
        }
        return _.map(ast.fields, (field) => {
            const value = luaAstToJson(field);
            return value.__internal_table_key ? [value.key, value.value] : value;
        });
    }
    // top-level statements, only looking at the first statement, either return or local
    if (ast.type === "LocalStatement") {
        const values = ast.init.map(luaAstToJson);
        return values.length === 1 ? values[0] : values;
    }
    if (ast.type === "ReturnStatement") {
        const values = ast.arguments.map(luaAstToJson);
        return values.length === 1 ? values[0] : values;
    }
    if (ast.type === "Chunk") {
        return luaAstToJson(ast.body[0]);
    }
    throw new Error(`can't parse ${ast.type}`);
};

export const parse = (value: any) => luaAstToJson(parseLua(value, {
    encodingMode: "x-user-defined",
    comments: false
}));

export function curWriteFile(contents: string, curPath: string) {
    fs.writeFile(curPath, contents, (err) => {
        if (err) {
            console.error(err);
        }
    });
}

export async function processCampaignMissionFile(campaignName: string, skipDbImport?: boolean) {
    const pathToCampaignFolder = "../../../missions/" + campaignName;
    const directoryPath = path.join(__dirname, pathToCampaignFolder);
    console.log("DirectoryPath: ", directoryPath);

    try {
        const curMission = parse(`return {${fs.readFileSync(directoryPath + "\\master\\mission", "ascii")}}`);
        // const curDictionary = parse(`return {${fs.readFileSync(directoryPath + "l10n\\DEFAULT\\dictionary", "ascii")}}`);
        // const curMapResource = parse(`return {${fs.readFileSync(directoryPath + "l10n\\DEFAULT\\mapResource", "ascii")}}`);
        // console.log("mission: ", curMission);
        // console.log("dictionary: ", curDictionary);
        // console.log("mapResoure: ", curMapResource);
        // consoleLogObject(curMission.mission);
        await generateMissionFile(curMission.mission, pathToCampaignFolder, campaignName, directoryPath, skipDbImport);
    } catch (err) {
        console.error(err);
    }
}

export function consoleLogObject(mainMissionFile: any) {
    // console.log(mainMissionFile);
    // dont delete these console logs, can be used for future debugging if mission file format changes
    // console.log("trig: ", mainMissionFile.trig);
    // console.log("requiredModules: ", mainMissionFile.requiredModules);
    // console.log("date: ", mainMissionFile.date);
    // console.log("result: ", mainMissionFile.result);
    // console.log("groundControl: ", mainMissionFile.groundControl);
    // console.log("maxDictId: ", mainMissionFile.maxDictId);
    // console.log("pictureFileNameN: ", mainMissionFile.pictureFileNameN);
    // console.log("drawings: ", mainMissionFile.drawings.layers);
    // console.log("goals: ", mainMissionFile.goals);
    // console.log("descriptionNeutralsTask: ", mainMissionFile.descriptionNeutralsTask);
    // console.log("weather: ", mainMissionFile.weather);
    // console.log("theatre: ", mainMissionFile.theatre);
    // console.log("triggers: ", mainMissionFile.triggers);
    // console.log("map: ", mainMissionFile.map);
    // console.log("coalitions: ", mainMissionFile.coalitions.neutrals);
    // console.log("descriptionText: ", mainMissionFile.descriptionText);
    // console.log("pictureFileNameR: ", mainMissionFile.pictureFileNameR);
    // console.log("descriptionBlueTask: ", mainMissionFile.descriptionBlueTask);
    // console.log("descriptionRedTask: ", mainMissionFile.descriptionRedTask);
    // console.log("pictureFileNameB: ", mainMissionFile.pictureFileNameB);
    // console.log("coalition: ", mainMissionFile.coalition.blue.country[1].plane);
    // console.log("sortie: ", mainMissionFile.sortie);
    // console.log("version: ", mainMissionFile.version);
    // console.log("trigrules: ", mainMissionFile.trigrules);
    // console.log("currentKey: ", mainMissionFile.currentKey);
    // console.log("start_time: ", mainMissionFile.start_time);
    // console.log("forcedOptions: ", mainMissionFile.forcedOptions);
    // console.log("failures: ", mainMissionFile.failures);
}

export function templateExportFormatFixes(missionFile: any, unitsByCountry: any, bullsEyeObj?: any) {
    return format(setUpDefaultMissionFile(missionFile, unitsByCountry, unitsByCountry.polyUnitObjs, bullsEyeObj))
        .replace("return {\n  ", "")
        .replace(",\n}", "")
        .replace("[\"mission\"]", "mission")
        .replace(/\[\"onboard_num\"\] = ([0-9]+)/g, "[\"onboard_num\"] = \"$1\"");
}

export async function generateMissionFile(
    mainMissionFile: any,
    filePath: string,
    campaignId: string,
    directoryPath: string,
    skipDbImport?: boolean
) {
    // check for bubble split polys
    const bubbleWarArray: any[] = _.filter(
        mainMissionFile.drawings.layers[5].objects,
        (o) => /BUBBLEWAR/.test(o.name)
    );
    if (bubbleWarArray.length > 0) {
        console.log("BubbleWar Split Map Count: ", bubbleWarArray.length);
        for (const mapBubblePoly of bubbleWarArray) {
            const bubbleWarConfig = mapBubblePoly.name.split("|");
            console.log("BubbleConfig: ", bubbleWarConfig);

            const dir = directoryPath + "\\export\\" + bubbleWarConfig[2];

            if (fs.existsSync(dir)) {
                fs.rmSync(dir, {recursive: true});
            }
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, {recursive: true});
            }
            // To copy a folder or file
            fse.copySync(directoryPath + `\\master`, dir);

            const processedCoalitionObject = processCoalitionUnits(mainMissionFile, mapBubblePoly, skipDbImport);
            if (!skipDbImport) {
                await ddcsControllers.importCampaignData(
                    campaignId + "_" + bubbleWarConfig[2],
                    processedCoalitionObject.polyUnitObjs,
                    mainMissionFile,
                    mapBubblePoly
                );
                processedCoalitionObject.polyUnitObjs[5].objects = {}; // don't draw author polys into run files
            }

            ddcsControllers.curWriteFile(
                templateExportFormatFixes(
                    mainMissionFile,
                    processedCoalitionObject,
                    mapBubblePoly
                ),
                dir + "\\mission");

            // create miz file
            const mizFolder = directoryPath + "\\run";
            if (!fs.existsSync(mizFolder)) {
                fs.mkdirSync(mizFolder, {recursive: true});
            }
            await zip(dir, mizFolder + "/" + campaignId + "_" + bubbleWarConfig[2] + ".miz");
        }
    } else {
        // console.log("NO BUBBLE");
        const dir = directoryPath + "\\export";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, {recursive: true});
        }

        // To copy a folder or file
        fse.copySync(directoryPath + `\\master`, dir);

        const processedCoalitionObject = processCoalitionUnits(mainMissionFile);
/*
        await ddcsControllers.importCampaignData(
            campaignId,
            processedCoalitionObject.polyUnitObjs,
            mainMissionFile
        );
        processedCoalitionObject.polyUnitObjs[5].objects = {}; // don't draw author polys into run files
*/
        ddcsControllers.curWriteFile(
            templateExportFormatFixes(
                mainMissionFile,
                processedCoalitionObject
            ),
            dir + "\\mission");

        // create miz file
        const mizFolder = directoryPath + "\\run";
        if (!fs.existsSync(mizFolder)) {
            fs.mkdirSync(mizFolder, {recursive: true});
        }
        await zip(dir, mizFolder + "/" + campaignId + ".miz");
    }
    // test rebuilding campaign tables
    // await ddcsControllers.replaceCampaignAirfields();
    // await ddcsControllers.replaceStrategicPoints();

    console.log("Campaign " + campaignId + " Import and File Split Done");
}

export function upgradeBasePolygons(name: string, points: any) {
    const pointArray = {};
    const starterX = points[1].x;
    const starterY = points[1].y;
    for (const [key, value] of Object.entries(points)) {
        // @ts-ignore
        pointArray[key] = {x: value.x - starterX, y: value.y - starterY};
    }
    return {
        visible: true,
        fillColorString: "0xff000000",
        polygonMode: "free",
        mapX: starterX,
        mapY: starterY,
        primitiveType: "Polygon",
        colorString: "0x0000ffff",
        style: "dot",
        thickness: 16,
        layerName: "Author",
        name,
        points: pointArray
    };
}

export function layerObjDefaults(layers: any) {
    // console.log("layers: ", layers[1], layers[2], layers[3]);
    return {
        1: {visible: true, name: "Red", objects: layers[1]},
        2: {visible: true, name: "Blue", objects: layers[2]},
        3: {visible: true, name: "Neutral", objects: layers[3]},
        4: {visible: true, name: "Common", objects: layers[4]},
        5: {visible: true, name: "Author", objects: layers[5]}
    };
}

export function upgradeDefaultPolygons(name: string, points: any) {
    return {
        visible: true,
        radius: 300,
        colorString: "0x0000ffff",
        mapX: points.x,
        mapY: points.y,
        primitiveType: "Polygon",
        polygonMode: "circle",
        style: "solid",
        thickness: 8,
        layerName: "Author",
        name,
        fillColorString: "0x0000ff7c"
    };
}

export function rebuildPolysToDrawingObjects(
    curMainMissionFile: any,
    unitPolys: any,
    defaultPolys: any,
    polygonObj?: any,
    skipDbImport?: boolean
): any {
    // import all old polys as author level drawing objects
    let originalPolyArray: any = curMainMissionFile.drawings.layers[5].objects;
    const origPolyArray: any = [];
    for (const [polyKey, polyObj] of Object.entries(originalPolyArray)) {
        origPolyArray.push(polyObj);
    }
    const uniqPolyArray = _.uniqBy(origPolyArray, "name");
    // console.log("UPA1: ", uniqPolyArray.length);

    const freeBaseArray: string[] = [];
    if (_.isArray(uniqPolyArray) && uniqPolyArray.length === 0) {
        originalPolyArray = {};
    }

    let startLoopCounter = uniqPolyArray.length;

    for (const unitPoly of unitPolys) {
        const curPolyArray = {};
        for (const [pointKey, pointObj] of Object.entries(unitPoly.route.points)) {
            // @ts-ignore
            curPolyArray[pointKey] = {x: pointObj.x, y: pointObj.y};
        }
        originalPolyArray[startLoopCounter] = upgradeBasePolygons(unitPoly.name, curPolyArray);
        startLoopCounter++;
    }
    for (const defaultPoly of defaultPolys) {
        originalPolyArray[startLoopCounter] = upgradeDefaultPolygons(
            defaultPoly.name,
            {x: defaultPoly.route.points[1].x, y: defaultPoly.route.points[1].y}
        );
        startLoopCounter++;
    }
    // get free bases and include them to all polys
    for (const uniqPoly of uniqPolyArray) {
        // @ts-ignore
        // if (uniqPoly.name === "|DEFAULTS||Hatay|MOB|1|true|false|") {
            // console.log("OPK: ", uniqPoly);
        // }
        // @ts-ignore
        if (/DEFAULTS/.test(uniqPoly.name)) {
            // @ts-ignore
            if (uniqPoly.name.split("|")[7] === "true" || skipDbImport) {
                // @ts-ignore
                const freeBaseId = uniqPoly.name.split("|")[3];
                console.log("Free Bases: ", freeBaseId);
                freeBaseArray.push(freeBaseId);
            }
        }
    }

    if (polygonObj) {
        const layerObjPolyDefaults: any = {
            1: {},
            2: {},
            3: {},
            4: {},
            5: {}
        };
        // loop through the 5 layers of polys, don't add any of the author polys (number 5s)
        for (let p = 1; p < 6; p++) {
            let curCount = 1;
            let isBubblePolyAdded = false;
            if (p === 4) {
                if (!isBubblePolyAdded && !skipDbImport) {
                    // add borders for generated polys
                    layerObjPolyDefaults[p][curCount] = {
                        name: polygonObj.name,
                        visible: true,
                        mapX: polygonObj.mapX,
                        mapY: polygonObj.mapY,
                        angle: polygonObj.angle,
                        height: polygonObj.height,
                        width: polygonObj.width,
                        primitiveType: "Polygon",
                        polygonMode: "rect",
                        layerName: "Common",
                        style: "dotdash",
                        thickness: 20,
                        fillColorString: "0x80000000",
                        colorString: "0x800000ff"
                    };
                    curCount++;
                    isBubblePolyAdded = true;
                }
            }
            const makeArrayUniq: any = [];
            for (const [polyKey, polyObj] of Object.entries(curMainMissionFile.drawings.layers[p].objects)) {
                makeArrayUniq.push(polyObj);
            }
            const uniqArray = _.uniqBy(makeArrayUniq, "name");
            for (const uniqA of uniqArray) {
                // @ts-ignore
                if (p < 4 || uniqA.name.split("|")[7] === "true" || skipDbImport ||
                    ddcsControllers.isUnitInsidePolygonXY(uniqA, polygonObj)) {
                    layerObjPolyDefaults[p][curCount] = uniqA;
                    curCount++;
                }
            }
        }
        return [layerObjDefaults(layerObjPolyDefaults), freeBaseArray];
    } else {
        return [layerObjDefaults({
            1: curMainMissionFile.drawings.layers[1].objects,
            2: curMainMissionFile.drawings.layers[2].objects,
            3: curMainMissionFile.drawings.layers[3].objects,
            4: curMainMissionFile.drawings.layers[4].objects,
            5: originalPolyArray
        })];
    }
}

export function getXYRectPointsFromBubble(polygonObj: any) {
    const position = [(polygonObj.mapX - (polygonObj.height / 2)), (polygonObj.mapY - (polygonObj.width / 2))];
    const size = [polygonObj.height, polygonObj.width];
    const degrees = polygonObj.angle;

    const vertices = ddcsControllers.findRectVertices(position, size, degrees);
    return [
        {x: vertices.LT[0], y: vertices.LT[1]},
        {x: vertices.RT[0], y: vertices.RT[1]},
        {x: vertices.RB[0], y: vertices.RB[1]},
        {x: vertices.LB[0], y: vertices.LB[1]}
    ];
}

export async function getLonlatForBubbleMap(bubbleMapPoly: any, bubbleMapId: number) {
    // console.log("getLonLatForBubbleMap: ", bubbleMapPoly.bubbleMapYx, bubbleMapId);
    const curNextUniqueId = ddcsControllers.getNextUniqueId();
    ddcsControllers.setRequestJobArray({
        reqId: curNextUniqueId,
        callBack: "convertYXArrayToLonLatForBubbleMap",
        reqArgs: {
            bubbleMapId
        }
    }, curNextUniqueId);
    await ddcsControllers.sendUDPPacket("frontEnd", {
        actionObj: {
            action: "convertYXArrayToLonLat",
            xyArray: bubbleMapPoly.bubbleMapYx,
            reqArgs: {
                bubbleMapId
            },
            reqID: curNextUniqueId,
            time: new Date()
        }
    });
}

export async function convertYXArrayToLonLatForBubbleMap(
    incomingObj: any,
    reqId: any,
    reqArgs: any
) {
    // console.log("processYxBackBubbleMap: ", incomingObj, reqId, reqArgs);
    const curLonLatPoly = await ddcsControllers.campaignConfigActionsRead(
        {_id: ddcsControllers.getEngineCache().config.currentCampaignId}
    );
    if (curLonLatPoly.length > 0) {
        const curPayloadObj = {
            _id: curLonLatPoly[0]._id,
            ["bubbleMap." + _.toNumber(reqArgs.bubbleMapId) + ".bubbleInformation.bubbleMapLonlat"]: incomingObj.returnObj
        };
        // console.log("PP: ", polyPath.lonLat);
        await ddcsControllers.campaignConfigActionsUpdate(curPayloadObj);
    }
}

export function processCoalitionUnits(curMainMissionFile: typings.IMainMission, polygonObj?: any, skipDbImport?: boolean) {
    const unitObjByCountry: any = {
        neutrals: {
            country: {}
        },
        red: {
            country: {}
        },
        blue: {
            country: {}
        }
    };

    const unitPolys = [];
    const defaultPolys = [];
    const freeSpawnBases: string[] = [];

    for (const [coalitionKey, coalitionObj] of Object.entries(curMainMissionFile.coalition)) {
        for (const [countryKey, countryObj] of Object.entries(coalitionObj.country)) {
            for (const [unitTypeKey, unitTypeObj] of Object.entries(countryObj)) {
                // console.log("unitTypeKey: ", unitTypeKey, unitTypeObj);
                if (unitTypeKey !== "id" && unitTypeKey !== "name") {
                    // @ts-ignore
                    for (const [unitKey, unitObj] of Object.entries(unitTypeObj.group)) {
                        // @ts-ignore
                        if (/POLY/.test(unitObj.name) || /AICAP/.test(unitObj.name)) {
                            // left in to convert old unit polygons to draw polygons
                            unitPolys.push(unitObj);
                        } else {
                            // @ts-ignore
                            if (/DEFAULTS/.test(unitObj.name)) {
                                // left in to convert old default polygon units to draw polygons
                                defaultPolys.push(unitObj);
                            }
                        }
                    }
                }
            }
        }
    }
    const processPolyObjects = rebuildPolysToDrawingObjects(curMainMissionFile, unitPolys, defaultPolys, polygonObj, skipDbImport);
    unitObjByCountry.polyUnitObjs = processPolyObjects[0];

    for (const [coalitionKey, coalitionObj] of Object.entries(curMainMissionFile.coalition)) {
        let countryCounter = 1;
        for (const [countryKey, countryObj] of Object.entries(coalitionObj.country)) {
            let incCountry = 0;
            // awconsole.log("countryKey: ", countryCounter, countryKey, countryObj.name);
            for (const [unitTypeKey, unitTypeObj] of Object.entries(countryObj)) {
                let arrayCounter = 1;
                // console.log("unitTypeKey: ", unitTypeKey, unitTypeObj);
                if (unitTypeKey !== "id" && unitTypeKey !== "name") {
                    // @ts-ignore
                    for (const [unitKey, unitObj] of Object.entries(unitTypeObj.group)) {
                        // @ts-ignore
                        if (/POLY/.test(unitObj.name) || /AICAP/.test(unitObj.name) || /DEFAULTS/.test(unitObj.name)) {
                            // left in to convert old unit polygons to draw polygons
                            unitPolys.push(unitObj);
                        } else {
                            if (polygonObj) {
                                // @ts-ignore
                                if (processPolyObjects[1].includes(unitObj.name.split(" @ ")[0]) || /~PERM/.test(unitObj.name) ||
                                    skipDbImport || ddcsControllers.isUnitInsidePolygonXY(unitObj, polygonObj)) {
                                    // @ts-ignore
                                    if (/~PERM/.test(unitObj.name)) {
                                        // @ts-ignore
                                        console.log("PERM", unitObj.name);
                                    }
                                    // if (isUnitInsidePolygon(unitObj, polygonObj)) {
                                    if (["vehicle", "ship", "static", "helicopter", "plane"].includes(unitTypeKey)) {
                                        if (!unitObjByCountry[coalitionKey].country[countryCounter]) {
                                            unitObjByCountry[coalitionKey].country[countryCounter] = {
                                                id: countryObj.id,
                                                name: countryObj.name
                                            };
                                            incCountry = 1;
                                        }
                                        if (!unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey]) {
                                            unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey] = {group: {}};
                                        }
                                        unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey].
                                            group[arrayCounter] = unitObj;
                                        arrayCounter++;
                                    }
                                }
                            } else {
                                if (["vehicle", "ship", "static", "helicopter", "plane"].includes(unitTypeKey)) {
                                    if (!unitObjByCountry[coalitionKey].country[countryCounter]) {
                                        unitObjByCountry[coalitionKey].country[countryCounter] = {id: countryObj.id, name: countryObj.name};
                                        arrayCounter++;
                                    }
                                    if (!unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey]) {
                                        unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey] = {group: {}};
                                    }
                                    unitObjByCountry[coalitionKey].country[countryCounter][unitTypeKey].group[arrayCounter] = unitObj;
                                    arrayCounter++;
                                }
                            }
                        }
                    }
                }
            }
            countryCounter += incCountry;
        }
    }
    // console.log("UOBC: ", unitObjByCountry);
    return unitObjByCountry;
}

export function defaultBubbleMapObj(
    bubbleObj: any,
    polygonObjs: typings.IPolygonObjs
) {
    // console.log("bub: ", polygonObjs[5].objects);
    const bubbleMapObj: any = {
        bubbleName: bubbleObj.name.split("|")[3],
        bubbleInformation: {
            x: bubbleObj.mapX,
            y: bubbleObj.mapY,
            height: bubbleObj.height,
            width: bubbleObj.width,
            angle: bubbleObj.angle,
            bubbleMapYx: ddcsControllers.getXYRectPointsFromBubble(bubbleObj),
            bubbleMapLonlat: []
        },
        baseAwacs: {},
        mainCampaignBases: Array(),
        freeAirframeBases: Array(),
        currentServerMarkerId: 1000,
        strategicPoints: {},
        polygonLoc: {}
    };

    // strategic points
    for (const [commonPolyKey, commonPolyObj] of Object.entries(polygonObjs[4].objects)) {
        // don't process the built-in bubble border
        if (commonPolyObj.style !== "dotdash") {
            const curStrategicArray = commonPolyObj.name.split("|");
            const xyPointsArray: Array<{ x: number, y: number }> = Array();

            for (const [pointKey, pointObj] of Object.entries(commonPolyObj.points)) {
                // @ts-ignore
                xyPointsArray.push({x: commonPolyObj.mapX + pointObj.x, y: commonPolyObj.mapY + pointObj.y});
            }

            if (!bubbleMapObj.strategicPoints[curStrategicArray[4]]) {
                bubbleMapObj.strategicPoints[curStrategicArray[4]] = {
                    strategicType: curStrategicArray[3],
                    mapType: ddcsControllers.getEngineCache().campaign.theater,
                    details: {
                        crateCost: _.toNumber(curStrategicArray[5]),
                        spawnBuildingAmount: _.toNumber(curStrategicArray[6]),
                        strategicPointOptions: _.toNumber(curStrategicArray[7])
                    },
                    polygonPointsXY: [xyPointsArray]
                };
            } else {
                bubbleMapObj.strategicPoints[curStrategicArray[4]].polygonPointsXY.push(xyPointsArray);
            }
        }
    }

    let updatedFreqCounter = 0.1;
    for (const [authorPolyKey, authorPolyObj] of Object.entries(polygonObjs[5].objects)) {
        const curPolyArray = authorPolyObj.name.split("|");
        // console.log("CPA: ", curPolyArray);
        if (!bubbleMapObj.polygonLoc[curPolyArray[3]]) {
            bubbleMapObj.polygonLoc[curPolyArray[3]] = {};
        }
        switch (curPolyArray[1]) {
            case "DEFAULTS":
                const curDefaults: any = {
                    sourceBase: curPolyArray[3],
                    enabled: curPolyArray[6],
                    isFreeAirframeBase: curPolyArray[7],
                    defaultStartSide: curPolyArray[5],
                    baseType: curPolyArray[4],
                    heliOnlySupply: curPolyArray[9]
                };
                if (curPolyArray[4] === "MOB") {
                    bubbleMapObj.mainCampaignBases.push(curPolyArray[3]);
                }
                if (curPolyArray[7] === "true") {
                    bubbleMapObj.freeAirframeBases.push(curPolyArray[3]);
                }
                if (curPolyArray[8] === "true") {
                    bubbleMapObj.baseAwacs[curPolyArray[3]] = {
                        frequency: (124 + updatedFreqCounter)
                    };
                    updatedFreqCounter += updatedFreqCounter;
                }

                bubbleMapObj.polygonLoc[curPolyArray[3]].defaults = curDefaults;
                break;
            case "AICAP":
                if (!bubbleMapObj.polygonLoc[curPolyArray[3]].AICapTemplate) {
                    bubbleMapObj.polygonLoc[curPolyArray[3]].AICapTemplate = {
                        sourceBase: curPolyArray[3],
                        units: []
                    };
                }
                bubbleMapObj.polygonLoc[curPolyArray[3]].AICapTemplate.units.push({xy: {x: authorPolyObj.x, y: authorPolyObj.y}});
                break;
            case "POLY":
                switch (curPolyArray[2]) {
                    case "BUILDING":
                        const buildingPolyArray: any = [];
                        for (const [pointKey, pointObj] of Object.entries(authorPolyObj.points)) {
                            // @ts-ignore
                            buildingPolyArray.push({x: authorPolyObj.mapX + pointObj.x, y: authorPolyObj.mapY + pointObj.y});
                        }
                        if (!bubbleMapObj.polygonLoc[curPolyArray[3]].buildingPoly) {
                            bubbleMapObj.polygonLoc[curPolyArray[3]].buildingPoly = {xy: []};
                        }
                        bubbleMapObj.polygonLoc[curPolyArray[3]].buildingPoly.xy.push(buildingPolyArray);
                        break;
                    case "UNIT":
                        const unitPolyArray: any = [];
                        for (const [pointKey, pointObj] of Object.entries(authorPolyObj.points)) {
                            // @ts-ignore
                            unitPolyArray.push({x: authorPolyObj.mapX + pointObj.x, y: authorPolyObj.mapY + pointObj.y});
                        }
                        if (!bubbleMapObj.polygonLoc[curPolyArray[3]].unitPoly) {
                            bubbleMapObj.polygonLoc[curPolyArray[3]].unitPoly = {xy: []};
                        }
                        bubbleMapObj.polygonLoc[curPolyArray[3]].unitPoly.xy.push(unitPolyArray);
                        break;
                    case "LAYER2":
                        const layer2PolyArray: any = [];
                        for (const [pointKey, pointObj] of Object.entries(authorPolyObj.points)) {
                            // @ts-ignore
                            layer2PolyArray.push({x: authorPolyObj.mapX + pointObj.x, y: authorPolyObj.mapY + pointObj.y});
                        }
                        if (!bubbleMapObj.polygonLoc[curPolyArray[3]].layer2Poly) {
                            bubbleMapObj.polygonLoc[curPolyArray[3]].layer2Poly = {xy: []};
                        }
                        bubbleMapObj.polygonLoc[curPolyArray[3]].layer2Poly.xy.push(layer2PolyArray);
                        break;
                }
                break;
        }
    }
    // console.log("BMO: ", bubbleMapObj.polygonLoc);
    return bubbleMapObj;
}

export function getCountrySides(coalitions: any): any {
    const coalitionsArray: any = [[], [], []];
    coalitionsArray[0] = _.map(
        _.filter(
            coalitions.neutrals,
            (cf) => cf < 86),
        (c: number) => ddcsControllers.countryId[c]
    );
    coalitionsArray[1] = _.map(
        _.filter(
            coalitions.red,
            (cf) => cf < 86),
        (c: number) => ddcsControllers.countryId[c]
    );
    coalitionsArray[2] = _.map(
        _.filter(
            coalitions.blue,
            (cf) => cf < 86),
        (c: number) => ddcsControllers.countryId[c]
    );
    return coalitionsArray;
}

export async function importCampaignData(campaignId: string, polygonObjs: any, missionFileObjects: any, bubblePolyObject?: any) {
    console.log("Import Campaign Data for: " + campaignId);
    // console.log(unitPolyObjs);
    // console.log(consoleLogObject(missionFileObjects));
    // console.log(bubblePolyObject);
    let campaignDataDefaults: any;
    const campaignNameArray = campaignId.split("_");
    const mainCampaignId = campaignNameArray[0];
    const campaignBubbleId = campaignNameArray[1];
    const getCurrentCampaign = await ddcsControllers.campaignConfigActionsRead({_id: mainCampaignId});

    if (getCurrentCampaign.length === 0) {
        // defaults should be set in db, but this can be different
        campaignDataDefaults = {
            _id: campaignId,
            theater: missionFileObjects.theatre,
            bubbleMap: {}
        };
    } else {
        campaignDataDefaults = getCurrentCampaign[0];
    }

    if (bubblePolyObject) {
        campaignDataDefaults.bubbleMap[campaignBubbleId] = ddcsControllers.defaultBubbleMapObj(bubblePolyObject, polygonObjs);
    }

    campaignDataDefaults.countrySides = getCountrySides(missionFileObjects.coalitions);

    await ddcsControllers.campaignConfigActionsUpdate(campaignDataDefaults);
    // console.log("CDD: ", campaignDataDefaults);
}

export async function replaceCampaignAirfields() {
    console.log("new campaign, replacing campaign airfields");
    // drop all campaignAirfieldsFromLocal
    await ddcsControllers.campaignAirfieldModelRemoveAll();
    // regenerate new airfields
    await ddcsControllers.regenerateAllCampaignAirfieldsFromAllMapBubbles();
    // reRead airfields into cache
    await ddcsControllers.updateBases();
}

export async function regenerateAllCampaignAirfieldsFromAllMapBubbles() {
    // build map bubble master base object
    const engineCache: typings.IEngineCache = ddcsControllers.getEngineCache();
    const campaignAirfieldObject: any = {};
    for (const [bubbleMapKey, bubbleMapObj] of Object.entries(engineCache.campaign.bubbleMap)) {
        // @ts-ignore
        for (const [campaignAirfieldKey, campaignAirfieldObj] of Object.entries(bubbleMapObj.polygonLoc)) {
            const curAirfieldDictionary = engineCache.airfieldDictionary.find(
                (a: typings.IAirfieldDictionary) => a._id === campaignAirfieldKey);
            if (curAirfieldDictionary) {
                if (campaignAirfieldObject[campaignAirfieldKey]) {
                    campaignAirfieldObject[campaignAirfieldKey].bubbleMapIds.push(bubbleMapKey);
                    await ddcsControllers.campaignAirfieldActionUpdate({
                        _id: campaignAirfieldKey,
                        bubbleMapIds: campaignAirfieldObject[campaignAirfieldKey].bubbleMapIds
                    });
                } else {
                    const lonLatPolygon: any = campaignAirfieldObj;
                    for (const [polygonKey, polygonObj] of Object.entries(campaignAirfieldObj)) {
                        // console.log("cur: ", campaignAirfieldKey, polygonKey, campaignAirfieldObj);
                        switch (polygonKey) {
                            case "unitPoly":
                                console.log("CA: ", bubbleMapKey, campaignAirfieldKey);
                                // @ts-ignore
                                lonLatPolygon.unitPoly = polygonObj.lonLat;
                                break;
                            case "buildingPoly":
                                // @ts-ignore
                                lonLatPolygon.buildingPoly = polygonObj.lonLat;
                                break;
                            case "layer2Poly":
                                // @ts-ignore
                                lonLatPolygon.layer2Poly = polygonObj.lonLat;
                                break;
                        }
                    }

                    if (campaignAirfieldObj && campaignAirfieldObj.defaults && campaignAirfieldObj.defaults.baseType) {
                        campaignAirfieldObject[campaignAirfieldKey] = {
                            _id: campaignAirfieldKey,
                            baseType: campaignAirfieldObj.defaults.baseType,
                            enabled: campaignAirfieldObj.defaults.enabled && curAirfieldDictionary.enabled,
                            defaultStartSide: campaignAirfieldObj.defaults.defaultStartSide,
                            alt: curAirfieldDictionary.alt,
                            baseId: curAirfieldDictionary.baseId,
                            centerLoc: curAirfieldDictionary.centerLoc,
                            hdg: curAirfieldDictionary.hdg,
                            initSide: campaignAirfieldObj.defaults.defaultStartSide,
                            mapType: curAirfieldDictionary.mapType,
                            polygonLoc: campaignAirfieldObj,
                            side: campaignAirfieldObj.defaults.defaultStartSide,
                            bubbleMapIds: [bubbleMapKey]
                        };
                        await ddcsControllers.campaignAirfieldActionUpdate(campaignAirfieldObject[campaignAirfieldKey]);
                    } else {
                        console.log("No Default Poly For Airfield: ", campaignAirfieldKey, " And Poly: ", bubbleMapKey);
                    }
                }
            } else {
                console.log("No airfield dictionary for " + campaignAirfieldKey);
            }
        }
    }
}

export async function replaceStrategicPoints() {
    console.log("new campaign, replacing Strategic Points");
    // drop all strategicPointsFromLocal
    await ddcsControllers.strategicPointModelRemoveAll();
    // regenerate new strategic points
    await ddcsControllers.regenerateAllStrategicPointsFromAllMapBubbles();
}

export async function regenerateAllStrategicPointsFromAllMapBubbles() {
    const engineCache: typings.IEngineCache = ddcsControllers.getEngineCache();
    const campaignStrategicPointObject: any = {};
    for (const [bubbleMapKey, bubbleMapObj] of Object.entries(engineCache.campaign.bubbleMap)) {
        if ( bubbleMapObj && _.keys(bubbleMapObj.strategicPoints).length > 0) {
            for (const [strategicPointKey, strategicPoint] of Object.entries(bubbleMapObj.strategicPoints)) {
                if (campaignStrategicPointObject[strategicPointKey]) {
                    campaignStrategicPointObject[strategicPointKey].bubbleMapIds.push(bubbleMapKey);
                    await ddcsControllers.strategicPointUpdate({
                        _id: strategicPointKey,
                        bubbleMapIds: campaignStrategicPointObject[strategicPointKey].bubbleMapIds
                    });
                } else {
                    campaignStrategicPointObject[strategicPointKey] = {
                        _id: strategicPointKey,
                        details: strategicPoint.details,
                        enabled: true,
                        polygonPointsXY: strategicPoint.polygonPointsXY,
                        polygonPoints: strategicPoint.polygonPoints,
                        mapType: strategicPoint.mapType,
                        strategicType: strategicPoint.strategicType,
                        bubbleMapIds: [bubbleMapKey]
                    };
                    await ddcsControllers.strategicPointUpdate(campaignStrategicPointObject[strategicPointKey]);
                }
            }
        }
    }
}

export async function processYxToLonLat(
    incomingObj: any,
    reqId: any,
    reqArgs: any
) {
    console.log("processYxBack1: ", reqArgs.campaignAirfieldKey);
    const curLonLatPoly = await ddcsControllers.campaignConfigActionsRead({_id: ddcsControllers.getEngineCache().config.currentCampaignId});
    if (curLonLatPoly.length > 0) {
        // @ts-ignore
        const polyPath = curLonLatPoly[0].bubbleMap[_.toNumber(reqArgs.bubbleMapKey)].
            polygonLoc[reqArgs.campaignAirfieldKey][reqArgs.polyName];
        // @ts-ignore
        if (!polyPath.lonLat || !Array.isArray(polyPath.lonLat) || polyPath.lonLat.length === 0) {
            polyPath.lonLat = [];
        }
        polyPath.lonLat.push(incomingObj.returnObj);
        // console.log("PA: ", polyPath);
        const curPayloadObj = {
            _id: curLonLatPoly[0]._id,
            ["bubbleMap." + _.toNumber(reqArgs.bubbleMapKey) + ".polygonLoc." +
            reqArgs.campaignAirfieldKey + "." + reqArgs.polyName + ".lonLat"]: polyPath.lonLat
        };
        // console.log("PP: ", polyPath.lonLat);
        await ddcsControllers.campaignConfigActionsUpdate(curPayloadObj);
    }
}

export async function sendXyForLonLat(campaignAirfieldObj: any, polyName: string, bubbleMapKey: string, campaignAirfieldKey: string) {
    for (const [arrayGroupKey, arrayGroups] of Object.entries(campaignAirfieldObj[polyName].xy)) {
        console.log("getLonLat1: ", campaignAirfieldKey);
        const curNextUniqueId = ddcsControllers.getNextUniqueId();
        ddcsControllers.setRequestJobArray({
            reqId: curNextUniqueId,
            callBack: "processYxToLonLat",
            reqArgs: {
                polyName,
                bubbleMapKey,
                campaignAirfieldKey,
                arrayGroupKey
            }
        }, curNextUniqueId);
        await ddcsControllers.sendUDPPacket("frontEnd", {
            actionObj: {
                action: "convertYXArrayToLonLat",
                xyArray: arrayGroups,
                reqArgs: {
                    polyName,
                    bubbleMapKey,
                    campaignAirfieldKey,
                    arrayGroupKey
                },
                reqID: curNextUniqueId,
                time: new Date()
            }
        });
    }
}

export async function processYxToLonLatStrategicPoints(
    incomingObj: any,
    reqId: any,
    reqArgs: any
) {
    // console.log("processYxBack2: ", reqArgs);
    const curLonLatPoly = await ddcsControllers.campaignConfigActionsRead(
        {_id: ddcsControllers.getEngineCache().config.currentCampaignId}
    );
    if (curLonLatPoly.length > 0) {
        // @ts-ignore
        const polyPath = curLonLatPoly[0].bubbleMap[_.toNumber(reqArgs.bubbleMapKey)].strategicPoints[reqArgs.strategicPointKey];
        // @ts-ignore
        if (!polyPath.polygonPoints || !Array.isArray(polyPath.polygonPoints) || polyPath.polygonPoints.length === 0) {
            polyPath.polygonPoints = [];
        }
        polyPath.polygonPoints.push(incomingObj.returnObj);
        const curPayloadObj = {
            _id: curLonLatPoly[0]._id,
            ["bubbleMap." + _.toNumber(reqArgs.bubbleMapKey) + ".strategicPoints." +
            reqArgs.strategicPointKey + ".polygonPoints"]: polyPath.polygonPoints
        };
        await ddcsControllers.campaignConfigActionsUpdate(curPayloadObj);
    }
}

export async function updateYxToLonLat() {
    let currentTimer = 0;
    const waitTimeImport = 3000;
    const engineCache: typings.IEngineCache = ddcsControllers.getEngineCache();
    for (const [bubbleMapKey, bubbleMapObj] of Object.entries(engineCache.campaign.bubbleMap)) {
        setTimeout(async () => {
            console.log("Import Bubble Map: ", bubbleMapKey);
            await getLonlatForBubbleMap(bubbleMapObj.bubbleInformation, _.toNumber(bubbleMapKey));
        }, currentTimer);
        currentTimer += waitTimeImport;
        // base polygons
        for (const [campaignAirfieldKey, campaignAirfieldObj] of Object.entries(bubbleMapObj.polygonLoc)) {
            // unitPoly
            if (campaignAirfieldObj.unitPoly && campaignAirfieldObj.unitPoly.xy && campaignAirfieldObj.unitPoly.xy.length > 0) {
                await ddcsControllers.campaignConfigActionsUpdate({
                    _id: engineCache.campaign._id,
                    ["bubbleMap." + _.toNumber(bubbleMapKey) + ".polygonLoc." +
                    campaignAirfieldKey + ".unitPoly.lonLat"]: []
                });
                setTimeout(async () => {
                    await ddcsControllers.sendXyForLonLat(
                        campaignAirfieldObj,
                        "unitPoly",
                        bubbleMapKey,
                        campaignAirfieldKey
                    );
                }, currentTimer);
                currentTimer += waitTimeImport;
            }
            // buildingPoly
            if (campaignAirfieldObj.buildingPoly && campaignAirfieldObj.buildingPoly.xy && campaignAirfieldObj.buildingPoly.xy.length > 0) {
                await ddcsControllers.campaignConfigActionsUpdate({
                    _id: engineCache.campaign._id,
                    ["bubbleMap." + _.toNumber(bubbleMapKey) + ".polygonLoc." +
                    campaignAirfieldKey + ".buildingPoly.lonLat"]: []
                });
                setTimeout(async () => {
                    await ddcsControllers.sendXyForLonLat(
                        campaignAirfieldObj,
                        "buildingPoly",
                        bubbleMapKey,
                        campaignAirfieldKey
                    );
                }, currentTimer);
                currentTimer += waitTimeImport;
            }
            // layer2Poly
            if (campaignAirfieldObj.layer2Poly && campaignAirfieldObj.layer2Poly.xy && campaignAirfieldObj.layer2Poly.xy.length > 0) {
                await ddcsControllers.campaignConfigActionsUpdate({
                    _id: engineCache.campaign._id,
                    ["bubbleMap." + _.toNumber(bubbleMapKey) + ".polygonLoc." +
                    campaignAirfieldKey + ".layer2Poly.lonLat"]: []
                });
                setTimeout(async () => {
                    await ddcsControllers.sendXyForLonLat(
                        campaignAirfieldObj,
                        "layer2Poly",
                        bubbleMapKey,
                        campaignAirfieldKey
                    );
                }, currentTimer);
                currentTimer += waitTimeImport;
            }
        }
        // strategic point polygons
        if (bubbleMapObj.strategicPoints && Object.entries(bubbleMapObj.strategicPoints).length > 0) {
            for (const [strategicPointKey, strategicPointObj] of Object.entries(bubbleMapObj.strategicPoints)) {
                // strategicPointPoly
                if (strategicPointObj.polygonPointsXY && Object.entries(strategicPointObj.polygonPointsXY).length > 0) {
                    await ddcsControllers.campaignConfigActionsUpdate({
                        _id: engineCache.campaign._id,
                        ["bubbleMap." + _.toNumber(bubbleMapKey) + ".strategicPoints." +
                        strategicPointKey + ".polygonPoints"]: []
                    });
                    for (const [arrayGroupKey, arrayGroup] of Object.entries(strategicPointObj.polygonPointsXY)) {
                        setTimeout(async () => {
                            console.log("processing getLonlat2: ", strategicPointKey);
                            const curNextUniqueId = ddcsControllers.getNextUniqueId();
                            ddcsControllers.setRequestJobArray({
                                reqId: curNextUniqueId,
                                callBack: "processYxToLonLatStrategicPoints",
                                reqArgs: {
                                    bubbleMapKey,
                                    strategicPointKey,
                                    arrayGroupKey
                                }
                            }, curNextUniqueId);
                            await ddcsControllers.sendUDPPacket("frontEnd", {
                                actionObj: {
                                    action: "convertYXArrayToLonLat",
                                    xyArray: arrayGroup,
                                    reqArgs: {
                                        bubbleMapKey,
                                        strategicPointKey,
                                        arrayGroupKey
                                    },
                                    reqID: curNextUniqueId,
                                    time: new Date()
                                }
                            });
                        }, currentTimer);
                        currentTimer += waitTimeImport;
                    }
                }
            }
        }
    }
    setTimeout(async () => {
        console.log("Finished Importing Polys");
    }, currentTimer);
}

export function setUpDefaultMissionFile(curMainMissionFile: any, unitsByCountry: any, polygonObjs: any, bullsEyeObj: any) {
    const curDate = new Date();
    return {
        mission: {
            trig: curMainMissionFile.trig,
            requiredModules: curMainMissionFile.requiredModules,
            date: {
                Year: _.toNumber(curDate.getFullYear()),
                Day: _.toNumber(curDate.getDate()),
                Month: _.toNumber(curDate.getMonth() + 1)
            },
            result: {
                offline: {conditions: {}, actions: {}, func: {}},
                total: 0,
                blue: {conditions: {}, actions: {}, func: {}},
                red: {conditions: {}, actions: {}, func: {}}
            },
            groundControl: {
                isPilotControlVehicles: false,
                roles: curMainMissionFile.groundControl.roles
            },
            maxDictId: curMainMissionFile.maxDictId,
            pictureFileNameN: curMainMissionFile.pictureFileNameN,
            drawings: {
                options: {
                    hiddenOnF10Map: {
                        Observer: {Neutral: false, Blue: false, Red: false},
                        Instructor: {Neutral: false, Blue: false, Red: false},
                        ForwardObserver: {Neutral: false, Blue: false, Red: false},
                        Spectrator: {Neutral: false, Blue: false, Red: false},
                        ArtilleryCommander: {Neutral: false, Blue: false, Red: false},
                        Pilot: {Neutral: false, Blue: false, Red: false}
                    }
                },
                layers: polygonObjs
            },
            goals: {},
            weather: curMainMissionFile.weather,
            theatre: curMainMissionFile.theatre,
            triggers: {zones: {}},
            map: curMainMissionFile.map,
            coalitions: {
                blue: curMainMissionFile.coalitions.blue,
                neutrals: curMainMissionFile.coalitions.neutrals,
                red: curMainMissionFile.coalitions.red
            },
            descriptionText: curMainMissionFile.descriptionText,
            pictureFileNameR: curMainMissionFile.pictureFileNameR,
            descriptionBlueTask: curMainMissionFile.descriptionBlueTask,
            descriptionRedTask: curMainMissionFile.descriptionRedTask,
            descriptionNeutralsTask: curMainMissionFile.descriptionNeutralsTask,
            pictureFileNameB: curMainMissionFile.pictureFileNameB,
            coalition: {
                neutrals: {
                    bullseye: {y: bullsEyeObj.mapY, x: bullsEyeObj.mapX },
                    nav_points: {},
                    name: "neutrals",
                    country: unitsByCountry.neutrals.country
                },
                blue: {
                    bullseye: {y: bullsEyeObj.mapY, x: bullsEyeObj.mapX },
                    nav_points: {},
                    name: "blue",
                    country: unitsByCountry.blue.country
                },
                red: {
                    bullseye: {y: bullsEyeObj.mapY, x: bullsEyeObj.mapX },
                    nav_points: {},
                    name: "red",
                    country: unitsByCountry.red.country
                }
            },
            sortie: curMainMissionFile.sortie,
            version: curMainMissionFile.version,
            trigrules: curMainMissionFile.trigrules,
            currentKey: curMainMissionFile.currentKey,
            start_time: curMainMissionFile.start_time,
            forcedOptions: {
                padlock: false,
                easyRadar: false,
                miniHUD: false,
                accidental_failures: false,
                optionsView: "optview_myaircraft",
                permitCrash: false,
                immortal: false,
                cockpitStatusBarAllowed: false,
                cockpitVisualRM: true,
                easyFlight: false,
                labels: false,
                radio: false,
                wakeTurbulence: false,
                easyCommunication: false,
                fuel: false,
                controlsIndicator: false,
                tips: true,
                userMarks: true,
                RBDAI: false,
                externalViews: false,
                unrestrictedSATNAV: true,
                civTraffic: "",
                weapons: false,
                birds: 0,
                geffect: "realistic"
            },
            failures: curMainMissionFile.failures
        }
    };
}
