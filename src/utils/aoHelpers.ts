import { message as aoMessage, createDataItemSigner, dryrun, result } from "../config/aoConnection";

interface CachedData<T> {
  data: T;
  timestamp: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour in milliseconds

const isCacheValid = (timestamp: number, expirationMs: number = ONE_DAY_MS): boolean => {
  return Date.now() - timestamp < expirationMs;
};

const getCachedData = <T>(key: string, expirationMs: number = ONE_DAY_MS): CachedData<T> | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const parsedCache = JSON.parse(cached) as CachedData<T>;
    if (!parsedCache || !parsedCache.data || !parsedCache.timestamp) {
      localStorage.removeItem(key);
      return null;
    }

    if (!isCacheValid(parsedCache.timestamp, expirationMs)) {
      localStorage.removeItem(key);
      return null;
    }

    console.log(`[Cache] Retrieved data for key ${key}:`, parsedCache);
    return parsedCache;
  } catch (error) {
    console.error(`[Cache] Error retrieving data for key ${key}:`, error);
    localStorage.removeItem(key);
    return null;
  }
};

const setCachedData = <T>(key: string, data: T): void => {
  try {
    if (!data) {
      console.warn(`[Cache] Attempted to cache null/undefined data for key ${key}`);
      return;
    }

    const cacheData: CachedData<T> = {
      data,
      timestamp: Date.now()
    };

    const serialized = JSON.stringify(cacheData);
    localStorage.setItem(key, serialized);
    console.log(`[Cache] Stored data for key ${key}:`, cacheData);
  } catch (error) {
    console.error(`[Cache] Error storing data for key ${key}:`, error);
  }
};
import { 
  AdminSkinChanger, 
  DefaultAtlasTxID, 
  Alter, 
  SUPPORTED_ASSET_IDS, 
  WAITTIMEOUIT, 
  ASSET_INFO, 
  AssetInfo, 
  TARGET_BATTLE_PID,
  MAX_RETRIES,
  RETRY_DELAY,
  type SupportedAssetId
} from "../constants/Constants";
import { ProfileInfo, ProfilesService } from 'ao-process-clients';
import { AssetBalance, BattleManagerInfo, BattleResponse, BattleTurn, FactionOptions, MonsterStats, ResultType, TokenOption, UserInfo, WalletStatus } from "./interefaces";
export type { 
  AssetInfo 
} from '../constants/Constants';

export interface BattleParticipant {
  address: string;
  healthPoints: number;
  health: number;
  shield: number;
  defense: number;
  moves: Record<string, any>;
  name?: string;
}

export interface ActiveBattle {
  id: string;
  challenger: MonsterStats;
  accepter: MonsterStats;
  status: 'active' | 'ended';
  turns: BattleTurn[];
  startTime: number;
  moveCounts: {
    challenger: { [key: string]: number };
    accepter: { [key: string]: number };
  };
}

export type {
  TokenOption,
  MonsterStats,
  BattleManagerInfo,
  FactionOptions,
  ProfileInfo,
  WalletStatus,
  BattleResponse,
  BattleTurn
};

export const getProfileInfo = async (
  address: string | string[],
  useCache: boolean = false
): Promise<ProfileInfo | ProfileInfo[] | null> => {
  try {
    if (Array.isArray(address)) {
      // For arrays, create a cache key using all addresses
      const cacheKey = `getProfileInfo-${address.join('-')}`;
      
      if (useCache) {
        const cached = getCachedData<ProfileInfo[]>(cacheKey);
        if (cached) {
          console.log(`[getProfileInfo] Using cached profiles for:`, address);
          return cached.data;
        }
      }

      console.log(`[getProfileInfo] Fetching profiles for:`, address);
      const profileService = ProfilesService.getInstance();
      try {
        const profileInfos = await profileService.getProfileInfosByWalletAddress(address);
        console.log(`[getProfileInfo] Raw profile infos received:`, profileInfos);
        
        // Validate and sanitize profile infos
        if (!profileInfos || !Array.isArray(profileInfos)) {
          console.warn(`[getProfileInfo] Invalid profile data structure for addresses:`, address);
          return [];
        }

        // Filter out invalid profiles and ensure Profile object exists
        const validProfiles = profileInfos.filter(p => {
          try {
            return p && typeof p === 'object' && p.Profile && 
                   typeof p.Profile === 'object' && 
                   typeof p.Profile.UserName === 'string';
          } catch (e) {
            console.warn(`[getProfileInfo] Invalid profile structure:`, p, e);
            return false;
          }
        });

        if (validProfiles.length > 0) {
          console.log(`[getProfileInfo] Valid profiles found:`, validProfiles);
          setCachedData(cacheKey, validProfiles);
          return validProfiles;
        } else {
          console.warn(`[getProfileInfo] No valid profiles found for addresses:`, address);
          return [];
        }
      } catch (error) {
        console.error(`[getProfileInfo] Error fetching profiles:`, error);
        if (error instanceof SyntaxError) {
          console.error(`[getProfileInfo] JSON parsing error:`, error.message);
        }
        return [];
      }
    } else {
      // For single address
      const cacheKey = `getProfileInfo-${address}`;
      
      if (useCache) {
        const cached = getCachedData<ProfileInfo>(cacheKey);
        if (cached) {
          console.log(`[getProfileInfo] Using cached profile for:`, address);
          return cached.data;
        }
      }

      console.log(`[getProfileInfo] Fetching profile for:`, address);
      const profileService = ProfilesService.getInstance();
      try {
        const profileInfos = await profileService.getProfileInfosByWalletAddress([address]);
        console.log(`[getProfileInfo] Raw profile info received:`, profileInfos);
        
        // Validate array structure
        if (!profileInfos || !Array.isArray(profileInfos)) {
          console.warn(`[getProfileInfo] Invalid profile data structure for address:`, address);
          return null;
        }

        const result = profileInfos[0];
        
        // Validate profile structure
        if (result && typeof result === 'object' && result.Profile && 
            typeof result.Profile === 'object' && 
            typeof result.Profile.UserName === 'string') {
          console.log(`[getProfileInfo] Valid profile found:`, result);
          setCachedData(cacheKey, result);
          return result;
        } else {
          console.warn(`[getProfileInfo] Invalid profile structure for address:`, address, result);
          return null;
        }
      } catch (error) {
        console.error(`[getProfileInfo] Error fetching profile:`, error);
        if (error instanceof SyntaxError) {
          console.error(`[getProfileInfo] JSON parsing error:`, error.message);
        }
        return null;
      }
    }
  } catch (error) {
    console.error(`[getProfileInfo] Error getting profile info:`, error);
    return null;
  }
};

// Wrap the original message function to include refresh callback
export const message = async (params: any, refreshCallback?: () => void) => {
  const response = await aoMessage(params);
  // If a refresh callback is provided, call it immediately after message is sent
  if (refreshCallback) {
    refreshCallback();
  }
  return response;
};


// Check wallet status and current skin
export const checkWalletStatus = async (
  walletInfo?: { address: string },
  useCache: boolean = false
): Promise<WalletStatus> => {
    try {
        const address = walletInfo?.address || await window.arweaveWallet.getActiveAddress();
        const cacheKey = `checkWalletStatus-${address}`;
        
        if (useCache) {
          const cached = getCachedData<WalletStatus>(cacheKey);
          if (cached) {
            console.log(`[checkWalletStatus] Using cached status for:`, address);
            return cached.data;
          }
        }
        
        console.log("Checking wallet status for address:", address);
        const [unlockResult, skinResult, factionResult, monsterResult] = await Promise.all([
            // Check if user is unlocked
            dryrun({
                process: AdminSkinChanger,
                tags: [
                    { name: "Action", value: "CheckUnlocked" },
                    { name: "Address", value: address }
                ],
                data: ""
            }),
            // Check skin
            dryrun({
                process: AdminSkinChanger,
                tags: [
                    { name: "Action", value: "CheckSkin" },
                    { name: "Address", value: address }
                ],
                data: ""
            }),
            // Check faction
            dryrun({
                process: AdminSkinChanger,
                tags: [
                    { name: "Action", value: "CheckFaction" },
                    { name: "Address", value: address }
                ],
                data: ""
            }),
            // Get monster status
            dryrun({
                process: AdminSkinChanger,
                tags: [
                    { name: "Action", value: "GetUserMonster" },
                    { name: "Wallet", value: address }
                ],
                data: ""
            })
        ]) as [ResultType, ResultType, ResultType, ResultType];

        if (!unlockResult.Messages || unlockResult.Messages.length === 0) {
            throw new Error("No response from CheckUnlocked");
        }

        const response = JSON.parse(unlockResult.Messages[0].Data);
        const isUnlocked = response.type === "ok" ? 
            JSON.parse(response.data).result : 
            response.result === true;

        // Process skin
        const skinTxId = skinResult.Messages && skinResult.Messages.length > 0 ?
            (skinResult.Messages[0].Data === "None" ? null : skinResult.Messages[0].Data) :
            null;

        // Process faction
        const faction = factionResult.Messages && factionResult.Messages.length > 0 ?
            (factionResult.Messages[0].Data === "None" ? null : factionResult.Messages[0].Data) :
            null;

        // Process monster
        let monster = null;
        if (monsterResult.Messages && monsterResult.Messages.length > 0) {
            const monsterResponse = JSON.parse(monsterResult.Messages[0].Data);
            if (monsterResponse.status === "success") {
                monster = monsterResponse.monster;
            }
        }

        const status = {
            isUnlocked,
            currentSkin: skinTxId,
            faction: faction,
            monster: monster,
            contractIcon: "hqg-Em9DdYHYmMysyVi8LuTGF8IF_F7ZacgjYiSpj0k",
            contractName: "Sprite Customizer"
        };
        
        // Cache the result
        setCachedData(cacheKey, status);
        return status;
    } catch (error) {
        console.error("Error checking wallet status:", error);
        return {
            isUnlocked: false,
            currentSkin: null,
            faction: null,
            monster: null,
            error: "Failed to check wallet status"
        };
    }
};

// Update user's skin
export const updateUserSkin = async (wallet: any, spriteTxId: string, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Updating skin for wallet:", wallet.address);
        
        // First check if user is authorized
        const status = await checkWalletStatus(wallet);
        if (!status.isUnlocked) {
            throw new Error("You do not have skin changing ability unlocked.");
        }

        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "UpdateSkin" },
                { name: "SpriteTxId", value: spriteTxId },
                { name: "SpriteAtlasTxId", value: DefaultAtlasTxID }
            ],
            signer: createDataItemSigner(wallet),
            data: ""
        }, refreshCallback);

        console.log("UpdateSkin response:", messageResult);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from UpdateSkin");
        }

        return transferResult.Messages[0].Data;
    } catch (error) {
        console.error("Error in updateUserSkin:", error);
        throw error;
    }
};

export const setFaction = async (wallet: any, faction: string, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Setting faction for wallet:", wallet.address);
        
        // First check if user is authorized
        const status = await checkWalletStatus(wallet);
        if (!status.isUnlocked) {
            throw new Error("You do not have Eternal Pass.");
        }
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "SetFaction" },
                { name: "Faction", value: faction },
            ],
            signer,
            data: ""
        }, refreshCallback);

        console.log("SetFaction response:", messageResult);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from SetFaction");
        }

        return transferResult.Messages[0].Data;
    } catch (error) {
        console.error("Error in setFaction:", error);
        throw error;
    }
};

// Get purchase schema
export const getPurchaseSchema = async (wallet: any) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Getting purchase schema for wallet:", wallet.address);
        
        const dryRunResult = await dryrun({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "SchemaExternal" }
            ],
            data: ""
        }) as ResultType;

        console.log("SchemaExternal response:", dryRunResult);

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            throw new Error("No response from SchemaExternal");
        }

        return JSON.parse(dryRunResult.Messages[0].Data);
    } catch (error) {
        console.error("Error in getPurchaseSchema:", error);
        throw error;
    }
};

// Get available purchase options
export const getPurchaseOptions = async (): Promise<TokenOption[]> => {
    try {
        console.log("Getting purchase options");
        
        const dryRunResult = await dryrun({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "GetPurchaseOptions" }
            ],
            data: ""
        }) as ResultType;

        console.log("GetPurchaseOptions response:", dryRunResult);

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            throw new Error("No response from GetPurchaseOptions");
        }

        const response = JSON.parse(dryRunResult.Messages[0].Data);
        console.log("Parsed response:", response);

        // The contract returns { result: [...tokens] }
        const options = response.result;
        
        if (!Array.isArray(options)) {
            console.error("Invalid options format:", options);
            throw new Error("Invalid purchase options format");
        }

        return options.map((option: any) => ({
            token: option.token,
            amount: option.amount,
            name: option.name,
            icon: option.icon,
            denomination: option.denomination || 0 // fallback to 0 if not specified
        }));
    } catch (error) {
        console.error('Error getting purchase options:', error);
        throw error;
    }
};

export const getFactionOptions = async (useCache: boolean = false): Promise<FactionOptions[]> => {
    try {
        console.log("Getting faction options");
        
        const cacheKey = 'getFactionOptions';
        
        if (useCache) {
            const cached = getCachedData<FactionOptions[]>(cacheKey, ONE_HOUR_MS);
            if (cached) {
                console.log(`[getFactionOptions] Using cached factions`);
                return cached.data;
            }
        }
        
        const dryRunResult = await dryrun({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "GetFactions" }
            ],
            data: ""
        }) as ResultType;

        console.log("GetFactions response:", dryRunResult);

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            throw new Error("No response from GetFactions");
        }

        const response = JSON.parse(dryRunResult.Messages[0].Data);
        console.log("Parsed response:", response);

        // The contract returns { result: [...tokens] }
        const options = response.result;
        
        if (!Array.isArray(options)) {
            console.error("Invalid options format:", options);
            throw new Error("Invalid purchase options format");
        }

        const mappedOptions = options.map((option: any) => {
            console.log(`Faction ${option.name} members:`, option.members);
            console.log(`Faction ${option.name} average monster level:`, option.averageLevel);
            return {
                name: option.name,
                description: option.description,
                mascot: option.mascot,
                perks: option.perks,
                memberCount: Number(option.memberCount) || 0,
                monsterCount: Number(option.monsterCount) || 0,
                members: option.members,
                averageLevel: Number(option.averageLevel) || 0,
                totalTimesFed: Number(option.totalTimesFed) || 0,
                totalTimesPlay: Number(option.totalTimesPlay) || 0,
                totalTimesMission: Number(option.totalTimesMission) || 0
            };
        });
        
        // Cache the mapped options
        if (mappedOptions.length > 0) {
            setCachedData(cacheKey, mappedOptions);
        }
        
        return mappedOptions;
    } catch (error) {
        console.error('Error getting purchase options:', error);
        throw error;
    }
};

export const formatTokenAmount = (amount: string, denomination: number): string => {
    // Convert amount to number
    const numAmount = parseFloat(amount);
    // Divide by 10^denomination
    const formattedAmount = (numAmount / Math.pow(10, denomination)).toFixed(denomination);
    // Remove trailing zeros after decimal point, but ensure 0 is displayed instead of empty string
    const result = formattedAmount.replace(/\.?0+$/, '');
    return result === '' ? '0' : result;
};

// Purchase access
export const purchaseAccess = async (selectedToken: TokenOption, refreshCallback?: () => void): Promise<boolean> => {
    try {
        console.log("Initiating purchase with token:", selectedToken);

        if (!window.arweaveWallet) {
            throw new Error("Arweave wallet not found");
        }

        const signer = createDataItemSigner(window.arweaveWallet);
        console.log("Created signer for wallet");

        // Check for referrer cookie
        const referrer = document.cookie
            .split('; ')
            .find(row => row.startsWith('X-Referer='))
            ?.split('=')[1];

        // Prepare tags for the message
        const tags = [
            { name: "Action", value: "Transfer" },
            { name: "Quantity", value: selectedToken.amount },
            { name: "Recipient", value: AdminSkinChanger }
        ];

        // Add referrer tag if exists
        if (referrer) {
            tags.push({ name: "X-Referer", value: referrer });
        }

        // Send the transfer message
        const messageResult = await message({
            process: selectedToken.token, // Token contract
            tags,
            signer,
            data: "" // Empty data for transfer
        }, refreshCallback);

        console.log("Transfer message sent:", messageResult);

        // Wait for the result
        const transferResult = await result({
            message: messageResult,
            process: selectedToken.token
        }) as ResultType;

        console.log("Transfer result:", transferResult);

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from transfer");
        }

        // Check for error in the response
        for (const msg of transferResult.Messages) {
            const errorTag = msg.Tags?.find(tag => tag.name === "Error");
            if (errorTag) {
                throw new Error(errorTag.value);
            }

            // Check for successful transfer (Debit-Notice or Credit-Notice)
            const actionTag = msg.Tags?.find(tag => tag.name === "Action");
            if (actionTag && (actionTag.value === "Debit-Notice" || actionTag.value === "Credit-Notice")) {
                return true;
            }
        }

        // If we get here without finding success or error, something went wrong
        throw new Error("Transfer failed - no success confirmation received");

    } catch (error) {
        console.error("Error during purchase:", error);
        throw error;
    }
};

export interface BulkImportResult {
    successful: number;
    failed: number;
}

interface BulkImportRequest {
    function: string;
    addresses: string[];
}

export const bulkImportAddresses = async (data: BulkImportRequest, refreshCallback?: () => void): Promise<BulkImportResult> => {
    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        console.log("Created signer for wallet");

        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "BulkImportAddresses" }
            ],
            data: JSON.stringify(data),
            signer
        }, refreshCallback);
        console.log(messageResult);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from BulkImportAddresses");
        }

        const resultData = JSON.parse(transferResult.Messages[0].Data);
        return resultData;
    } catch (error) {
        console.error("Error importing addresses:", error);
        throw error;
    }
};

// Remove user access
// Adopt a monster
export const adoptMonster = async (wallet: any, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Adopting monster for wallet:", wallet.address);
        
        // First check if user is authorized
        const status = await checkWalletStatus(wallet);
        if (!status.isUnlocked) {
            throw new Error("You do not have Eternal Pass.");
        }
        if (!status.faction) {
            throw new Error("You must join a faction first.");
        }

        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "AdoptMonster" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        console.log("AdoptMonster response:", messageResult);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from AdoptMonster");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error in adoptMonster:", error);
        throw error;
    }
};

// Get user's monster
export const getUserMonster = async (wallet: any, useCache: boolean = false): Promise<MonsterStats | null> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Getting monster for wallet:", wallet.address);
        const cacheKey = `getUserMonster-${wallet.address}`;

        if (useCache) {
            const cached = getCachedData<MonsterStats>(cacheKey);
            if (cached) {
                console.log(`[getUserMonster] Using cached monster for:`, wallet.address);
                return cached.data;
            }
        }

        const dryRunResult = await dryrun({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "GetUserMonster" },
                { name: "Wallet", value: wallet.address }
            ],
            data: ""
        }) as ResultType;

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            return null;
        }

        const response = JSON.parse(dryRunResult.Messages[0].Data);
        const monster = response.status === "success" ? response.monster : null;

        if (monster) {
            setCachedData(cacheKey, monster);
        }

        return monster;
    } catch (error) {
        console.error("Error in getUserMonster:", error);
        return null;
    }
};

// Helper to create a timeout for promises
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> => {
    return Promise.race([
        promise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))
    ]);
};

/**
 * Retry a function with timeout and exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param timeout Timeout for each attempt in ms
 * @param delayMs Delay between retries in ms
 */
const retryWithTimeout = async <T>(
    fn: () => Promise<T>, 
    maxRetries: number = MAX_RETRIES, 
    timeout: number = WAITTIMEOUIT, 
    delayMs: number = RETRY_DELAY
): Promise<T | null> => {
    let retries = 0;
    
    while (retries <= maxRetries) {
        try {
            // If not the first attempt, log that we're retrying
            if (retries > 0) {
                console.log(`Retry attempt ${retries}/${maxRetries}`);
            }
            
            // Attempt with timeout
            const result = await withTimeout(fn(), timeout);
            
            // If successful, return the result
            if (result !== null) {
                if (retries > 0) {
                    console.log(`Succeeded after ${retries} retry attempts`);
                }
                return result;
            }
            
            // If we get here, it's because of a timeout
            console.warn(`Attempt ${retries + 1} timed out after ${timeout}ms`);
            
            // If we've reached max retries, return null
            if (retries >= maxRetries) {
                console.warn(`Max retries (${maxRetries}) reached, giving up`);
                return null;
            }
            
            // Wait before next retry
            console.log(`Waiting ${delayMs}ms before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Increment retry counter
            retries++;
        } catch (error) {
            console.error(`Error during retry attempt ${retries}:`, error);
            
            // If we've reached max retries, throw the error
            if (retries >= maxRetries) {
                console.warn(`Max retries (${maxRetries}) reached, giving up`);
                return null;
            }
            
            // Wait before next retry
            await new Promise(resolve => setTimeout(resolve, delayMs));
            
            // Increment retry counter
            retries++;
        }
    }
    
    return null;
};

// Cache info for 1 week (in milliseconds)
const INFO_CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

// Get cached asset info from localStorage
const getCachedAssetInfo = (processId: string): AssetInfo | null => {
    try {
        const cached = localStorage.getItem(`asset_info_${processId}`);
        if (!cached) return null;

        const parsedCache = JSON.parse(cached);
        if (!parsedCache || !parsedCache.data || !parsedCache.timestamp) {
            localStorage.removeItem(`asset_info_${processId}`);
            return null;
        }

        // Check if cache is still valid (1 week)
        if (Date.now() - parsedCache.timestamp > INFO_CACHE_DURATION) {
            localStorage.removeItem(`asset_info_${processId}`);
            return null;
        }

        console.log(`[Cache] Using cached asset info for ${processId}`);
        return parsedCache.data;
    } catch (error) {
        console.error(`Error retrieving cached asset info for ${processId}:`, error);
        localStorage.removeItem(`asset_info_${processId}`);
        return null;
    }
};

// Store asset info in localStorage
const cacheAssetInfo = (processId: string, info: AssetInfo): void => {
    try {
        if (!info) return;

        const cacheData = {
            data: info,
            timestamp: Date.now()
        };

        localStorage.setItem(`asset_info_${processId}`, JSON.stringify(cacheData));
        console.log(`[Cache] Stored asset info for ${processId}`);
    } catch (error) {
        console.error(`Error caching asset info for ${processId}:`, error);
    }
};

/**
 * Get asset balances with incremental loading and caching of asset info
 * @param wallet Wallet object
 * @param onAssetLoaded Optional callback that gets called whenever an asset is loaded
 * @returns Promise with array of loaded assets
 */
export const getAssetBalances = async (
    wallet: any,
    onAssetLoaded?: (asset: AssetBalance) => void
): Promise<AssetBalance[]> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Getting asset balances for wallet:", wallet.address);
        
        // Tracking cache of already loaded assets
        const loadedAssets = new Map<string, AssetBalance>();
        const results: AssetBalance[] = [];

        // Process a loaded asset - add to results and call callback if provided
        const processLoadedAsset = (asset: AssetBalance) => {
            const processId = asset.info.processId;
            
            // Check if we already have this asset
            if (loadedAssets.has(processId)) {
                const existing = loadedAssets.get(processId)!;
                
                // Always update with latest info and balance
                const updatedAsset = {
                    info: { ...existing.info, ...asset.info },
                    balance: asset.balance
                };
                
                // Update in our map
                loadedAssets.set(processId, updatedAsset);
                
                // Always call the callback when balance changes
                if (onAssetLoaded && existing.balance !== asset.balance) {
                    onAssetLoaded(updatedAsset);
                    console.log(`Asset ${asset.info.name} balance updated: ${asset.balance}`);
                }
            } else {
                // New asset, add it to our collections
                loadedAssets.set(processId, asset);
                results.push(asset);
                
                // Call the callback for new assets
                if (onAssetLoaded) {
                    onAssetLoaded(asset);
                }
                
                console.log(`Asset ${asset.info.name} (${asset.info.ticker}) loaded: ${asset.balance}`);
            }
        };
        
        // Function to fetch asset info only (without balance)
        const fetchAssetInfo = async (processId: SupportedAssetId): Promise<AssetInfo | null> => {
            try {
                // Try to get predefined asset info first (fastest path)
                const predefinedInfo = ASSET_INFO[processId];
                if (predefinedInfo) {
                    console.log(`Using predefined info for asset ${processId}`);
                    return predefinedInfo;
                }
                
                // Try to get cached asset info next (fast path)
                const cachedInfo = getCachedAssetInfo(processId);
                if (cachedInfo) {
                    console.log(`Using cached info for asset ${processId}`);
                    return cachedInfo;
                }
                
                // Finally, fetch asset info from contract
                console.log(`Fetching info for asset ${processId} from contract`);
                const infoResult = await dryrun({
                    process: processId,
                    tags: [{ name: "Action", value: "Info" }],
                    data: ""
                });
                
                // Extract asset info from response
                if (infoResult.Messages && infoResult.Messages.length > 0) {
                    const infoTags = infoResult.Messages[0].Tags;
                    const logo = infoTags.find(t => t.name === "Logo")?.value;
                    const name = infoTags.find(t => t.name === "Name")?.value;
                    const ticker = infoTags.find(t => t.name === "Ticker")?.value;
                    const denomination = parseInt(infoTags.find(t => t.name === "Denomination")?.value || "0");

                    if (!logo || !name || !ticker) {
                        console.warn(`Missing required info for asset ${processId}`);
                        return null;
                    }

                    const assetInfo: AssetInfo = { 
                        processId, 
                        logo, 
                        name, 
                        ticker, 
                        denomination: denomination || 0 
                    };
                    
                    // Cache the asset info
                    cacheAssetInfo(processId, assetInfo);
                    
                    return assetInfo;
                } else {
                    console.warn(`No info messages for asset ${processId}`);
                    return null;
                }
            } catch (error) {
                console.error(`Error fetching info for asset ${processId}:`, error);
                return null;
            }
        };

        // Function to fetch asset balance only
        const fetchAssetBalance = async (processId: SupportedAssetId, assetInfo: AssetInfo): Promise<AssetBalance | null> => {
            try {
                console.log(`Fetching balance for asset ${processId}`);
                const balanceResult = await dryrun({
                    process: processId,
                    tags: [{ name: "Action", value: "Balances" }],
                    data: ""
                });
                
                // Parse balance
                let balance = 0;
                if (balanceResult.Messages && balanceResult.Messages.length > 0) {
                    try {
                        const balanceData = JSON.parse(balanceResult.Messages[0].Data);
                        balance = parseInt(balanceData[wallet.address] || "0");
                    } catch (e) {
                        console.error(`Error parsing balance for ${processId}:`, e);
                    }
                }

                // Create the complete asset balance object
                const assetBalance: AssetBalance = {
                    info: assetInfo,
                    balance
                };
                
                return assetBalance;
            } catch (error) {
                console.error(`Error fetching balance for ${processId}:`, error);
                return null;
            }
        };

        // Function to fetch a single asset (info + balance) with retry logic
        const fetchAsset = async (processId: SupportedAssetId): Promise<AssetBalance | null> => {
            try {
                // If the asset is already in our known assets cache, skip it
                if (loadedAssets.has(processId)) {
                    return null;
                }
                
                try {
                    // First get asset info - try to use cache, predefined values, or fetch from contract
                    const assetInfo = await fetchAssetInfo(processId);
                    if (!assetInfo) {
                        console.warn(`Could not get info for asset ${processId}`);
                        return null;
                    }
                    
                    // Create a initial asset with the info and zero balance
                    // This allows the UI to show the asset info immediately while balance loads
                    const initialAsset: AssetBalance = {
                        info: assetInfo,
                        balance: 0
                    };
                    
                    // Process the asset with info but potentially missing balance
                    processLoadedAsset(initialAsset);
                    
                    // Then get the balance
                    const assetWithBalance = await fetchAssetBalance(processId, assetInfo);
                    if (assetWithBalance) {
                        // Update with the real balance - force the balance to be a number 
                        // (in case there was a string parsing issue)
                        const finalAsset = {
                            info: assetInfo,
                            balance: Number(assetWithBalance.balance)
                        };
                        
                        // Update with the real balance
                        processLoadedAsset(finalAsset);
                        return finalAsset;
                    }
                    
                    return initialAsset;
                } catch (error) {
                    console.error(`Error processing asset ${processId}:`, error);
                    return null;
                }
            } catch (error) {
                console.error(`Error loading asset ${processId}:`, error);
                return null;
            }
        };

        // Function to retry loading failed assets
        const retryFailedAssets = async (failedAssetIds: string[], retries: number = 1) => {
            if (failedAssetIds.length === 0 || retries > MAX_RETRIES) return;
            
            console.log(`Retry #${retries} for ${failedAssetIds.length} assets: ${failedAssetIds.join(', ')}`);
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            
            // Try to fetch these assets again
            const retryPromises = failedAssetIds.map(id => fetchAsset(id as SupportedAssetId));
            const retryResults = await Promise.all(retryPromises);
            
            // Collect failed assets for next retry round
            const stillFailed = failedAssetIds.filter((_, i) => retryResults[i] === null);
            
            // Recursively retry remaining failed assets
            if (stillFailed.length > 0 && retries < MAX_RETRIES) {
                await retryFailedAssets(stillFailed, retries + 1);
            }
        };

        // Initial attempt to fetch all assets
        const assetPromises = SUPPORTED_ASSET_IDS.map(fetchAsset);
        const initialResults = await Promise.all(assetPromises);
        
        // Determine which assets failed to load in the first attempt
        const failedAssetIds = SUPPORTED_ASSET_IDS.filter((id, i) => 
            initialResults[i] === null && !loadedAssets.has(id)
        );
        
        // Retry failed assets
        if (failedAssetIds.length > 0) {
            await retryFailedAssets(failedAssetIds);
        }

        return Array.from(loadedAssets.values());
    } catch (error) {
        console.error("Error getting asset balances:", error);
        return [];
    }
};



export interface MonsterStatsUpdate {
  level?: number;
  exp?: number;
  attack?: number;
  defense?: number;
  speed?: number;
  health?: number;
  energy?: number;
  happiness?: number;
  faction?: string;
  image?: string;
  name?: string;
  status?: {
    type: 'Home' | 'Play' | 'Mission';
    since: number;
    until_time: number;
  };
  activities?: {
    mission?: {
      cost?: {
        token?: string;
        amount?: number;
      };
      duration?: number;
      energyCost?: number;
      happinessCost?: number;
    };
    play?: {
      cost?: {
        token?: string;
        amount?: number;
      };
      duration?: number;
      energyCost?: number;
      happinessGain?: number;
    };
    feed?: {
      cost?: {
        token?: string;
        amount?: number;
      };
      energyGain?: number;
    };
  };
}

export const setUserStats = async (targetWallet: string, stats: MonsterStatsUpdate, refreshCallback?: () => void): Promise<boolean> => {
  try {
    console.log('Setting user stats with data:', JSON.stringify(stats, null, 2));
    const signer = createDataItemSigner(window.arweaveWallet);
    const messageResult = await message({
      process: AdminSkinChanger,
      tags: [
        { name: "Action", value: "SetUserStats" },
        { name: "Wallet", value: targetWallet }
      ],
      data: JSON.stringify(stats),
      signer
    }, refreshCallback);

    const transferResult = await result({
      message: messageResult,
      process: AdminSkinChanger
    }) as ResultType;

    if (!transferResult.Messages || transferResult.Messages.length === 0) {
      throw new Error("No response from SetUserStats");
    }

    const response = JSON.parse(transferResult.Messages[0].Data);
    return response.status === "success";
  } catch (error) {
    console.error("Error setting user stats:", error);
    throw error;
  }
};


// Execute a battle in the current session
export const executeBattle = async (wallet: any, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Executing battle for wallet:", wallet.address);
        
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "Battle" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from battle execution");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error executing battle:", error);
        throw error;
    }
};

export const getUserInfo = async (walletAddress: string): Promise<UserInfo | null> => {
    try {
        const dryRunResult = await dryrun({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "GetUserInfo" },
                { name: "Wallet", value: walletAddress }
            ],
            data: ""
        }) as ResultType;

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            return null;
        }

        return JSON.parse(dryRunResult.Messages[0].Data);
    } catch (error) {
        console.error("Error getting user info:", error);
        return null;
    }
};

export const removeUser = async (userId: string, refreshCallback?: () => void) => {
    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "RemoveUser" },
                { name: "UserId", value: userId }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from RemoveUser");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error removing user:", error);
        throw error;
    }
};

export interface OfferingStats {
    ["Sky Nomads"]: number;
    ["Aqua Guardians"]: number;
    ["Stone Titans"]: number;
    ["Inferno Blades"]: number;
}

export const defaultInteraction = async (wallet: any, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: Alter,
            tags: [
                { name: "Action", value: "DefaultInteraction" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: Alter
        }) as ResultType;

        // DefaultInteraction doesn't return a response, it just triggers the interaction
        return { status: "success" };
    } catch (error) {
        console.error("Error in defaultInteraction:", error);
        throw error;
    }
};

export const getTotalOfferings = async (): Promise<OfferingStats> => {
    try {
        const dryRunResult = await dryrun({
            process: Alter,
            tags: [
                { name: "Action", value: "GetTotalOfferings" }
            ],
            data: ""
        }) as ResultType;

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            throw new Error("No response from GetTotalOfferings");
        }

        return JSON.parse(dryRunResult.Messages[0].Data);
    } catch (error) {
        console.error("Error getting total offerings:", error);
        throw error;
    }
};

export interface OfferingData {
    LastOffering: number;
    IndividualOfferings: number;
    Streak: number;
}

export const getUserOfferings = async (userId: string): Promise<OfferingData | null> => {
    try {
        const dryRunResult = await dryrun({
            process: Alter,
            tags: [
                { name: "Action", value: "GetUserOfferings" },
                { name: "UserId", value: userId }
            ],
            data: ""
        }) as ResultType;

        if (!dryRunResult.Messages || dryRunResult.Messages.length === 0) {
            return null;
        }

        const result = JSON.parse(dryRunResult.Messages[0].Data);
        if (result && typeof result === 'object' && 'LastOffering' in result) {
            return result as OfferingData;
        }
        return null;
    } catch (error) {
        console.error("Error getting user offerings:", error);
        return null;
    }
};

export const adjustAllMonsters = async (refreshCallback?: () => void): Promise<boolean> => {
    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: AdminSkinChanger,
            tags: [
                { name: "Action", value: "AdjustAllMonsters" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: AdminSkinChanger
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from AdjustAllMonsters");
        }

        const response = JSON.parse(transferResult.Messages[0].Data);
        return response.status === "success";
    } catch (error) {
        console.error("Error adjusting all monsters:", error);
        throw error;
    }
};

// Generate a referral link for the current user
export const generateReferralLink = async (): Promise<string> => {
    if (!window.arweaveWallet) {
        throw new Error("Arweave wallet not found");
    }
    
    const address = await window.arweaveWallet.getActiveAddress();
    const baseUrl = window.location.origin;
    return `${baseUrl}?ref=${address}`;
};

// Handle referral link parameters and set cookie
export const handleReferralLink = (): void => {
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = urlParams.get('ref');
    
    if (referrer) {
        // Set cookie to expire in 24 hours
        const expirationDate = new Date();
        expirationDate.setTime(expirationDate.getTime() + (24 * 60 * 60 * 1000));
        
        document.cookie = `X-Referer=${referrer}; expires=${expirationDate.toUTCString()}; path=/`;
    }
};

// Copy referral link to clipboard
export const copyReferralLink = async (): Promise<void> => {
    const link = await generateReferralLink();
    await navigator.clipboard.writeText(link);
};

// Admin force return from battle
export const adminReturnFromBattle = async (targetWallet: string, refreshCallback?: () => void): Promise<boolean> => {
    try {
        console.log('[adminReturnFromBattle] Forcing return for wallet:', targetWallet);
        
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "AdminReturnFromBattle" },
                { name: "UserId", value: targetWallet }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        console.log('[adminReturnFromBattle] Result:', transferResult);

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from AdminReturnFromBattle");
        }

        const response = JSON.parse(transferResult.Messages[0].Data);
        return response.status === "success";
    } catch (error) {
        console.error("Error forcing return from battle:", error);
        throw error;
    }
};


// Get user's battle status
export const getBattleManagerInfo = async (walletAddress: string): Promise<BattleManagerInfo | null> => {
    try {
        console.log('[getBattleManagerInfo] Checking battle manager info for wallet:', walletAddress);
        const result = await dryrun({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "GetBattleManagerInfo" },
                { name: "UserId", value: walletAddress }
            ],
            data: ""
        });
        console.log(result)

        if (!result.Messages || result.Messages.length === 0) {
            console.log('[getBattleManagerInfo] No messages in response');
            return null;
        }

        console.log('[getBattleManagerInfo] Message data:', result.Messages[0].Data);
        const response = JSON.parse(result.Messages[0].Data);
        console.log('[getBattleManagerInfo] Parsed response:', response);

        if (response.status === 'success' && response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        console.error('Error getting battle manager info:', error);
        return null;
    }
};

// Get active battle
export const getActiveBattle = async (walletAddress: string): Promise<ActiveBattle | null> => {
    try {
        const result = await dryrun({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "GetOpenBattle" },
                { name: "UserId", value: walletAddress }
            ],
            data: ""
        });
        console.log(result)

        if (!result.Messages || result.Messages.length === 0) {
            return null;
        }

        const response = JSON.parse(result.Messages[0].Data);
        console.log(response)
        if (response.status === 'success' && response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        console.error('Error getting active battle:', error);
        return null;
    }
};

// Get active battle
export const getUserActiveBattles = async (walletAddress: string): Promise<ActiveBattle | null> => {
    try {
        const result = await dryrun({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "GetUserOpenBattles" },
                { name: "UserId", value: walletAddress }
            ],
            data: ""
        });
        console.log(result)

        if (!result.Messages || result.Messages.length === 0) {
            return null;
        }

        const response = JSON.parse(result.Messages[0].Data);
        console.log(response)
        if (response.status === 'success' && response.data) {
            return response.data;
        }

        return null;
    } catch (error) {
        console.error('Error getting active battle:', error);
        return null;
    }
};

// Start a battle session
export const startBattle = async (wallet: any, refreshCallback?: () => void) => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        console.log("Starting battle for wallet:", wallet.address);
        
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "BeginBattles" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from battle start");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error starting battle:", error);
        throw error;
    }
};

// Enter a battle
export const enterBattle = async (
    wallet: any, 
    options?: { 
        challenge?: string, // "OPEN" for open challenge, wallet address for targeted challenge
        accept?: string    // wallet address of challenger to accept their battle
    }, 
    refreshCallback?: () => void
): Promise<BattleResponse> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const tags = [{ name: "Action", value: "Battle" }];

        // Add challenge tag if specified
        if (options?.challenge) {
            tags.push({ name: "challenge", value: options.challenge });
        }

        // Add accept tag if specified
        if (options?.accept) {
            tags.push({ name: "accept", value: options.accept });
        }

        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags,
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from battle");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error entering battle:", error);
        throw error;
    }
};

// Return from battle session
export const returnFromBattle = async (wallet: any, refreshCallback?: () => void): Promise<BattleResponse> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "ReturnFromBattle" }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from return from battle");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error returning from battle:", error);
        throw error;
    }
};

// Execute an attack in battle
export const executeAttack = async (wallet: any, battleId: string, moveName: string, refreshCallback?: () => void): Promise<BattleResponse> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "Attack" },
                { name: "BattleId", value: battleId },
                { name: "Move", value: moveName }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from attack");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error executing attack:", error);
        throw error;
    }
};


// End a battle
export const endBattle = async (wallet: any, battleId: string, refreshCallback?: () => void): Promise<BattleResponse> => {
    if (!wallet?.address) {
        throw new Error("No wallet connected");
    }

    try {
        const signer = createDataItemSigner(window.arweaveWallet);
        const messageResult = await message({
            process: TARGET_BATTLE_PID,
            tags: [
                { name: "Action", value: "EndBattle" },
                { name: "BattleId", value: battleId }
            ],
            signer,
            data: ""
        }, refreshCallback);

        const transferResult = await result({
            message: messageResult,
            process: TARGET_BATTLE_PID
        }) as ResultType;

        if (!transferResult.Messages || transferResult.Messages.length === 0) {
            throw new Error("No response from end battle");
        }

        return JSON.parse(transferResult.Messages[0].Data);
    } catch (error) {
        console.error("Error ending battle:", error);
        throw error;
    }
};

export interface LootBoxResponse {
  result: any;
}

/**
 * Get user's loot boxes
 * @param userId User's ID (wallet address)
 * @returns Promise with loot box information
 */
export const getLootBoxes = async (userId: string): Promise<LootBoxResponse | null> => {
  if (!userId) {
    console.error('[getLootBoxes] No user ID provided');
    return null;
  }

  try {
    console.log('[getLootBoxes] Getting loot boxes for user:', userId);
    
    const result: any = await dryrun({
        process: AdminSkinChanger,
        tags: [
            { name: 'Action', value: 'GetLootBox' },
            { name: 'UserId', value: userId }
        ]
    });
    console.log(result)
    console.log(result?.Messages?.[0]?.Data)

    if (result?.Messages?.[0]?.Data) {
      try {
        const parsed = JSON.parse(result.Messages[0].Data);
        console.log('[getLootBoxes] Parsed loot boxes:', parsed);
        
        // Format the response properly
        return {
          result: parsed
        };
      } catch (error) {
        console.error('[getLootBoxes] Error parsing response:', error);
        return null;
      }
    }
    
    console.warn('[getLootBoxes] No valid response data');
    return null;
  } catch (error) {
    console.error('[getLootBoxes] Error getting loot boxes:', error);
    return null;
  }
};

/**
 * Open a loot box
 * @param wallet User's wallet
 * @param refreshCallback Optional callback to refresh UI after opening
 * @returns Promise with loot box results
 */
export const openLootBox = async (wallet: any, refreshCallback?: () => void): Promise<LootBoxResponse | null> => {
    if (!wallet?.address) {
      console.error('[openLootBox] No wallet address provided');
      return null;
    }
  
    try {
      console.log('[openLootBox] Opening loot box for user:', wallet.address);
      const signer = createDataItemSigner(window.arweaveWallet);
  
      // Send your message
      const messageresult: any = await message({
        process: AdminSkinChanger,
        tags: [
          { name: 'Action', value: 'OpenLootBox' },
          { name: 'From', value: wallet.address }
        ],
        signer
      });
      console.log(messageresult);
      
      // Get the result object
      const boxResult = await result({
        message: messageresult,
        process: AdminSkinChanger
      }) as ResultType;
  
      console.log(boxResult);
  
      // Grab the last message in the array (if any)
      if (boxResult?.Messages && boxResult.Messages.length > 0) {
        const lastMessage = boxResult.Messages[boxResult.Messages.length - 1];
        
        if (lastMessage?.Data) {
          try {
            // Parse the last message's Data
            const parsedData = JSON.parse(lastMessage.Data);
  
            console.log('[openLootBox] Loot box opened successfully:', parsedData);
  
            // Return it in a shape that allows usage like result[0].token
            // If your parsedData has a top-level "result" array, you can pass that through:
            return {
              result: parsedData.result
            };
          } catch (error) {
            console.error('[openLootBox] Error parsing the last message data:', error);
            return null;
          }
        }
      }
  
      console.warn('[openLootBox] No valid response data found in the last message');
      return null;
      
    } catch (error) {
      console.error('[openLootBox] Error opening loot box:', error);
      return null;
    }
  };
