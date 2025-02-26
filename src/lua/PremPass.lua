-- Name: PremiumPass
-- ProcessId: j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI

local json = require("json")
-- require("globals")


-- Initialize storage
Unlocked = Unlocked or {}
UserSkins = UserSkins or {}
UserFactions = UserFactions or {}
UserMonsters = UserMonsters or {}


-- Handler for returning from mission
Handlers.add(
  "ReturnFromMission",
  Handlers.utils.hasMatchingTag("Action", "ReturnFromMission"),
  function(msg)
    print("Returning from mission")
    local userId = msg.From
    
    local monster = UserMonsters[userId]
    if not monster then
      print("No monster found for user:", userId)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found"
        })
      })
      return
    end

    if monster.status.type ~= "Mission" then
      print("Monster is not on mission:", monster.status.type)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Monster is not on mission"
        })
      })
      return
    end

    if msg.Timestamp < monster.status.until_time then
      print("Mission not finished yet")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Mission not finished yet"
        })
      })
      return
    end

    -- Return home and grant exp
    monster.status = {
      type = "Home",
      since = msg.Timestamp,
      until_time = msg.Timestamp
    }
    monster.exp = monster.exp + 1  -- Grant 1 exp for completing mission
    monster.totalTimesMission = (monster.totalTimesMission or 0) + 1
    print("Total missions completed:", monster.totalTimesMission)

    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Monster returned from mission",
        monster = monster
      })
    })
  end
)

-- Handler for returning from play
Handlers.add(
  "ReturnFromPlay",
  Handlers.utils.hasMatchingTag("Action", "ReturnFromPlay"),
  function(msg)
    print("Returning from play")
    local userId = msg.From
    
    local monster = UserMonsters[userId]
    if not monster then
      print("No monster found for user:", userId)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found"
        })
      })
      return
    end

    if monster.status.type ~= "Play" then
      print("Monster is not playing:", monster.status.type)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Monster is not playing"
        })
      })
      return
    end

    if msg.Timestamp < monster.status.until_time then
      print("Play time not finished yet")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Play time not finished yet"
        })
      })
      return
    end

    -- Return home and increase happiness
    monster.status = {
      type = "Home",
      since = msg.Timestamp,
      until_time = msg.Timestamp
    }
    monster.happiness = math.min(100, monster.happiness + monster.activities.play.happinessGain)
    monster.totalTimesPlay = (monster.totalTimesPlay or 0) + 1
    print("Total times played:", monster.totalTimesPlay)

    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Monster returned from play",
        monster = monster
      })
    })
  end
)

-- Function to check if a value exists in a table
function UnlockedSkin(value)
  for _, v in pairs(Unlocked) do
    if v == value then
      return true
    end
  end
  return false
end


function UpdateSkin(userId, spriteTxId)
  print('Changing ' .. userId .. "'s Skin to " .. (spriteTxId or BaseSprite))

  ao.send({
    Target = TARGET_WORLD_PID,
    Tags = {
      Action = "Reality.UpdateSpriteTxId",
      EntityID = userId,
      SpriteTxId = spriteTxId or BaseSprite,
      SpriteAtlasTxId = BaseSpriteAtlas,
    --   SpriteScale = BaseSpriteScale,
    --   SpriteHitbox = BaseSpriteHitbox,
    },
    Data = json.encode({
       Scale = BaseSpriteScale,
       Hitbox = BaseSpriteHitbox
      })
  })
  print("Sent UpdateSkin to world")
end

-- Handle GetPurchaseOptions action
Handlers.add(
  "GetPurchaseOptions",
  Handlers.utils.hasMatchingTag("Action", "GetPurchaseOptions"),
  function(msg)
    ao.send({
      Target = msg.From,
      Data = json.encode({
        result = PurchaseTokens
      })
    })
    return "ok"
  end
)


-- Function to count members and monsters in a faction
function GetFactionStats(factionName)
  local memberCount = 0
  local monsterCount = 0
  local members = {}
  local totalLevel = 0
  local totalTimesFed = 0
  local totalTimesPlay = 0
  local totalTimesMission = 0
  
  for userId, userFaction in pairs(UserFactions) do
    if userFaction.faction == factionName then
      memberCount = memberCount + 1
      local memberInfo = {
        id = userId,
        level = 0,
        timesFed = 0,
        timesPlay = 0,
        timesMission = 0
      }
      
      if UserMonsters[userId] then
        local monster = UserMonsters[userId]
        monsterCount = monsterCount + 1
        memberInfo.level = monster.level
        memberInfo.timesFed = monster.totalTimesFed or 0
        memberInfo.timesPlay = monster.totalTimesPlay or 0
        memberInfo.timesMission = monster.totalTimesMission or 0
        
        totalLevel = totalLevel + monster.level
        totalTimesFed = totalTimesFed + (monster.totalTimesFed or 0)
        totalTimesPlay = totalTimesPlay + (monster.totalTimesPlay or 0)
        totalTimesMission = totalTimesMission + (monster.totalTimesMission or 0)
      end
      
      table.insert(members, memberInfo)
    end
  end
  
  return memberCount, monsterCount, members, totalLevel / (monsterCount > 0 and monsterCount or 1),
         totalTimesFed, totalTimesPlay, totalTimesMission
end

-- Handle GetFactions action
Handlers.add(
  "GetFactions",
  Handlers.utils.hasMatchingTag("Action", "GetFactions"),
  function(msg)
    local factionsWithStats = {}
    
    for _, faction in ipairs(AvailableFactions) do
      local memberCount, monsterCount, members, avgLevel, totalFed, totalPlay, totalMission = GetFactionStats(faction.name)
      local factionWithStats = {
        name = faction.name,
        description = faction.description,
        mascot = faction.mascot,
        perks = faction.perks,
        memberCount = memberCount,
        monsterCount = monsterCount,
        members = members,
        averageLevel = avgLevel,
        totalTimesFed = totalFed,
        totalTimesPlay = totalPlay,
        totalTimesMission = totalMission
      }
      table.insert(factionsWithStats, factionWithStats)
    end
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        result = factionsWithStats
      })
    })
    return "ok"
  end
)

-- Handler to get user's current skin
Handlers.add(
  'GetUserSkin',
  Handlers.utils.hasMatchingTag('Action', 'GetUserSkin'),
  function(msg)
    local targetWallet = msg.Tags.Wallet
    if not targetWallet then
      return ao.send({
        Target = msg.From,
        Data = json.encode({ error = "No wallet specified" })
      })
    end
    
    local response = UserSkins[targetWallet] or {}
    ao.send({
      Target = msg.From,
      Data = json.encode(response)
    })
  end
)

-- New handler to get list of authorized users
Handlers.add(
  'GetAuthorizedUsers',
  Handlers.utils.hasMatchingTag('Action', 'GetAuthorizedUsers'),
  function(msg)
    ao.send({
      Target = msg.From,
      Data = json.encode(Unlocked)
    })
  end
)

-- Modified update skin handler
Handlers.add(
  'UpdateSprite',
  Handlers.utils.hasMatchingTag('Action', 'UpdateSprite'),
  function(msg)
    print("Updating sprite")
    print("From: " .. msg.From)
    
    -- Check if user has unlock permission
    if not UnlockedSkin(msg.From) then
      print("User " .. msg.From .. " does not have Eternal Pass")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "You do not have Eternal Pass"
        })
      })
      return
    end
    
    local spriteTxId = msg.Tags.SpriteTxId
    assert(spriteTxId, "No sprite transaction ID provided")
    local spriteAtlasTxId = msg.Tags.SpriteAtlasTxId
    assert(spriteAtlasTxId, "No sprite atlas transaction ID provided")
    
    UpdateSkin(msg.From, spriteTxId)
    UserSkins[msg.From] = { txId = spriteTxId }
    print("Updated user skin to: " .. spriteTxId .. " " .. spriteAtlasTxId .. " for user: " .. msg.From) 
    
    -- Send confirmation back to the user
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Sprite updated successfully",
        txId = spriteTxId
      })
    })
  end
)
Handlers.add(
  'SetFaction',
  Handlers.utils.hasMatchingTag('Action', 'SetFaction'),
  function(msg)
    print("Setting faction")
    print("From: " .. msg.From)
    
    -- Check if user has unlock permission
    if not UnlockedSkin(msg.From) then
      print("User " .. msg.From .. " does not have Eternal Pass")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "You do not have Eternal Pass"
        })
      })
      return
    end
    
    local faction = msg.Tags.Faction
    assert(faction, "No faction provided")
    assert(UserFactions[msg.From] == nil, "User already has a faction")
    UserFactions[msg.From] = { faction = faction }
    print("Set user faction to: " .. faction .. " for user: " .. msg.From) 
    
    -- Send confirmation back to the user
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Faction set successfully",
        faction = faction
      })
    })
  end
)
-- Handle Credit-Notice for both purchases and feeding
Handlers.add(
  "CreditNoticeHandler",
  Handlers.utils.hasMatchingTag("Action", "Credit-Notice"),
  function(msg)
    print("credit-notice")
    local userId = msg.Tags.Sender
    local quantity = tonumber(msg.Tags.Quantity)
    local token = msg.From

    -- Check if this is a feeding action
    if msg.Tags["X-Action"] == "FEED" then
      print("Handling berry feeding from:", userId)
      
      local monster = UserMonsters[userId]
      if not monster then
        print("No monster found for user:", userId)
        return
      end

      print("Monster state:", json.encode(monster))
      print("Received berry:", token)

      if monster.activities.feed.cost.token ~= token then
        print("Wrong berry process. Expected:", monster.activities.feed.cost.token, "Got:", token)
        return
      end

      if monster.energy >= 100 then
        print("Monster energy already at maximum")
        return
      end

      -- Increase energy by configured amount, not exceeding 100
      monster.energy = math.min(100, monster.energy + monster.activities.feed.energyGain)
      monster.totalTimesFed = (monster.totalTimesFed or 0) + 1
      print("Updated energy to:", monster.energy)

      -- Send confirmation back to the user
      ao.send({
        Target = userId,
        Data = json.encode({
          status = "success",
          message = "Monster fed successfully",
          monster = monster
        })
      })
      return
    end

        -- Check if this is a feeding action
        if msg.Tags["X-Action"] == "Play" then
          print("Handling playing:", userId)
          
          local monster = UserMonsters[userId]
          if not monster then
            print("No monster found for user:", userId)
            return
          end
    
          print("Monster state:", json.encode(monster))
          print("Received berry:", token)
    
          if monster.activities.play.cost.token ~= token then
            print("Wrong berry process. Expected:", monster.activities.play.cost.token, "Got:", token)
            return
          end

          if monster.status.type ~= "Home" then
            print("Monster is not at home:", monster.status.type)
            return
          end

          if monster.energy < monster.activities.play.energyCost  then
            print("Monster doesn't have enough energy")
            return
          end
          monster.energy = monster.energy - monster.activities.play.energyCost
    

                -- Set monster to playing status
          monster.status = {
            type = "Play",
            since = msg.Timestamp,
            until_time = msg.Timestamp + monster.activities.play.duration
          }
          -- Send confirmation back to the user
          ao.send({
            Target = userId,
            Data = json.encode({
              status = "success",
              message = "Monster sent to play successfully",
              monster = monster
            })
          })
          return
        end

    -- If X-Action is Battle, handle battle initiation
    if msg.Tags["X-Action"] == "Battle" then
      print("Handling battle token from:", userId)
      
      local monster = UserMonsters[userId]
      if not monster then
        print("No monster found for user:", userId)
        return
      end

      print("Monster state:", json.encode(monster))
      print("Received battle token:", token)

      if monster.activities.battle.cost.token ~= token then
        print("Wrong battle token. Expected:", monster.activities.battle.cost.token, "Got:", token)
        return
      end

      if monster.energy < monster.activities.battle.energyCost or monster.happiness < monster.activities.battle.happinessCost then
        print("Monster doesn't have enough energy or happiness")
        return
      end

      if monster.status.type ~= "Home" then
        print("Monster is not at home:", monster.status.type)
        return
      end
                      -- Set monster to playing status
                      monster.status = {
                        type = "Battle",
                        since = msg.Timestamp,
                        until_time = 0
                      }

                                  -- Consume energy and happiness
            monster.energy = monster.energy - monster.activities.battle.energyCost
            monster.happiness = monster.happiness - monster.activities.battle.happinessCost

      -- Send monster to battle
      ao.send({
        Target = TARGET_BATTLE_PID,
        Tags = {
          Action = "BeginBattles",
          UserId = userId
        },
        Data = json.encode(monster)
      })

      -- Send confirmation back to the user
      ao.send({
        Target = userId,
        Data = json.encode({
          status = "success",
          message = "Monster is entering battle",
          monster = monster
        })
      })
      return
    end

    -- If not feeding, battle, or mission, handle as purchase
    if msg.Tags["X-Action"] == "Mission" then
      print("Handling mission fuel from:", userId)
      
      local monster = UserMonsters[userId]
      if not monster then
        print("No monster found for user:", userId)
        return
      end

      print("Monster state:", json.encode(monster))
      print("Received mission fuel:", token)

      if monster.activities.mission.cost.token ~= token then
        print("Wrong mission fuel. Expected:", monster.activities.mission.cost.token, "Got:", token)
        return
      end

      if monster.status.type ~= "Home" then
        print("Monster is not at home:", monster.status.type)
        return
      end

      if monster.energy < monster.activities.mission.energyCost or monster.happiness < monster.activities.mission.happinessCost then
        print("Monster doesn't have enough energy or happiness")
        return
      end

      -- Set monster on mission
      monster.status = {
        type = "Mission",
        since = msg.Timestamp,
        until_time = msg.Timestamp + monster.activities.mission.duration
      }

      -- Consume energy and happiness
      monster.energy = monster.energy - monster.activities.mission.energyCost
      monster.happiness = monster.happiness - monster.activities.mission.happinessCost

      -- Send confirmation back to the user
      ao.send({
        Target = userId,
        Data = json.encode({
          status = "success",
          message = "Monster is now on a mission",
          monster = monster
        })
      })
      return
    end

    -- Handle as purchase
    local validPurchase = false
    for _, option in ipairs(PurchaseTokens) do
      if token == option.token and quantity == tonumber(option.amount) then
        validPurchase = true
        --Handle referer
        local referer = msg.Tags["X-Referer"] or nil
        if referer then
          --TODO ensure this is working
          ao.send({
            Target = token,
            Tags = {
              Action = "Transfer",
              Game = "RuneRealm",
              Recipient = msg.Tags["X-Referer"],
              Quantity = tostring(quantity*0.35)
            },
          })
        end
        --end handle referer
        break
      end
    end

    if not validPurchase then
      print("Invalid purchase amount or token")
      return
    end

    local message
    if UnlockedSkin(userId) then
      message = "Thank you for the donation!"
    else
      table.insert(Unlocked, userId)
      message = "Thank you for purchasing skin changing ability!"
    end

    ao.send({
      Target = TARGET_WORLD_PID,
      Tags = {
        Action = "ChatMessage",
        ['Author-Name'] = 'SkinChanger',
        Recipient = userId
      },
      Data = message
    })
  end
)

-- Handle CheckUnlocked action
Handlers.add(
  "CheckUnlocked",
  Handlers.utils.hasMatchingTag("Action", "CheckUnlocked"),
  function(msg)
    local address = ao.id
    if msg.Tags.Address then
      address = msg.Tags.Address
    end
    
    local result = {
      result = UnlockedSkin(address)
    }
    
    ao.send({
      Target = msg.From,
      Data = json.encode(result)
    })
  end
)

-- Handle CheckUnlocked action
Handlers.add(
  "CheckSkin",
  Handlers.utils.hasMatchingTag("Action", "CheckSkin"),
  function(msg)
    local address = ao.id
    if msg.Tags.Address then
      address = msg.Tags.Address
    end
    
    local result = UserSkins[address].txId or "None"
    
    ao.send({
      Target = msg.From,
      Data = result
    })
  end
)
Handlers.add(
  "CheckFaction",
  Handlers.utils.hasMatchingTag("Action", "CheckFaction"),
  function(msg)
    local address = ao.id
    if msg.Tags.Address then
      address = msg.Tags.Address
    end
    
    local result = UserFactions[address].faction or "None"
    
    ao.send({
      Target = msg.From,
      Data = result
    })
  end
)

-- Handler for bulk address import
Handlers.add(
  'BulkImportAddresses',
  Handlers.utils.hasMatchingTag('Action', 'BulkImportAddresses'),
  function(msg)
    if not ensureAdmin(msg) then return end

    local data = json.decode(msg.Data)
    if not data or not data.addresses or type(data.addresses) ~= "table" then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          type = "error",
          error = "Invalid input format"
        })
      })
      return
    end

    local successful = 0
    local failed = 0

    for _, address in ipairs(data.addresses) do
      -- Validate address format (assuming Arweave address format)
      if type(address) == "string" and #address > 0 then
        if not UnlockedSkin(address) then
          table.insert(Unlocked, address)
          successful = successful + 1
        else
          failed = failed + 1  -- Address already unlocked
        end
      else
        failed = failed + 1  -- Invalid address format
      end
    end

    ao.send({
      Target = msg.From,
      Data = json.encode({
        type = "ok",
        data = json.encode({
          successful = successful,
          failed = failed
        })
      })
    })
  end
)


  -- Function to remove a user from the unlocked list
  function RemoveUserFromUnlocked(userId)
    for index, value in ipairs(Unlocked) do
      if value == userId then
        table.remove(Unlocked, index)
        print("Removed user from Unlocked list: " .. userId)
        return true
      end
    end
    print("User not found in Unlocked list: " .. userId)
    return false
  end
  
  -- Function to remove a user from the UserSkins list
  function RemoveUserSkin(userId)
    if UserSkins[userId] then
      UserSkins[userId] = nil
      print("Removed user's skin: " .. userId)
      return true
    end
    print("User skin not found: " .. userId)
    return false
  end

  -- Function to remove a user's faction
  function RemoveUserFaction(userId)
    if UserFactions[userId] then
      UserFactions[userId] = nil
      print("Removed user's faction: " .. userId)
      return true
    end
    print("User faction not found: " .. userId)
    return false
  end

  -- Function to remove a user's monster
  function RemoveUserMonster(userId)
    if UserMonsters[userId] then
      UserMonsters[userId] = nil
      print("Removed user's monster: " .. userId)
      return true
    end
    print("User monster not found: " .. userId)
    return false
  end
  
  -- Handler for removing a user
  Handlers.add(
    'RemoveUser',
    Handlers.utils.hasMatchingTag('Action', 'RemoveUser'),
    function(msg)
      if not ensureAdmin(msg) then return end
  
      local userId = msg.Tags.UserId
      if not userId then
        ao.send({
          Target = msg.From,
          Data = json.encode({
            type = "error",
            error = "No user ID specified"
          })
        })
        return
      end
  
      local unlockedRemoved = RemoveUserFromUnlocked(userId)
      local skinRemoved = RemoveUserSkin(userId)
      local factionRemoved = RemoveUserFaction(userId)
      local monsterRemoved = RemoveUserMonster(userId)
  
      local result = {
        type = "ok",
        message = "User removal complete",
        unlockedRemoved = unlockedRemoved,
        skinRemoved = skinRemoved,
        factionRemoved = factionRemoved,
        monsterRemoved = monsterRemoved
      }
  
      ao.send({
        Target = msg.From,
        Data = json.encode(result)
      })
    end
  )
  

-- Handler for adopting a monster
Handlers.add(
  'AdoptMonster',
  Handlers.utils.hasMatchingTag('Action', 'AdoptMonster'),
  function(msg)
    print("Adopting monster")
    print("From: " .. msg.From)
    
    -- Check if user has unlock permission
    if not UnlockedSkin(msg.From) then
      print("User " .. msg.From .. " does not have Eternal Pass")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "You do not have Eternal Pass"
        })
      })
      return
    end

    -- Check if user has a faction
    local userFaction = UserFactions[msg.From]
    if not userFaction then
      print("User " .. msg.From .. " does not have a faction")
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "You must join a faction first"
        })
      })
      return
    end

    -- Find faction details
    local factionDetails = nil
    for _, faction in ipairs(AvailableFactions) do
      if faction.name == userFaction.faction then
        factionDetails = faction
        break
      end
    end

    if not factionDetails then
      print("Faction details not found for: " .. userFaction.faction)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Faction details not found"
        })
      })
      return
    end

    -- Create and assign monster with current timestamp
    UserMonsters[msg.From] = CreateDefaultMonster(factionDetails.name, msg.Timestamp)
    
    -- Send confirmation back to the user
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Monster adopted successfully",
        monster = UserMonsters[msg.From]
      })
    })
  end
)

-- Handler to get user's monster
Handlers.add(
  'GetUserMonster',
  Handlers.utils.hasMatchingTag('Action', 'GetUserMonster'),
  function(msg)
    local targetWallet = msg.Tags.Wallet or msg.From
    
    local monster = UserMonsters[targetWallet]
    if not monster then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found for this user"
        })
      })
      return
    end
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        monster = monster
      })
    })
  end
)

-- Function to calculate required exp for next level using Fibonacci sequence starting at 5
function GetRequiredExp(level)
  if level == 0 then return 1 end
  if level == 1 then return 2 end
  
  local a, b = 1, 2
  for i = 2, level do
    local next = a + b
    a = b
    b = next
  end
  return b
end

-- Handler for leveling up monster
Handlers.add(
  "LevelUpMonster",
  Handlers.utils.hasMatchingTag("Action", "LevelUp"),
  function(msg)
    local userId = msg.From
    
    local monster = UserMonsters[userId]
    if not monster then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found"
        })
      })
      return
    end

    local requiredExp = GetRequiredExp(monster.level)
    if monster.exp < requiredExp then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Not enough exp to level up"
        })
      })
      return
    end

    -- Get stat points from message tags
    local attackPoints = tonumber(msg.Tags.AttackPoints) or 0
    local defensePoints = tonumber(msg.Tags.DefensePoints) or 0
    local speedPoints = tonumber(msg.Tags.SpeedPoints) or 0
    local healthPoints = tonumber(msg.Tags.HealthPoints) or 0

    -- Validate total points and max per stat
    local totalPoints = attackPoints + defensePoints + speedPoints + healthPoints
    if totalPoints ~= 10 or 
       attackPoints > 5 or defensePoints > 5 or 
       speedPoints > 5 or healthPoints > 5 then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid stat point allocation"
        })
      })
      return
    end

    -- Level up the monster and apply stat points
    monster.level = monster.level + 1
    monster.exp = monster.exp - requiredExp
    monster.attack = monster.attack + attackPoints
    monster.defense = monster.defense + defensePoints
    monster.speed = monster.speed + speedPoints
    monster.health = monster.health + healthPoints

    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Monster leveled up!",
        monster = monster,
        nextLevelExp = GetRequiredExp(monster.level)
      })
    })
  end
)


-- Helper function to check if an activity is complete
function isActivityComplete(status, currentTime)
  if not status or not status.until_time then
    return false
  end
  return currentTime >= status.until_time
end

-- Handler to get all user information
Handlers.add(
  'GetUserInfo',
  Handlers.utils.hasMatchingTag('Action', 'GetUserInfo'),
  function(msg)
    local targetWallet = msg.Tags.Wallet or msg.From
    local currentTime = msg.Timestamp
    
    -- Get monster info and check activity status
    local monster = UserMonsters[targetWallet]
    local activityStatus = {
      isPlayComplete = false,
      isMissionComplete = false
    }
    
    if monster then
      if monster.status.type == "Play" then
        activityStatus.isPlayComplete = isActivityComplete(monster.status, currentTime)
      elseif monster.status.type == "Mission" then
        activityStatus.isMissionComplete = isActivityComplete(monster.status, currentTime)
      end
    end
    
    -- Collect all user information
    local userInfo = {
      isUnlocked = UnlockedSkin(targetWallet),
      skin = UserSkins[targetWallet] and UserSkins[targetWallet].txId or nil,
      faction = UserFactions[targetWallet] and UserFactions[targetWallet].faction or nil,
      monster = monster,
      activityStatus = activityStatus
    }
    
    ao.send({
      Target = msg.From,
      Action = 'GetUserInfo-Response',
      Tags = {
        UserId = targetWallet
      },
      Data = json.encode(userInfo)
    })
  end
)

-- Handler for admin to set user stats
Handlers.add(
  'SetUserStats',
  Handlers.utils.hasMatchingTag('Action', 'SetUserStats'),
  function(msg)
    if not ensureAdmin(msg) then return end

    local targetWallet = msg.Tags.Wallet
    if not targetWallet then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No target wallet specified"
        })
      })
      return
    end

    local monster = UserMonsters[targetWallet]
    if not monster then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found for this user"
        })
      })
      return
    end

    -- Parse the new stats from the message data
    local newStats = json.decode(msg.Data)
    if not newStats then
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Invalid stats data format"
        })
      })
      return
    end

    -- Update monster stats
    if newStats.level ~= nil then monster.level = newStats.level end
    if newStats.exp ~= nil then monster.exp = newStats.exp end
    if newStats.attack ~= nil then monster.attack = newStats.attack end
    if newStats.defense ~= nil then monster.defense = newStats.defense end
    if newStats.speed ~= nil then monster.speed = newStats.speed end
    if newStats.health ~= nil then monster.health = newStats.health end
    if newStats.energy ~= nil then monster.energy = math.min(100, newStats.energy) end
    if newStats.happiness ~= nil then monster.happiness = math.min(100, newStats.happiness) end
    
    -- Update activities
    if newStats.activities ~= nil then
      print("Updating activities:", json.encode(newStats.activities))
      -- Update mission activity
      if newStats.activities.mission ~= nil then
        if newStats.activities.mission.cost ~= nil then
          if newStats.activities.mission.cost.token ~= nil then
            monster.activities.mission.cost.token = newStats.activities.mission.cost.token
          end
          if newStats.activities.mission.cost.amount ~= nil then
            monster.activities.mission.cost.amount = newStats.activities.mission.cost.amount
          end
        end
        if newStats.activities.mission.duration ~= nil then
          monster.activities.mission.duration = newStats.activities.mission.duration
        end
        if newStats.activities.mission.energyCost ~= nil then
          monster.activities.mission.energyCost = newStats.activities.mission.energyCost
        end
        if newStats.activities.mission.happinessCost ~= nil then
          monster.activities.mission.happinessCost = newStats.activities.mission.happinessCost
        end
      end

      -- Update play activity
      if newStats.activities.play ~= nil then
        if newStats.activities.play.cost ~= nil then
          if newStats.activities.play.cost.token ~= nil then
            monster.activities.play.cost.token = newStats.activities.play.cost.token
          end
          if newStats.activities.play.cost.amount ~= nil then
            monster.activities.play.cost.amount = newStats.activities.play.cost.amount
          end
        end
        if newStats.activities.play.duration ~= nil then
          monster.activities.play.duration = newStats.activities.play.duration
        end
        if newStats.activities.play.energyCost ~= nil then
          monster.activities.play.energyCost = newStats.activities.play.energyCost
        end
        if newStats.activities.play.happinessGain ~= nil then
          monster.activities.play.happinessGain = newStats.activities.play.happinessGain
        end
      end

      -- Update feed activity
      if newStats.activities.feed ~= nil then
        if newStats.activities.feed.cost ~= nil then
          if newStats.activities.feed.cost.token ~= nil then
            monster.activities.feed.cost.token = newStats.activities.feed.cost.token
          end
          if newStats.activities.feed.cost.amount ~= nil then
            monster.activities.feed.cost.amount = newStats.activities.feed.cost.amount
          end
        end
        if newStats.activities.feed.energyGain ~= nil then
          monster.activities.feed.energyGain = newStats.activities.feed.energyGain
        end
      end
    end
    
    -- Update identity and status
    if newStats.faction ~= nil then 
      UserFactions[targetWallet] = { faction = newStats.faction }
    end
    if newStats.image ~= nil then monster.image = newStats.image end
    if newStats.name ~= nil then monster.name = newStats.name end
    if newStats.status ~= nil then
      monster.status = {
        type = newStats.status.type,
        since = newStats.status.since,
        until_time = newStats.status.until_time
      }
    end

    -- Send confirmation back to the admin
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "Monster stats updated successfully",
        monster = monster
      })
    })
  end
)

function AdminSendToBattle(userId)
  local monster = UserMonsters[userId]
      -- Send monster to battle
      ao.send({
        Target = "3ZN5im7LNLjr8cMTXO2buhTPOfw6zz00CZqNyMWeJvs",
        Tags = {
          Action = "BeginBattles",
          UserId = userId
        },
        Data = json.encode(monster)
      })
end


-- Function to adjust activities for all monsters
function adjustAllMonsters()
  -- Map faction names to berry process IDs

  for userId, monster in pairs(UserMonsters) do
    local factionName = UserFactions[userId].faction
    local moves = GetRandomMoves(monstersMAP[factionName].element)
    monster.moves = moves
    monster.name = monstersMAP[factionName].name
    monster.image = monstersMAP[factionName].image
    monster.sprite = monstersMAP[factionName].sprite
    monster.elementType = monstersMAP[factionName].element
    monster.activities = {
      mission = {
        cost = {
          token = "wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ",
          amount = 1
        },
        duration = 3600 * 1000,  -- 1 hour in milliseconds
        energyCost = 25,
        happinessCost = 25
      },
      battle = {
        cost = {
          token = "wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ",
          amount = 1
        },
        energyCost = 25,
        happinessCost = 25
      },
      play = {
        cost = {
          token = monstersMAP[factionName].berry,  -- Use faction's berry type
          amount = 1
        },
        duration = 900 * 1000,  -- 15 minutes in milliseconds
        energyCost = 10,
        happinessGain = 25
      },
      feed = {
        cost = {
          token = monstersMAP[factionName].berry,  -- Use faction's berry type
          amount = 1
        },
        energyGain = 10
      }
    }
  end
end

-- Handler for adjusting all monsters' activities
Handlers.add(
  "AdjustAllMonsters",
  Handlers.utils.hasMatchingTag("Action", "AdjustAllMonsters"),
  function(msg)
    if not ensureAdmin(msg) then return end

    adjustAllMonsters()
    
    ao.send({
      Target = msg.From,
      Data = json.encode({
        status = "success",
        message = "All monsters' activities have been adjusted"
      })
    })
  end
)



-- Handler for returning from battle
Handlers.add(
  "ReturnFromBattle",
  Handlers.utils.hasMatchingTag("Action", "ReturnFromBattle"),
  function(msg)
    if not ensureAdmin(msg) then return end

    print("Returning from battle")
    local userId = msg.Tags.UserId
    
    local monster = UserMonsters[userId]
    if not monster then
      print("No monster found for user:", userId)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "No monster found"
        })
      })
      return
    end

    if monster.status.type ~= "Battle" then
      print("Monster is not on Battle:", monster.status.type)
      ao.send({
        Target = msg.From,
        Data = json.encode({
          status = "error",
          message = "Monster is not on Battle"
        })
      })
      return
    end

    -- Return monster home
    monster.status = {
      type = "Home",
      since = msg.Timestamp,
      until_time = msg.Timestamp
    }

    ao.send({
      Target = userId,
      Data = json.encode({
        status = "success",
        message = "Monster returned from battle",
        monster = monster
      })
    })
  end
)

print("Loaded NEW PremPass.lua")
