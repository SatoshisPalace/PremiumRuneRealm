-- Battle Manager
-- 8hnue8PYCrgOB4OKHB6HS-ujbPOVuikOaTyICQjQJYQ
-- iB5C_0GQiu851DOX7AOFmIQ6ccDJDFXIFro7T6sSx_g
-- ZfeIygN2Uz4ayFKKWOvasWMZDOpBQyITc0BLDFH_mow
local json = require("json")

-- Attack Logic
-- Type effectiveness table
local EffectivenessChart = {
  Fire = { Fire = 1.0, Water = 0.5, Air = 2.0, Rock = 1.0 },
  Water = { Fire = 2.0, Water = 1.0, Air = 1.0, Rock = 0.5 },
  Air = { Fire = 0.5, Water = 2.0, Air = 1.0, Rock = 1.0 },
  Rock = { Fire = 1.0, Water = 1.0, Air = 0.5, Rock = 2.0 }
}


-- Battle session data
battles = battles or {}
activeBattles = activeBattles or {}
UserMonsters = UserMonsters or {}
battleLogs = battleLogs or {} -- Store battle logs persistently
-- Random number generation function
local function getRandom(min, max)
  return math.random(min, max)
end
local function clamp(val, min)
  return clamp(min, val)
end

local function initializeMoves(monster)
  local movesCopy = {}
  for name, move in pairs(monster.moves or {}) do
      movesCopy[name] = sanitizeMove({
          name = move.name or name,
          count = move.count,
          damage = move.damage,
          attack = move.attack,
          speed = move.speed,
          defense = move.defense,
          health = move.health,
          type = move.type or monster.elementType
      })
  end
  return movesCopy
end

-- Helper: Ensure a move has default values for all fields
local function sanitizeMove(name, move)
  return {
    name = move.name or name,
    damage = move.damage or 0,
    attack = move.attack or 0,
    speed = move.speed or 0,
    defense = move.defense or 0,
    health = move.health or 0,
    count = move.count or 1,
    type = move.type -- may be nil; will be set later if needed
  }
end

-- Helper: Send error response
local function sendError(target, message)
  ao.send({
    Target = target,
    Data = json.encode({
      status = "error",
      message = message
    })
  })
end

-- Calculate type effectiveness multiplier
local function getTypeEffectiveness(attackerType, defenderType)
  return (EffectivenessChart[attackerType] and EffectivenessChart[attackerType][defenderType]) or 1.0
end

-- Determine if attack hits based on speed difference
local function calculateHitChance(attackerSpeed, defenderSpeed)
  local speedDiff = clamp(0, (attackerSpeed or 0) - (defenderSpeed or 0))
  local baseHitChance = 0.8 -- 80% base hit chance
  local hitChanceModifier = speedDiff * 0.05 -- 5% per point of speed difference
  return clamp(0.5, math.min(0.95, baseHitChance + hitChanceModifier))
end

local function doesAttackHit(attackerSpeed, defenderSpeed)
  return getRandom(1, 100) <= calculateHitChance(attackerSpeed, defenderSpeed) * 100
end

-- Determine turn order based on speed
local function determineTurnOrder(attacker, defender)
  if not attacker or not defender then return false end
  local attackerRoll = (attacker.speed or 0) + getRandom(0, 5)
  local defenderRoll = (defender.speed or 0) + getRandom(0, 5)
  return attackerRoll > defenderRoll
end

-- Calculate damage with stat validation
local function calculateDamage(move, attacker, defender)
  if not move or not attacker or not defender then return 0 end
  local baseDamage = clamp(0, move.damage or 0)
  local attackBonus = attacker.attack and attacker.attack > 0 and getRandom(0, attacker.attack) or 0
  local damage = baseDamage + attackBonus
  return math.floor(damage * getTypeEffectiveness(move.type, defender.elementType))
end

-- Apply damage with shields (ensures stats never go below zero)
local function applyDamage(target, damage)
  if not target then return 0, 0 end
  local shieldDamage = math.min(damage, target.shield or 0)
  local healthDamage = clamp(0, damage - shieldDamage)
  target.shield = clamp(0, (target.shield or 0) - shieldDamage)
  target.healthPoints = clamp(0, (target.healthPoints or 0) - healthDamage)
  return shieldDamage, healthDamage
end

-- Apply stat changes (ensures stats never go below zero)
local function applyStatChanges(target, move)
  if not target or not move then return end
  target.attack = clamp(0, (target.attack or 0) + (move.attack or 0))
  target.speed = clamp(0, (target.speed or 0) + (move.speed or 0))
  target.defense = clamp(0, (target.defense or 0) + (move.defense or 0))
  target.shield = clamp(0, (target.shield or 0) + (move.defense or 0))
  target.healthPoints = clamp(0, (target.healthPoints or 0) + (move.health or 0))
end

-- Create struggle move
local function createStruggleMove(monster)
  return {
      name = "Struggle", type = monster and monster.elementType or "normal", damage = 1, count = 999
  }
end

-- Process a single attack
local function processAttack(attacker, defender, move)
  -- Decrement move count
  if move.count then
      move.count = move.count - 1
  end
  
  -- Check if attack hits (only for enemy-targeting moves)
  local hits = move.damage > 0 and doesAttackHit(attacker.speed, defender.speed) or true
  if not hits then
      return {
          missed = true,
          attacker = attacker.name,
          move = move.name,
          attackerState = {
              health = attacker.healthPoints,
              shield = attacker.shield,
              attack = attacker.attack,
              defense = attacker.defense,
              speed = attacker.speed
          },
          defenderState = {
              health = defender.healthPoints,
              shield = defender.shield,
              attack = defender.attack,
              defense = defender.defense,
              speed = defender.speed
          }
      }
  end
  
  -- Calculate damage
  local damage, effectiveness = calculateDamage(move, attacker, defender)
  
  -- Apply damage based on whether it's self-damage or enemy damage
  local shieldDamage, healthDamage
  if move.damage < 0 then
      -- Self-damage
      shieldDamage, healthDamage = applyDamage(attacker, damage, true)
  else
      -- Enemy damage
      shieldDamage, healthDamage = applyDamage(defender, damage, false)
  end
  
  -- Apply stat changes to attacker
  local statChanges = applyStatChanges(attacker, move)
  
  -- Return detailed battle log including monster states
  return {
      missed = false,
      attacker = attacker.name,
      move = move.name,
      moveName = move.name,
      moveRarity = move.rarity,
      shieldDamage = shieldDamage,
      healthDamage = healthDamage,
      changes = statChanges,
      superEffective = effectiveness > 1,
      notEffective = effectiveness < 1,
      attackerState = {
          health = attacker.healthPoints,
          shield = attacker.shield,
          attack = attacker.attack,
          defense = attacker.defense,
          speed = attacker.speed
      },
      defenderState = {
          health = defender.healthPoints,
          shield = defender.shield,
          attack = defender.attack,
          defense = defender.defense,
          speed = defender.speed
      }
  }
end

-- Process a full turn (both monsters attack)
local function processTurn(attacker, defender, attackerMove, defenderMove)
    local actions = {}
    local attackerFirst = determineTurnOrder(attacker, defender)
    
    if attackerFirst then
        -- Attacker goes first
        table.insert(actions, processAttack(attacker, defender, attackerMove))
        if defender.healthPoints > 0 then
            table.insert(actions, processAttack(defender, attacker, defenderMove))
        end
    else
        -- Defender goes first
        table.insert(actions, processAttack(defender, attacker, defenderMove))
        if attacker.healthPoints > 0 then
            table.insert(actions, processAttack(attacker, defender, attackerMove))
        end
    end
    
    return {
        actions = actions
    }
end

-- Initialize a battle session
local function initBattleSession(wallet)
  battles[wallet] = {
    battlesRemaining = 4,
    wins = 0,
    losses = 0,
    startTime = os.time() * 1000 -- Convert to milliseconds
  }
end

-- Get battle session data
local function getBattleSession(userId)
  return battles[userId]
end

local function deepCopy(original)
  local copy = {}
  for key, value in pairs(original) do
      if type(value) == "table" then
          copy[key] = deepCopy(value)
      else
          copy[key] = value
      end
  end
  return copy
end

local function refreshMonsterCounts(userId)
  local storedMonster = UserMonsters[userId]
  if not storedMonster or not storedMonster.moves then
      return nil
  end

  -- Create a deep copy of the moves with their original counts
  local refreshedMoves = {}
  for name, move in pairs(storedMonster.moves) do
    refreshedMoves[name] = {
      name = move.name,
      count = move.count,
      damage = move.damage,
      attack = move.attack,
      speed = move.speed,
      defense = move.defense,
      health = move.health
    }
  end

  return refreshedMoves
end  


-- Create a level 1 opponent monster with fresh moves
local function createOpponent()
  -- Randomly select a faction
  local factionIndex = math.random(1, #AvailableFactions)
  local faction = AvailableFactions[factionIndex]
  
  -- Create a level 1 monster
  local opponent = CreateDefaultMonster(faction.name, os.time() * 1000)
  opponent.level = 1
  
  --Create a deep copy of the moves to avoid reference issues
  local freshMoves = {}
  for name, move in pairs(opponent.moves) do
    freshMoves[name] = {
      name = move.name,
      count = move.count, -- This should be from the default move count
      damage = move.damage,
      attack = move.attack,
      speed = move.speed,
      defense = move.defense,
      health = move.health
    }
  end
  opponent.moves = freshMoves
  
  print("Created opponent:", json.encode(opponent))
  return opponent
end

-- Record battle result
local function recordBattle(wallet, won)
  local session = battles[wallet]
  if session then
    if won then
      session.wins = session.wins + 1
    else
      session.losses = session.losses + 1
    end
    session.battlesRemaining = session.battlesRemaining - 1
    
    return session
  end
  return nil
end

-- Process battle turn using the new attack logic
local function processBattleTurn(battleId, playerMove, npcMove)
  local battle = activeBattles[battleId]
  if not battle then return nil end
  
  -- Initialize turns array if not exists
  battle.turns = battle.turns or {}
  
  -- Initialize struggle tracking if not exists
  battle.hasUsedStruggle = battle.hasUsedStruggle or { player = false, opponent = false }
  
  -- Track struggle usage
  if playerMove.name == "Struggle" then
    battle.hasUsedStruggle.player = true
  end
  if npcMove.name == "Struggle" then
    battle.hasUsedStruggle.opponent = true
  end
  
  -- Ensure both monsters have required fields
  if not battle.player.name then battle.player.name = "Player Monster" end
  if not battle.opponent.name then battle.opponent.name = "Opponent Monster" end
  
  -- Ensure both monsters have speed for turn order
  if not battle.player.speed then battle.player.speed = 1 end
  if not battle.opponent.speed then battle.opponent.speed = 1 end
  
  -- Process the full turn using attack logic
  print("Processing turn with moves:", json.encode({player = playerMove, npc = npcMove}))
  print("Monsters:", json.encode({player = battle.player, opponent = battle.opponent}))
  local turnResult = processTurn(battle.player, battle.opponent, playerMove, npcMove)
  
  -- Convert turn result to battle turns format with enhanced state tracking
  for _, action in ipairs(turnResult.actions) do
    local isPlayer = action.attacker == battle.player.name
    local turnInfo = {
      attacker = isPlayer and "player" or "opponent",
      move = action.move,
      moveName = action.moveName,
      moveRarity = action.moveRarity,
      missed = action.missed,
      shieldDamage = action.shieldDamage,
      healthDamage = action.healthDamage,
      statsChanged = action.changes,
      superEffective = action.superEffective,
      notEffective = action.notEffective,
      attackerState = action.attackerState,
      defenderState = action.defenderState
    }
    table.insert(battle.turns, turnInfo)
  end
  
  -- Regenerate shields at end of turn based on current defense stat
  if not battle.hasUsedStruggle.player then
    local shieldRegen = math.ceil(battle.player.defense / 4)
    battle.player.shield = math.min(battle.player.defense, battle.player.shield + shieldRegen)
    print("Regenerated player shield by", shieldRegen, "to:", battle.player.shield)
  end
  if not battle.hasUsedStruggle.opponent then
    local shieldRegen = math.ceil(battle.opponent.defense / 4)
    battle.opponent.shield = math.min(battle.opponent.defense, battle.opponent.shield + shieldRegen)
    print("Regenerated opponent shield by", shieldRegen, "to:", battle.opponent.shield)
  end
  
  -- Update battle logs
  battleLogs[battleId] = battle.turns
  
  -- Check battle outcome
  local playerWon = battle.opponent.healthPoints <= 0
  local opponentWon = battle.player.healthPoints <= 0
  
  if playerWon or opponentWon then
    return {
      battleOver = true,
      playerWon = playerWon
    }
  end
  
  return {
    battleOver = false
  }
end

-- Handlers
Handlers.add(
  "BeginBattles",
  Handlers.utils.hasMatchingTag("Action", "BeginBattles"),
  function(msg)
    local userId = msg.Tags.UserId
    local monsterData = json.decode(msg.Data)
    if not monsterData then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid monster data"
        })
      })
      return
    end
    
    -- Store user's monster
    UserMonsters[userId] = monsterData
    
    -- Initialize battle session
    initBattleSession(userId)
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle session started",
        data = battles[userId]
      })
    })
  end
)

Handlers.add(
  "GetBattleManagerInfo",
  Handlers.utils.hasMatchingTag("Action", "GetBattleManagerInfo"),
  function(msg)
    local userId = msg.Tags.UserId
    local session = getBattleSession(userId)
    if not session then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "not_found",
          message = "No active battle session"
        })
      })
      return
    end
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle status retrieved",
        data = session
      })
    })
  end
)

Handlers.add(
  "GetOpenBattle",
  Handlers.utils.hasMatchingTag("Action", "GetOpenBattle"),
  function(msg)
    local userId = msg.Tags.UserId
    local battle = nil
    local battleId = nil
    
    -- Search through active battles for this user
    for bid, activeBattle in pairs(activeBattles) do
        if activeBattle.player.address == userId then
            battle = activeBattle
            battleId = bid
            break
        end
    end
    
    if not battle then
      ao.send({
        Target = userId,
        Data = json.encode({
          status = "not_found",
          message = "No active battle"
        })
      })
      return
    end
    
    -- Restore battle logs if they exist
    if battleLogs[battleId] then
        battle.turns = battleLogs[battleId]
    end
    
    ao.send({
      Target = userId,
      Data = json.encode({
        status = "success",
        message = "Battle found",
        data = battle
      })
    })
  end
)

Handlers.add(
  "Battle",
  Handlers.utils.hasMatchingTag("Action", "Battle"),
  function(msg)
    local userId = msg.From
    local session = getBattleSession(userId)
    if not session then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No active battle session"
        })
      })
      return
    end
    
    if session.battlesRemaining <= 0 then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No battles remaining"
        })
      })
      return
    end
    
    -- Get player's monster
    local playerMonster = UserMonsters[userId]
    if not playerMonster then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found"
        })
      })
      return
    end
    
    -- Create opponent and initialize battle
    local opponent = createOpponent()
    local battleId = userId
    
    -- Validate player monster has moves
    if not playerMonster.moves or type(playerMonster.moves) ~= "table" then
        print("Error: Player monster has no moves")
        print("Player monster:", json.encode(playerMonster))
        ao.send({
            Target = msg.From,
            Data = json.encode({
                status = "error",
                message = "Invalid monster: missing moves"
            })
        })
        return
    end

    -- Validate opponent has moves
    if not opponent.moves or type(opponent.moves) ~= "table" then
        print("Error: Opponent has no moves")
        print("Opponent:", json.encode(opponent))
        ao.send({
            Target = msg.From,
            Data = json.encode({
                status = "error",
                message = "Invalid opponent: missing moves"
            })
        })
        return
    end
    
    -- Refresh player's move counts
    local refreshedMoves = refreshMonsterCounts(userId)
    if not refreshedMoves then
      print("Error: Could not refresh move counts")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Could not refresh move counts"
        })
      })
      return
    end
    
-- Initialize battle object with player address and health points
    local battle = {
      id = battleId,
      player = json.decode(json.encode(playerMonster)), -- Deep copy
      opponent = opponent,
      startTime = os.time() * 1000,
      turns = {},
      stats = battles[userId], -- Store battle stats in active battle
      hasUsedStruggle = { player = false, opponent = false }, -- Track struggle usage
      status = "battling" -- Add status field
    }
    
    -- Set refreshed move counts (deep copy to avoid modifying original)
    battle.player.moves = json.decode(json.encode(refreshedMoves))

    -- Validate and initialize player moves
    for name, move in pairs(battle.player.moves) do
        if not move.name then move.name = name end
        if not move.damage then move.damage = 0 end
        if not move.attack then move.attack = 0 end
        if not move.speed then move.speed = 0 end
        if not move.defense then move.defense = 0 end
        if not move.health then move.health = 0 end
        if not move.count then move.count = 1 end
    end

    -- Opponent moves should already be initialized with fresh counts from createOpponent
    print("Battle initialized with moves - Player:", json.encode(battle.player.moves))
    print("Battle initialized with moves - Opponent:", json.encode(battle.opponent.moves))
    
    -- Ensure moves have type field from their pool definitions
    for name, move in pairs(battle.player.moves) do
        if not move.type then
            -- Look up move in appropriate pool based on name
            local moveType = nil
            for _, pool in pairs({FirePool, WaterPool, AirPool, RockPool, BoostPool, HealPool}) do
                if pool[name] then
                    moveType = pool[name].type
                    break
                end
            end
            move.type = moveType or battle.player.elementType
        end
    end

    for name, move in pairs(battle.opponent.moves) do
        if not move.type then
            -- Look up move in appropriate pool based on name
            local moveType = nil
            for _, pool in pairs({FirePool, WaterPool, AirPool, RockPool, BoostPool, HealPool}) do
                if pool[name] then
                    moveType = pool[name].type
                    break
                end
            end
            move.type = moveType or battle.opponent.elementType
        end
    end
    
    battle.player.address = userId
    battle.player.healthPoints = battle.player.health * 10
    battle.player.shield = math.max(0, battle.player.defense)
    battle.opponent.healthPoints = battle.opponent.health * 10
    battle.opponent.shield = math.max(0, battle.opponent.defense)
    
    activeBattles[battleId] = battle
    battleLogs[battleId] = {} -- Initialize empty battle logs
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle started",
        data = battle
      })
    })
  end
)


Handlers.add(
  "Attack",
  Handlers.utils.hasMatchingTag("Action", "Attack"),
  function(msg)
    print("Attack handler called")
    print("Full message:", json.encode(msg))
    
    -- Validate required fields
    if not msg.From then
      print("Error: msg.From is nil")
      ao.send({
        Target = msg.From or "unknown",
        Data = json.encode({
          status = "error",
          message = "Missing user ID"
        })
      })
      return
    end
    
    if not msg.Tags or not msg.Tags.BattleId then
      print("Error: msg.Tags.BattleId is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Missing battle ID"
        })
      })
      return
    end
    
    if not msg.Tags.Move then
      print("Error: msg.Tags.Move is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Missing move name"
        })
      })
      return
    end
    
    local userId = msg.From
    local battleId = msg.Tags.BattleId
    local moveName = msg.Tags.Move
    print("User ID:", userId)
    print("Battle ID:", battleId)
    print("Move Name:", moveName)
    print("Full Tags:", json.encode(msg.Tags))
    
    if not userId or not battleId or not moveName then
        print("Error: Missing required fields")
        print("From:", msg.From)
        print("Tags:", json.encode(msg.Tags))
        ao.send({
            Target = msg.From,
            Data = json.encode({
                status = "error",
                message = "Missing required fields for attack"
            })
        })
        return
    end
    
    local battle = activeBattles[battleId]
    if not battle then
      print("Battle not found")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Battle not found"
        })
      })
      return
    end
    
    print("Battle found:", json.encode(battle))
    
    -- Validate battle has required fields
    if not battle.player then
      print("Error: battle.player is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid battle state: missing player"
        })
      })
      return
    end
    
    if not battle.opponent then
      print("Error: battle.opponent is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid battle state: missing opponent"
        })
      })
      return
    end
    
    if not battle.player.moves then
      print("Error: battle.player.moves is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid battle state: player has no moves"
        })
      })
      return
    end
    
    if not battle.opponent.moves then
      print("Error: battle.opponent.moves is nil")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid battle state: opponent has no moves"
        })
      })
      return
    end
    
    -- Check if all moves are depleted
    local allMovesUsed = true
    for _, move in pairs(battle.player.moves) do
      if (move.count or 0) > 0 then
        allMovesUsed = false
        break
      end
    end

    -- Handle struggle move
    local playerMove
    if moveName == "struggle" then
      if not allMovesUsed then
        print("Cannot use struggle when other moves are available")
        ao.send({
          Target = msg.From,
          Data = json.encode({
            status = "error",
            message = "Cannot use struggle when other moves are available"
          })
        })
        return
      end
      playerMove = createStruggleMove(battle.player)
    else
      -- Validate regular move and move count
      if not battle.player.moves[moveName] then
        print("Invalid move")
        ao.send({
          Target = msg.From,
          Data = json.encode({
            status = "error",
            message = "Invalid move"
          })
        })
        return
      end

      -- Get the move and check uses remaining
      playerMove = battle.player.moves[moveName]
      if (playerMove.count or 0) <= 0 then
        print("Move has no uses remaining")
        ao.send({
          Target = msg.From,
          Data = json.encode({
            status = "error",
            message = "Move has no uses remaining"
          })
        })
        return
      end
    end
    
    -- Get list of NPC moves that have uses remaining
    local availableNpcMoves = {}
    print("Opponent moves table:", json.encode(battle.opponent.moves))
    
    -- Build array of valid moves with deep copies
    for name, move in pairs(battle.opponent.moves) do
        print("Checking move:", name)
        print("Move details:", json.encode(move))
        if move and type(move) == "table" and (move.count or 0) > 0 then
            -- Create a deep copy of the move
            local moveCopy = {
                name = name,
                count = move.count,
                damage = move.damage or 0,
                attack = move.attack or 0,
                speed = move.speed or 0,
                defense = move.defense or 0,
                health = move.health or 0,
                type = move.type or battle.opponent.elementType
            }
            print("Adding move to available list:", name)
            print("Move copy:", json.encode(moveCopy))
            table.insert(availableNpcMoves, moveCopy)
        end
    end
    
    print("Available NPC moves array:", json.encode(availableNpcMoves))
    
    -- Check if all NPC moves are used up
    local npcMove
    if #availableNpcMoves == 0 then
        print("NPC using struggle - all moves depleted")
        npcMove = createStruggleMove(battle.opponent)
    else
        -- Get random move from available moves array
        local selectedIndex = math.random(#availableNpcMoves)
        npcMove = availableNpcMoves[selectedIndex]
        print("Selected move index:", selectedIndex)
        print("Selected move:", json.encode(npcMove))
        
        if not npcMove then
            print("Error: Selected move is nil, falling back to struggle")
            npcMove = createStruggleMove(battle.opponent)
        end
    end
    
    
    if not playerMove or not playerMove.name then
      print("Error: Invalid player move")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid player move"
        })
      })
      return
    end
    
    if not npcMove or not npcMove.name then
      print("Error: Invalid NPC move")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid NPC move"
        })
      })
      return
    end
    
    -- Ensure moves have name field
    if not playerMove.name then
        playerMove.name = "Struggle"
    end
    if not npcMove.name then
        npcMove.name = "Struggle"
    end

    -- Ensure both moves have all required fields
    for _, move in pairs({playerMove, npcMove}) do
        if not move.damage then move.damage = 0 end
        if not move.attack then move.attack = 0 end
        if not move.speed then move.speed = 0 end
        if not move.defense then move.defense = 0 end
        if not move.health then move.health = 0 end
        if not move.count then move.count = 1 end
    end

    -- Process the battle turn
    print("Processing battle turn")
    print("Player move:", json.encode(playerMove))
    print("NPC move:", json.encode(npcMove))
    local result = processBattleTurn(battleId, playerMove, npcMove)
    print("Battle turn result:", json.encode(result))
    
    if result.battleOver then
      local playerWon = result.playerWon
      local session = recordBattle(userId, playerWon)
      battle.stats = session
      battle.status = "ended"
      
      local finalLogs = battleLogs[battleId]
      
      battleLogs[battleId] = finalLogs
      
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "success",
          message = playerWon and "Victory!" or "Defeat",
          data = {
            result = playerWon and "win" or "loss",
            session = session,
            turns = finalLogs,
            battle = battle
          }
        })
      })
    else
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "success",
          message = "Turn completed",
          data = battle
        })
      })
    end
  end
)


Handlers.add(
  "EndBattle",
  Handlers.utils.hasMatchingTag("Action", "EndBattle"),
  function(msg)
    print("EndBattle handler called")
    local userId = msg.From
    local battleId = msg.Tags.BattleId
    
    print("User ID:", userId)
    print("Battle ID:", battleId)
    
    local battle = activeBattles[battleId]
    if not battle then
      print("Error: Battle not found")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Battle not found"
        })
      })
      return
    end
    
    print("Battle found:", json.encode(battle))
    
    if battle.status ~= "ended" then
      print("Error: Battle is not ended")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Battle is not ended"
        })
      })
      return
    end
    
    -- Record battle result if not already recorded
    local playerWon = battle.opponent.healthPoints <= 0
    print("Player won:", playerWon)
    
    -- Get current session
    local currentSession = battles[userId]
    print("Current session:", json.encode(currentSession))
    
    -- Remove battle but keep logs
    local finalLogs = battleLogs[battleId]
    activeBattles[battleId] = nil
    
    print("Sending success response")
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle ended",
        data = {
          session = currentSession,
          turns = finalLogs
        }
      })
    })
  end
)

Handlers.add(
  "ReturnFromBattle",
  Handlers.utils.hasMatchingTag("Action", "ReturnFromBattle"),
  function(msg)
    local userId = msg.From
    local session = getBattleSession(userId)
    
    if not session then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No active battle session"
        })
      })
      return
    end
    
    -- End battle session but keep battle logs
    battles[userId] = nil
    activeBattles[userId] = nil
    UserMonsters[userId] = nil

    ao.send({
      Target = TARGET_PREMPASS_PID,
      Tags = {
        Action = "ReturnFromBattle",
        UserId = userId
      },
      Data = json.encode({
        status = "home",
        message = "User return from battle"
      })
    })
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle session ended",
        data = session
      })
    })
  end
)

-- Admin force return
Handlers.add(
  "AdminReturnFromBattle",
  Handlers.utils.hasMatchingTag("Action", "AdminReturnFromBattle"),
  function(msg)
    local userId = msg.Tags.UserId
    if not userId then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No wallet specified"
        })
      })
      return
    end
    
    local session = getBattleSession(userId)
    battles[userId] = nil
    
    -- Clear active battles but keep battle logs
    for battleId, battle in pairs(activeBattles) do
      if battle.player.address == userId then
        activeBattles[battleId] = nil
      end
    end

    ao.send({
      Target = TARGET_PREMPASS_PID,
      Tags = {
        Action = "ReturnFromBattle",
        UserId = userId
      },
      Data = json.encode({
        status = "home",
        message = "Admin return from battle"
      })
    })
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Battle session ended by admin",
        data = session
      })
    })
  end
)

print("Loaded Battle.lua")