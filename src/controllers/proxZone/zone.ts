/*
 * DDCS Licensed under AGPL-3.0 by Andrew "Drex" Finegan https://github.com/afinegan/DynamicDCS
 */

import * as _ from "lodash";
import * as ddcsControllers from "../";

// Calculate a new coordinate based on start, distance and bearing
export function mathFmod(a: number, b: number ): number {
    return Number((a - (Math.floor(a / b) * b)).toPrecision(8));
}

function geo_destination(lonLat: number[], dist: number, brng: number): number[] {
    const lon1 = toRad(lonLat[0]);
    const lat1 = toRad(lonLat[1]);
    dist = dist / 6371.01; // Earth's radius in km
    brng = toRad(brng);

    const lat2 = Math.asin( Math.sin(lat1) * Math.cos(dist) +
        Math.cos(lat1) * Math.sin(dist) * Math.cos(brng) );
    let lon2: number = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1),
            Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2)) as number;
    lon2 = mathFmod((lon2 + 3 * Math.PI), (2 * Math.PI)) - Math.PI;

    return [toDeg(lon2), toDeg(lat2)];
}
function toRad(deg: number): number {
    return deg * Math.PI / 180;
}
function toDeg(rad: number): number {
    return rad * 180 / Math.PI;
}

export function pad(num: number, size: number) {
    const s = "000000000" + num;
    return s.substr(s.length - size);
}

export function findBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const startLat = toRad(lat1);
    const startLng  = toRad(lng1);
    const destLat  = toRad(lat2);
    const destLng  = toRad(lng2);

    const y = Math.sin(destLng - startLng) * Math.cos(destLat);
    const x = Math.cos(startLat) * Math.sin(destLat) -
        Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    let brng = Math.atan2(y, x);
    brng = toDeg(brng);
    return (brng + 360) % 360;
}

export function calcDirectDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const latRad1 = toRad(lat1);
    const latRad2 = toRad(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(latRad1) * Math.cos(latRad2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
}

export function toDegreesMinutesAndSeconds(coordinate: number) {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    return degrees + " " + minutes + " " + seconds;
}

export function convertDMS(lat: number, lng: number) {
    const latitude = toDegreesMinutesAndSeconds(lat);
    const latitudeCardinal = lat >= 0 ? "N" : "S";

    const longitude = toDegreesMinutesAndSeconds(lng);
    const longitudeCardinal = lng >= 0 ? "E" : "W";

    return latitude + " " + latitudeCardinal + "    " + longitude + " " + longitudeCardinal;
}

export function getLonLatFromDistanceDirection(lonLatLoc: number[], direction: number, curDistance: number): number[] {
    return geo_destination(lonLatLoc, curDistance, direction);
}

export function getBoundingSquare(pArray: number[]): object {
    if (pArray && pArray.length > 0) {
        let x1 = _.get(pArray, [0, 0]);
        let y1 = _.get(pArray, [0, 1]);
        let x2 = _.get(pArray, [0, 0]);
        let y2 = _.get(pArray, [0, 1]);
        for (let i = 1; i < pArray.length; i++) {
            x1 = ( x1 > _.get(pArray, [i, 0])) ? _.get(pArray, [i, 0]) : x1;
            x2 = ( x2 < _.get(pArray, [i, 0])) ? _.get(pArray, [i, 0]) : x2;
            y1 = ( y1 > _.get(pArray, [i, 1])) ? _.get(pArray, [i, 1]) : y1;
            y2 = ( y2 < _.get(pArray, [i, 1]) ) ? _.get(pArray, [i, 1]) : y2;
        }
        return {
            x1,
            y1,
            x2,
            y2
        };
    } else {
        return {};
    }
}

export function isLatLonInZone(lonLat: number[], polyZone: any[]) {

    let next;
    let prev;
    let inPolygon = false;

    if (polyZone && polyZone.length > 0) {
        const pNum = polyZone.length - 1;

        next = 1;
        prev = pNum;

        while (next <= pNum) {
            if ((( polyZone[next][1] > lonLat[1] ) !== ( polyZone[prev][1] > lonLat[1] )) &&
                ( lonLat[0] < ( polyZone[prev][0] - polyZone[next][0] ) * ( lonLat[1] - polyZone[next][1] ) /
                    ( polyZone[prev][1] - polyZone[next][1] ) + polyZone[next][0] )) {
                inPolygon = ! inPolygon;
            }
            prev = next;
            next = next + 1;
        }
    } else {
        // console.log("Polyzone is:", polyZone);
    }
    return inPolygon;
}

export function getRandomLatLonFromBase(baseName: string, polytype: string, zoneNum?: string): number[] {
    console.log("Polytype: ", baseName, polytype);
    const engineCache = ddcsControllers.getEngineCache();
    const baseInfo: any = _.find(engineCache.bases, {_id: baseName});
    // console.log("base: ", baseInfo, baseName);
    if (baseInfo) {
        _.get(baseInfo, ["polygonLoc", polytype]);
        const pGroups = baseInfo.polygonLoc[polytype];
        let pickedPoly;
        if (zoneNum) {
            pickedPoly = pGroups[zoneNum];
            if (pickedPoly === undefined) {
                pickedPoly = _.sample(pGroups);
            }
        } else {
            pickedPoly = _.sample(pGroups);
        }
        if (!pickedPoly) {
            console.log("PickedPoly is null");
        } else {
            let lonLatFound = false;
            const bs = exports.getBoundingSquare(pickedPoly);
            while (!lonLatFound) {
                const lonLat = [
                    _.random(bs.x1, bs.x2),
                    _.random(bs.y1, bs.y2)
                ];
                if (exports.isLatLonInZone(lonLat, pickedPoly)) {
                    lonLatFound = true;
                    return lonLat;
                }
            }
        }
    }
    return [];
}

export function getRandomLatLonFromPoly(polyArray: []): number[] {
    // console.log("Polytype: ", polyArray);
    const pickedPoly = polyArray;
    let lonLatFound = false;
    const bs = exports.getBoundingSquare(pickedPoly);
    while (!lonLatFound) {
        const lonLat = [
            _.random(bs.x1, bs.x2),
            _.random(bs.y1, bs.y2)
        ];
        if (exports.isLatLonInZone(lonLat, pickedPoly)) {
            lonLatFound = true;
            return lonLat;
        }
    }
    return [];
}

export function getOppositeHeading(heading: number) {
    return (heading + 180) % 360;
}

export function getCenterOfPoly(polyArray: []) {
    const l = polyArray.length;
    const xMedian = polyArray.reduce(
        (previous: number, current: number[]): number => previous + current[1], 0) / polyArray.length;
    const yMedian = polyArray.reduce(
        (previous: number, current: number[]): number => previous + current[0], 0) / polyArray.length;
    return [yMedian, xMedian];
}

export function distance(p1: number[], p2: number[]) {
    return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}

export function triangleArea(d1: number, d2: number, d3: number) {
    // See https://en.wikipedia.org/wiki/Heron's_formula
    const s = (d1 + d2 + d3) / 2;
    return Math.sqrt(s * (s - d1) * (s - d2) * (s - d3));
}

export function rotatePoint(point: number[], rotationCenterPoint: number[], degrees: number) {

    const radians = degrees * Math.PI / 180;
    point[0] -= rotationCenterPoint[0];
    point[1] -= rotationCenterPoint[1];

    const newPoint = [];
    newPoint[0] = point[0] * Math.cos(radians) - point[1] * Math.sin(radians);
    newPoint[1] = point[0] * Math.sin(radians) + point[1] * Math.cos(radians);

    newPoint[0] += rotationCenterPoint[0];
    newPoint[1] += rotationCenterPoint[1];

    return newPoint;
}

export function findRectVertices(position: number[], size: number[], degrees: number) {
    const left = position[0];
    const right = position[0] + size[0];
    const top = position[1] + size[1];
    const bottom = position[1];

    const center = [position[0] + (size[0] / 2), position[1] + (size[1] / 2)];

    const LT = [left, top];
    const RT = [right, top];
    const RB = [right, bottom];
    const LB = [left, bottom];

    return {
        LT: rotatePoint(LT, center, degrees),
        RT: rotatePoint(RT, center, degrees),
        RB: rotatePoint(RB, center, degrees),
        LB: rotatePoint(LB, center, degrees)
    };
}

export function isUnitInsidePolygonXY(unitObj: any, polygonObj: any) {
    if (!unitObj.x) {
        unitObj.x = unitObj.mapX;
    }
    if (!unitObj.y) {
        unitObj.y = unitObj.mapY;
    }

    const position = [(polygonObj.mapX - (polygonObj.height / 2)), (polygonObj.mapY - (polygonObj.width / 2))];
    const size = [polygonObj.height, polygonObj.width];
    const degrees = polygonObj.angle;
    return ddcsControllers.checkPointInsideByArea(unitObj, position, size, degrees);
}

export function isUnitInsidePolygonLonLat(unitObj: any, polygonObj: any) {
    polygonObj.push([polygonObj[0][0], polygonObj[0][1]]);
    return ddcsControllers.isLatLonInZone(unitObj.lonLatLoc, polygonObj);
}

export function checkPointInsideByArea(unitObj: any, position: any, size: any, degrees: number) {
    // console.log(position, size, degrees);
    const rectArea = Math.round(size[0] * size[1]);
    const vertices = findRectVertices(position, size, degrees);
    let unit: number[] = [];
    unit = [unitObj.x, unitObj.y];
    // console.log(unitObj._id, unit, rectArea);
    const triAreaArray = [
        // unit, LT, RT
        triangleArea(
            distance(unit, vertices.LT),
            distance(vertices.LT, vertices.RT),
            distance(vertices.RT, unit)
        ),
        // unit, RT, RB
        triangleArea(
            distance(unit, vertices.RT),
            distance(vertices.RT, vertices.RB),
            distance(vertices.RB, unit)
        ),
        // unit, RB, LB
        triangleArea(
            distance(unit, vertices.RB),
            distance(vertices.RB, vertices.LB),
            distance(vertices.LB, unit)
        ),
        // unit, LB, LT
        triangleArea(
            distance(unit, vertices.LB),
            distance(vertices.LB, vertices.LT),
            distance(vertices.LT, unit)
        )
    ];

    const triArea = Math.round(triAreaArray.reduce((a, b) => a + b, 0));
    /*
    if (triArea <= rectArea) {
        console.log("ID is included: ", unitObj._id, " tri: ", triArea, " rect: ", rectArea);
    }
     */
    return triArea <= rectArea;
}
