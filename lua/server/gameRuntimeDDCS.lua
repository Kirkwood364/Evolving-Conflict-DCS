function tprint(tbl, indent)
	if not indent then indent = 0 end
	for k, v in pairs(tbl) do
		formatting = string.rep("  ", indent) .. k .. ": "
		if type(v) == "table" then
			net.log(formatting)
			tprint(v, indent + 1)
		elseif type(v) == 'boolean' then
			net.log(formatting .. tostring(v))
		else
			net.log(formatting .. tostring(v))
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

net.log("startGameRuntimeDDCS")

ddcs = {}
local ddcsHost = "localhost"
local ddcsPort = 3001
local gameRuntimeHost = "localhost"
local gameRuntimePort = 3003
local DATA_TIMEOUT_SEC = 1
local SLOT_RATE_LIMIT_SEC = 2

local socket = require("socket")
local JSON = loadfile("Scripts\\JSON.lua")()

local udpClient = socket.udp()
assert(udpClient:setpeername(socket.dns.toip(ddcsHost),ddcsPort))

local udpGameRuntime = socket.udp()
assert(udpGameRuntime:settimeout(0))
assert(udpGameRuntime:setsockname(socket.dns.toip(gameRuntimeHost), gameRuntimePort))

playerSlots = {}
playerRateLimit = {}

function commandExecute(s)
	return loadstring("return " ..s)()
end

function refreshPlayerSlots()
	local redSlots = DCS.getAvailableSlots("red")
	local blueSlots = DCS.getAvailableSlots("blue")

	for redSlotIndex = 1, #redSlots do
		local curSlot = redSlots[redSlotIndex]
		--net.log("RED: "..JSON:encode(curSlot))
		playerSlots[curSlot.unitId] = {
			["countryName"] = curSlot.countryName,
			["groupName"] = curSlot.groupName
		}
	end

	for blueSlotIndex = 1, #blueSlots do
		local curSlot = blueSlots[blueSlotIndex]
		--net.log("BLUE: "..JSON:encode(curSlot))
		playerSlots[curSlot.unitId] = {
			["countryName"] = curSlot.countryName,
			["groupName"] = curSlot.groupName
		}
	end
end

local function runRequest(request)
	if request.action == "refreshPlayerSlots" then
		refreshPlayerSlots()
	end

	if request.action == "CMD" and request.cmd ~= nil and request.reqID ~= nil then
		local success, cmdResponse =  pcall(commandExecute, request.cmd)
		if not success then
			net.log("Error: " .. resp)
		end
		if request.reqID > 0 then
			if decodeJSON.verbose ~= null then
				tprint(cmdResponse, 1)
			end
			udpClient:send(JSON:encode({
				["action"] = "processReq",
				["reqId"] = request.reqID,
				["cmdResp"] = cmdResponse
			}))
		end
	end
end

function runPerFrame()
	local request = udpGameRuntime:receive()
	if request ~= nil then
		decodeJSON = JSON:decode(request)
		if decodeJSON ~= null then
			if decodeJSON.verbose ~= null then
				tprint(decodeJSON, 1)
			end
			runRequest(decodeJSON)
		end
	end
end

function buildPlayers()
	playerTable = {}
	for k, v in pairs(net.get_player_list()) do
		if v ~= nil then
			table.insert(playerTable, net.get_player_info(v))
		end
	end
	return playerTable
end

local _lastSent = 0
function ddcs.onSimulationFrame()
	runPerFrame()

	--Run Once Every Second
	local _now = DCS.getRealTime()
	if _now > _lastSent + DATA_TIMEOUT_SEC then
		_lastSent = _now
		udpClient:send(JSON:encode({
			["action"] = "playerStats",
			["missionFileName"] = DCS.getMissionName(),
			["players"] = buildPlayers(),
		}))
	end
end

function getSlotSide(curSlot)
	if curSlot ~= nil then
		local curPlayerSlot = playerSlots[curSlot]
		if curPlayerSlot.groupName ~= nil then
			return curPlayerSlot
		end
	end
	return 0
end

function ddcs.onPlayerChangeSlot(id)
	local playerInfo = net.get_player_info(id)
	if playerInfo ~= nil then
		if playerInfo.ucid ~= nil then
			local _now = DCS.getRealTime()
			if playerRateLimit[playerInfo.ucid] ~= nil then
				if playerRateLimit[playerInfo.ucid] < _now then
					playerRateLimit[playerInfo.ucid] = _now + SLOT_RATE_LIMIT_SEC
					udpClient:send(JSON:encode({
						["action"] = "playerChangeSlot",
						["playerInfo"] = playerInfo,
						["occupiedUnitSide"] = getSlotSide(playerInfo.slot)
					}))
				end
			else
				playerRateLimit[playerInfo.ucid] = _now + SLOT_RATE_LIMIT_SEC
				udpClient:send(JSON:encode({
					["action"] = "playerChangeSlot",
					["playerInfo"] = playerInfo,
					["occupiedUnitSide"] = getSlotSide(playerInfo.slot)
				}))
			end
		end
	end
end

clients = {}

function ddcs.onPlayerConnect(id)
	clients[id] = net.get_player_info(id)
	net.log("Player Connected", clients[id])
	udpClient:send(JSON:encode({
		["action"] = "connect",
		["playerInfo"] = clients[id]
	}))
end

function ddcs.onPlayerDisconnect(id, errorCode)
	net.log("Player Disconnected:", clients[id].name)
	udpClient:send(JSON:encode({
		["action"] = "disconnect",
		["error"] = errorCode,
		["playerInfo"] = clients[id]
	}))
	clients[id] = nil
end

function ddcs.onChatMessage(message, from)
	local playerInfo = net.get_player_info(from)
	if playerInfo.ucid ~= nil then
		local _now = DCS.getRealTime()
		if playerRateLimit[playerInfo.ucid] ~= nil then
			if playerRateLimit[playerInfo.ucid] < _now then
				playerRateLimit[playerInfo.ucid] = _now + SLOT_RATE_LIMIT_SEC
				udpClient:send(JSON:encode({
					["action"] = "incomingMessage",
					["message"] = message,
					["from"] = playerInfo.ucid
				}))
			end
		else
			playerRateLimit[playerInfo.ucid] = _now + SLOT_RATE_LIMIT_SEC
			udpClient:send(JSON:encode({
				["action"] = "incomingMessage",
				["message"] = message,
				["from"] = playerInfo.ucid
			}))
		end
	end
end

function ddcs.onMissionLoadBegin()
	refreshPlayerSlots()
end

DCS.setUserCallbacks(ddcs)
net.log("GameRuntimeDDCS loaded")
