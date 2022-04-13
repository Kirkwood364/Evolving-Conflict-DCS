function tprint(tbl, indent)
	if not indent then indent = 0 end
	for k, v in pairs(tbl) do
		formatting = string.rep("  ", indent) .. k .. ": "
		if type(v) == "table" then
			env.info(formatting)
			tprint(v, indent + 1)
		elseif type(v) == 'boolean' then
			env.info(formatting .. tostring(v))
		else
			env.info(formatting .. tostring(v))
		end
	end
end
function string:split(inSplitPattern, outResults)
	if not outResults then
		outResults = {}
	end
	local theStart = 1
	local theSplitStart, theSplitEnd = string.find(self, inSplitPattern, theStart)
	while theSplitStart do
		table.insert(outResults, string.sub(self, theStart, theSplitStart - 1))
		theStart = theSplitEnd + 1
		theSplitStart, theSplitEnd = string.find(self, inSplitPattern, theStart)
	end
	table.insert(outResults, string.sub(self, theStart))
	return outResults
end
function has_value (tab, val)
	for index, value in ipairs(tab) do
		if value == val then
			return true
		end
	end
	return false
end
local ddcsHost = "localhost"
local ddcsPort = 3001
local missionRuntimeHost = "localhost"
local missionRuntimePort = 3002
local DATA_TIMEOUT_SEC = 0.1
local supportedPolyModes = {
	'circle',
	'rect',
	'free'
}

package.path = package.path .. ";.\\LuaSocket\\?.lua"
package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"

local socket = require("socket")
local JSON = loadfile("Scripts\\JSON.lua")()

local udpClient = socket.udp()
assert(udpClient:setpeername(socket.dns.toip(ddcsHost),ddcsPort))

local udpMissionRuntime = socket.udp()
assert(udpMissionRuntime:settimeout(0))
assert(udpMissionRuntime:setsockname(socket.dns.toip(missionRuntimeHost), missionRuntimePort))

--|POLY|STRATEGICPOINT|MINE|SENAKI MINE|Workshop A|AS32-36A|3|6|250|1|
function convertTypePoly (polyDetails, polyType)
	local polyArray = {}
	if polyType == 'circle' then
		local lat, lon, alt = coord.LOtoLL({x = polyDetails.mapX, y = 0, z = polyDetails.mapY})
		table.insert(polyArray, {
			[1] = lon,
			[2] = lat,
			[3] = polyDetails.radius
		})
	end
	if polyType == 'rect' then
		--only rect supported is a 0 angle rect
		local lat1, lon1, alt1 = coord.LOtoLL({x = polyDetails.mapX, y = 0, z = polyDetails.mapY})
		table.insert(polyArray, {lon1, lat1})
		local lat2, lon2, alt2 = coord.LOtoLL({x = polyDetails.mapX + polyDetails.width, y = 0, z = polyDetails.mapY})
		table.insert(polyArray, {lon2, lat2})
		local lat3, lon3, alt3 = coord.LOtoLL({x = polyDetails.mapX + polyDetails.width, y = 0, z = polyDetails.mapY + polyDetails.height})
		table.insert(polyArray, {lon3, lat3})
		local lat4, lon4, alt4 = coord.LOtoLL({x = polyDetails.mapX, y = 0, z = polyDetails.mapY + polyDetails.height})
		table.insert(polyArray, {lon4, lat4})
	end
	if polyType == 'free' then
		for pIndex = 1, #polyDetails.points do
			local lat, lon, alt = coord.LOtoLL({x = polyDetails.mapX + polyDetails.points[pIndex].x, y = 0, z = polyDetails.mapY + polyDetails.points[pIndex].y})
			table.insert(polyArray, {
				[1] = lon,
				[2] = lat,
			})
		end
	end
	return polyArray
end


local function getAllStrategicPointsFromDrawings ()
	local strategicPointArray = {}
	if env.mission.drawings.layers then
		for layer,layerTable in pairs(env.mission.drawings.layers) do
			if layerTable and layerTable.name == "Common" then
				for layerObj,layerObjValues in pairs(layerTable.objects) do
					if layerObjValues.polygonMode == 'rect' and layerObjValues.angle ~= 0 then
						env.info("rect doesnt support polys with a different angle than 0")
					end
					if has_value(supportedPolyModes, layerObjValues.polygonMode) and layerObjValues.visible then
						local nArry = layerObjValues.name:split("|")
						if strategicPointArray[nArry[5]] == nil then
							strategicPointArray[nArry[5]] = {}
						end
						if strategicPointArray[nArry[5]].details == nil then
							strategicPointArray[nArry[5]].details = {}
						end
						if strategicPointArray[nArry[5]].polygonPoints == nil then
							strategicPointArray[nArry[5]].polygonPoints = {}
						end
						strategicPointArray[nArry[5]].strategicType = nArry[4]
						strategicPointArray[nArry[5]]._id = nArry[5]
						strategicPointArray[nArry[5]].mapType = env.mission.theatre
						strategicPointArray[nArry[5]].details = {}
						strategicPointArray[nArry[5]].details.crateCost = tonumber(nArry[6])
						strategicPointArray[nArry[5]].details.spawnBuildingAmount = tonumber(nArry[7])
						strategicPointArray[nArry[5]].details.strategicPointOptions = nArry[8]
						table.insert(strategicPointArray[nArry[5]].polygonPoints, convertTypePoly(layerObjValues, layerObjValues.polygonMode))
					end
				end
			end
		end
		return strategicPointArray
	end
end

local function getAllStrategicPointsFromUnits ()
	local strategicPointArray = {}
	if env.mission.coalition then
		for coa,coaTable in pairs(env.mission.coalition) do
			if type(coaTable) == 'table' and coaTable.country and coa == 'blue' then
				for i=1,#coaTable.country do
					local country = coaTable.country[i]
					for uType,uTable in pairs(country) do
						env.info('TYPE: ' .. uType)
						if uType == 'plane' or uType == 'helicopter' or uType == 'vehicle' then
							if type(uTable)=='table' and uTable.group then
								for j=1,#uTable.group do
									local group = uTable.group[j]
									local gName = env.getValueDictByKey(group.name)
									if gName and group.route.points and string.find(gName, '|POLY|STRATEGICPOINT|', 1, true) then
										local nArry = gName:split("|")
										if strategicPointArray[nArry[5]] == nil then
											strategicPointArray[nArry[5]] = {}
										end
										if strategicPointArray[nArry[5]].details == nil then
											strategicPointArray[nArry[5]].details = {}
										end
										if strategicPointArray[nArry[5]].polygonPoints == nil then
											strategicPointArray[nArry[5]].polygonPoints = {}
										end
										strategicPointArray[nArry[5]].strategicType = nArry[4]
										strategicPointArray[nArry[5]]._id = nArry[5]
										strategicPointArray[nArry[5]].mapType = env.mission.theatre
										strategicPointArray[nArry[5]].details = {}
										strategicPointArray[nArry[5]].details.mainBuildingType = nArry[6]
										strategicPointArray[nArry[5]].details.constructionBuildingType = nArry[7]
										strategicPointArray[nArry[5]].details.crateCost = tonumber(nArry[8])
										strategicPointArray[nArry[5]].details.spawnBuildingAmount = tonumber(nArry[9])
										strategicPointArray[nArry[5]].details.warbondProduction = tonumber(nArry[10])
										local curRoutePoints = {}
										for pIndex = 1, #group.route.points do
											local lat, lon, alt = coord.LOtoLL({x = group.route.points[pIndex].x, y = 0, z = group.route.points[pIndex].y})
											table.insert(curRoutePoints, {
												[1] = lon,
												[2] = lat
											})
										end
										table.insert(strategicPointArray[nArry[5]].polygonPoints, curRoutePoints)
									end
								end
							end
						end
					end
				end
			end
		end
		return strategicPointArray
	end
end

local function getAllDefzone ()
	local polyBaseArray = {}
	if env.mission.coalition then
		for coa,coaTable in pairs(env.mission.coalition) do
			if type(coaTable) == 'table' and coaTable.country and coa == 'blue' then
				for i=1,#coaTable.country do
					local country = coaTable.country[i]
					for uType,uTable in pairs(country) do
						env.info('TYPE: ' .. uType)
						if uType == 'plane' or uType == 'helicopter' or uType == 'vehicle' then
							if type(uTable)=='table' and uTable.group then
								for j=1,#uTable.group do
									local group = uTable.group[j]
									local gName = env.getValueDictByKey(group.name)
									if gName and group.route.points and string.find(gName, '|POLY|UNIT|', 1, true) then
										local nArry = gName:split("|")
										if polyBaseArray[nArry[4]] == nil then
											polyBaseArray[nArry[4]] = {}
										end
										if polyBaseArray[nArry[4]].unitPoly == nil then
											polyBaseArray[nArry[4]].unitPoly = {}
										end
										local curRoutePoints = {}
										for pIndex = 1, #group.route.points do
											local lat, lon, alt = coord.LOtoLL({x = group.route.points[pIndex].x, y = 0, z = group.route.points[pIndex].y})
											table.insert(curRoutePoints, {
												[1] = lon,
												[2] = lat
											})
										end
										table.insert(polyBaseArray[nArry[4]].unitPoly, curRoutePoints)
									end
									if gName and group.route.points and string.find(gName, '|POLY|BUILDING|', 1, true) then
										local nArry = gName:split("|")
										if polyBaseArray[nArry[4]] == nil then
											polyBaseArray[nArry[4]] = {}
										end
										if polyBaseArray[nArry[4]].buildingPoly == nil then
											polyBaseArray[nArry[4]].buildingPoly = {}
										end
										local curRoutePoints = {}
										for pIndex = 1, #group.route.points do
											local lat, lon, alt = coord.LOtoLL({x = group.route.points[pIndex].x, y = 0, z = group.route.points[pIndex].y})
											table.insert(curRoutePoints, {
												[1] = lon,
												[2] = lat
											})
										end
										table.insert(polyBaseArray[nArry[4]].buildingPoly, curRoutePoints)
									end
									if gName and group.route.points and string.find(gName, '|POLY|LAYER2|', 1, true) then
										local nArry = gName:split("|")
										if polyBaseArray[nArry[4]] == nil then
											polyBaseArray[nArry[4]] = {}
										end
										if polyBaseArray[nArry[4]].layer2Poly == nil then
											polyBaseArray[nArry[4]].layer2Poly = {}
										end
										local curRoutePoints = {}
										for pIndex = 1, #group.route.points do
											local lat, lon, alt = coord.LOtoLL({x = group.route.points[pIndex].x, y = 0, z = group.route.points[pIndex].y})
											table.insert(curRoutePoints, {
												[1] = lon,
												[2] = lat
											})
										end
										table.insert(polyBaseArray[nArry[4]].layer2Poly, curRoutePoints)
									end
									if gName and group.route.points and string.find(gName, '|CONVOY|', 1, true) then
										local nArry = gName:split("|")
										local sourceName = nArry[3]
										local destName = nArry[4]

										if polyBaseArray[sourceName] == nil then
											polyBaseArray[sourceName] = {}
										end
										if polyBaseArray[sourceName].convoyTemplate == nil then
											polyBaseArray[sourceName].convoyTemplate = {}
										end
										if polyBaseArray[sourceName].convoyTemplate[destName] == nil then
											polyBaseArray[sourceName].convoyTemplate[destName] = {
												["sourceBase"] = sourceName,
												["destBase"] = destName,
												["route"] = {}
											}
										end
										for pIndex = 1, #group.route.points do
											local lat, lon, alt = coord.LOtoLL({x = group.route.points[pIndex].x, y = 0, z = group.route.points[pIndex].y})
											table.insert(polyBaseArray[sourceName].convoyTemplate[destName].route, {
												["lonLat"] = {
													[1] = lon,
													[2] = lat
												},
												["action"] = group.route.points[pIndex].action
											})
										end
									end
									if gName and group.units and string.find(gName, '|AICAP|', 1, true) then
										local nArry = gName:split("|")
										local sourceName = nArry[3]
										if polyBaseArray[sourceName] == nil then
											polyBaseArray[sourceName] = {}
										end
										if polyBaseArray[sourceName].AICapTemplate == nil then
											polyBaseArray[sourceName].AICapTemplate = {
												["sourceBase"] = sourceName,
												["units"] = {}
											}
										end
										for pIndex = 1, #group.units do
											local lat, lon, alt = coord.LOtoLL({x = group.units[pIndex].x, y = 0, z = group.units[pIndex].y})
											table.insert(polyBaseArray[sourceName].AICapTemplate.units,{
												["lonLat"] = {
													[1] = lon,
													[2] = lat
												},
												["type"] = group.units[pIndex].type,
												["parking"] = group.units[pIndex].parking,
												["parking_id"] = group.units[pIndex].parking_id,
											})
										end
									end
									if gName and group.units and string.find(gName, '|DEFAULTS|', 1, true) then
										local nArry = gName:split("|")
										local sourceName = nArry[3]
										if polyBaseArray[sourceName] == nil then
											polyBaseArray[sourceName] = {}
										end
										if polyBaseArray[sourceName].defaults == nil then
											polyBaseArray[sourceName].defaults = {
												["sourceBase"] = sourceName,
												["baseType"] = nArry[4],
												["defaultStartSide"] = nArry[5],
												["enabled"] = nArry[6]
											}
										end
									end
								end
							end
						end
					end
				end
			end
		end
	end
	return polyBaseArray
end

local polyArray = getAllDefzone()
--local strategicPointArray = getAllStrategicPointsFromUnits()
local strategicPointArray = getAllStrategicPointsFromDrawings()
--tprint(polyArray, 1);
--tprint(strategicPointArray, 1);
local function updateAirbases(airbases, coalition)
	for airbaseIndex = 1, #airbases do
		local baseId = tonumber(airbases[airbaseIndex]:getID())
		local unitPosition = airbases[airbaseIndex]:getPosition()
		local lat, lon, alt = coord.LOtoLL(unitPosition.p)
		local unitXYZNorthCorr = coord.LLtoLO(lat + 1, lon)
		local headingNorthCorr = math.atan2(unitXYZNorthCorr.z - unitPosition.p.z, unitXYZNorthCorr.x - unitPosition.p.x)
		local heading = math.atan2(unitPosition.x.z, unitPosition.x.x) + headingNorthCorr
		if heading < 0 then
			heading = heading + 2 * math.pi
		end
		local hdg = math.floor(heading / math.pi * 180);
		local baseName = airbases[airbaseIndex]:getName()
		env.info('BASENAME: '..baseName..' : '..baseId..' : '..lat..' : '..lon..' : '..hdg)
		local curObj = {
			["_id"] = baseName,
			["baseId"] = baseId,
			["name"] = baseName,
			["hdg"] = hdg,
			["side"] = 0,
			["initSide"] = coalition,
			["centerLoc"] = {
				lon,
				lat
			},
			["polygonLoc"] = {},
			["alt"] = alt,
			["enabled"] = false,
			["mapType"] = env.mission.theatre
		}
		if polyArray[baseName] ~= nil then
			local curPoly = polyArray[baseName]
			curObj["polygonLoc"] = curPoly
			if curPoly.defaults ~= nil then
				if curPoly.defaults.baseType ~= nil then
					curObj["baseType"] = curPoly.defaults.baseType
				end
				if curPoly.defaults.defaultStartSide ~= nil then
					curObj["defaultStartSide"] = curPoly.defaults.defaultStartSide
				end
				if curPoly.defaults.enabled then
					curObj["enabled"] = curPoly.defaults.enabled
				end
			end
		end
		sendUDPPacket({
			action = 'airbaseC',
			data = curObj
		})
	end
end

local function initAirbases()
	local neutralAirbases = coalition.getAirbases(coalition.side.NEUTRAL)
	if neutralAirbases ~= nil then
		updateAirbases(neutralAirbases, 0)
	end
	local redAirbases = coalition.getAirbases(coalition.side.RED)
	if redAirbases ~= nil then
		updateAirbases(redAirbases, 1)
	end
	local blueAirbases = coalition.getAirbases(coalition.side.BLUE)
	if blueAirbases ~= nil then
		updateAirbases(blueAirbases, 2)
	end
	sendUDPPacket({
		action = 'strategicPointC',
		data = strategicPointArray
	})
end

function sendUDPPacket(payload)
	udpClient:send(JSON:encode(payload))
end
function sendRequest(outObj)
	if outObj.action ~= nil then
		sendUDPPacket(outObj)
	end
end
function commandExecute(s)
	return loadstring("return " ..s)()
end
function runPerFrame(ourArgument, time)
	local request = udpMissionRuntime:receive()
	if request ~= nil then
		if request.verbose ~= null then
			env.info(request)
		end
		requestObj = JSON:decode(request)
		if requestObj.actionObj ~= nil then
			runRequest(requestObj.actionObj)
		end
	end
	return time + DATA_TIMEOUT_SEC
end

function runRequest(request)
	tprint(request, 1)
	if request.action ~= nil and request.reqID ~= nil then
		if request.action == "updateCleanAirfieldAndStrategicTables" then
			env.info("Sending Airfield and Strategic");
			initAirbases()
		end
		if request.action == "startMissionImport" then
			env.info("Clean Tables and Sanitize Table");
			-- check table sanitize inputs before deleting them
			sendUDPPacket({
				action = 'clearAirfieldAndStrategicTable'
			})
		end

	end
end

timer.scheduleFunction(runPerFrame, {}, timer.getTime() + DATA_TIMEOUT_SEC)
env.info("DDCS Template Export has loaded")
