import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { getFactionOptions, purchaseAccess, TokenOption, adoptMonster, getAssetBalances, AssetBalance, MonsterStats } from '../utils/aoHelpers';
import { createDataItemSigner } from '../config/aoConnection';
import { message } from '../utils/aoHelpers';
import { currentTheme } from '../constants/theme';
import { Gateway } from '../constants/Constants';
import PurchaseModal from '../components/PurchaseModal';
import Inventory from '../components/Inventory';
import StatAllocationModal from '../components/StatAllocationModal';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Confetti from 'react-confetti';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface WalletStatus {
  isUnlocked: boolean;
  monster: MonsterStats | null;
  faction: string | null;
}

interface Wallet {
  address: string;
}

export const MonsterManagement: React.FC = (): JSX.Element => {
  const navigate = useNavigate();
  const { wallet, walletStatus, darkMode, connectWallet, setDarkMode, triggerRefresh, refreshTrigger } = useWallet();
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isAdopting, setIsAdopting] = useState(false);
  const [isFeeding, setIsFeeding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLevelingUp, setIsLevelingUp] = useState(false);
  const [showStatModal, setShowStatModal] = useState(false);
  const [isOnMission, setIsOnMission] = useState(false);
  const [isInBattle, setIsInBattle] = useState(false);
  const [assetBalances, setAssetBalances] = useState<AssetBalance[]>([]);
  const [localMonster, setLocalMonster] = useState<MonsterStats | null>(null);
  const theme = currentTheme(darkMode);
  const [, setForceUpdate] = useState({});

  // Add cooldown states
  const [feedingCooldown, setFeedingCooldown] = useState(false);
  const [playingCooldown, setPlayingCooldown] = useState(false);
  const [missionCooldown, setMissionCooldown] = useState(false);
  const [battleCooldown, setBattleCooldown] = useState(false);

  // Add battle handler
  const handleBattle = async () => {
    if (!walletStatus?.monster || !wallet?.address) return;

    try {
      setIsInBattle(true);
      console.log('Starting battle');
      
      const signer = createDataItemSigner(window.arweaveWallet);
      const battleConfig = walletStatus.monster.activities.battle;
      const fuelAsset = assetBalances.find(a => a.info.processId === battleConfig.cost.token);
      
      if (!fuelAsset || fuelAsset.balance < battleConfig.cost.amount) {
        console.error('Not enough battle fuel');
        return;
      }

      await message({
        process: battleConfig.cost.token,
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Quantity", value: battleConfig.cost.amount.toString() },
          { name: "Recipient", value: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI" },
          { name: "X-Action", value: "Battle" }
        ],
        signer,
        data: ""
      }, triggerRefresh);

      await loadAssetBalances();
      // Start cooldown period after transaction confirms
      setBattleCooldown(true);
      setTimeout(() => {
        setBattleCooldown(false);
      }, 5000);

      // Navigate to battle page
      navigate('/battle');
    } catch (error) {
      console.error('Error starting battle:', error);
    } finally {
      setIsInBattle(false);
    }
  };

  // Handle timer updates for progress bars and countdowns
  useEffect(() => {
    if (!localMonster || localMonster.status.type === 'Home') {
      console.log('[MonsterManagement] No timer needed - monster is home or null');
      return;
    }

    console.log('[MonsterManagement] Starting progress timer');
    // Update every second for smooth progress
    const timer = setInterval(() => {
      const now = Date.now();
      if (now >= localMonster.status.until_time) {
        console.log('[MonsterManagement] Activity complete, clearing timer');
        clearInterval(timer);
        // Force one final update to ensure UI shows 100%
        setForceUpdate({});
        // Trigger a refresh to update the monster state
        triggerRefresh();
      } else {
        setForceUpdate({});
      }
    }, 1000);

    return () => {
      console.log('[MonsterManagement] Cleaning up progress timer');
      clearInterval(timer);
    };
  }, [localMonster?.status.type, localMonster?.status.until_time, triggerRefresh]);

  // Update local monster and load assets when wallet status changes
  useEffect(() => {
    const updateData = async () => {
      console.log('[MonsterManagement] Checking for updates', {
        hasWallet: !!wallet?.address,
        hasMonster: !!walletStatus?.monster,
        refreshTrigger
      });

      if (wallet?.address) {
        await loadAssetBalances();
      }
      
      if (walletStatus?.monster) {
        const monsterChanged = JSON.stringify(walletStatus.monster) !== JSON.stringify(localMonster);
        if (monsterChanged) {
          console.log('[MonsterManagement] Monster state updated:', {
            old: localMonster,
            new: walletStatus.monster
          });
          setLocalMonster(walletStatus.monster);
        } else {
          console.log('[MonsterManagement] Monster state unchanged');
        }
      }
    };
    updateData();
  }, [wallet?.address, walletStatus?.monster, refreshTrigger]);

  const loadAssetBalances = async () => {
    try {
      const balances = await getAssetBalances(wallet);
      console.log('Current asset balances:', balances);
      setAssetBalances(balances);
    } catch (error) {
      console.error('Error loading asset balances:', error);
    }
  };

  const handleFeedMonster = async () => {
    if (!walletStatus?.monster || !wallet?.address) return;
    
    const feedConfig = walletStatus.monster.activities.feed.cost;
    console.log('Using berry process ID:', feedConfig.token);

    const asset = assetBalances.find(a => a.info.processId === feedConfig.token);
    console.log('Found asset:', asset);
    if (!asset || asset.balance < feedConfig.amount) {
      console.error('Not enough berries', {
        token: feedConfig.token,
        asset,
        currentBalance: asset?.balance || 0,
        required: feedConfig.amount
      });
      return;
    }

    try {
      setIsFeeding(true);
      console.log('Feeding monster with berry process:', feedConfig.token);
      
      const signer = createDataItemSigner(window.arweaveWallet);
      await message({
        process: feedConfig.token,
        tags: [
          { name: "Action", value: "Transfer" },
          { name: "Quantity", value: feedConfig.amount.toString() },
          { name: "Recipient", value: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI" },
          { name: "X-Action", value: "FEED" }
        ],
        signer,
        data: ""
      }, triggerRefresh);

      await loadAssetBalances();
      // Start cooldown period after transaction confirms
      setFeedingCooldown(true);
      setTimeout(() => {
        setFeedingCooldown(false);
      }, 5000);
    } catch (error) {
      console.error('Error feeding monster:', error);
    } finally {
      setIsFeeding(false);
    }
  };

  const handlePlayMonster = async () => {
    if (!walletStatus?.monster || !wallet?.address) return;
    
    const playConfig = walletStatus.monster.activities.play.cost;
    console.log('Using berry process ID:', playConfig.token);

    const isPlaytime = walletStatus.monster.status.type === 'Play';
    const canReturn = isPlaytime && Date.now() > walletStatus.monster.status.until_time;

    if (!canReturn) {
      const asset = assetBalances.find(a => a.info.processId === playConfig.token);
      console.log('Found asset:', asset);
      if (!asset || asset.balance < playConfig.amount) {
        console.error('Not enough berries', {
          token: playConfig.token,
          asset,
          currentBalance: asset?.balance || 0,
          required: playConfig.amount
        });
        return;
      }
    }

    try {
      setIsPlaying(true);
      console.log('Playing with monster');
      
      const signer = createDataItemSigner(window.arweaveWallet);

      if (canReturn) {
        await message({
          process: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI",
          tags: [
            { name: "Action", value: "ReturnFromPlay" }
          ],
          signer,
          data: ""
        }, triggerRefresh);
      } else {
        await message({
          process: playConfig.token,
          tags: [
            { name: "Action", value: "Transfer" },
            { name: "Quantity", value: playConfig.amount.toString() },
            { name: "Recipient", value: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI" },
            { name: "X-Action", value: "Play" }
          ],
          signer,
          data: ""
        }, triggerRefresh);
      }

      await loadAssetBalances();
      // Start cooldown period after transaction confirms
      setPlayingCooldown(true);
      setTimeout(() => {
        setPlayingCooldown(false);
      }, 5000);
    } catch (error) {
      console.error('Error with play action:', error);
    } finally {
      setIsPlaying(false);
    }
  };

  const handleMission = async () => {
    if (!walletStatus?.monster || !wallet?.address) return;

    const isMissionTime = walletStatus.monster.status.type === 'Mission';
    const canReturn = isMissionTime && Date.now() > walletStatus.monster.status.until_time;

    try {
      setIsOnMission(true);
      console.log('Handling mission');
      
      const signer = createDataItemSigner(window.arweaveWallet);

      if (canReturn) {
        await message({
          process: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI",
          tags: [
            { name: "Action", value: "ReturnFromMission" }
          ],
          signer,
          data: ""
        }, triggerRefresh);
      } else {
        const missionConfig = walletStatus.monster.activities.mission;
        const fuelAsset = assetBalances.find(a => a.info.processId === missionConfig.cost.token);
        
        if (!fuelAsset || fuelAsset.balance < missionConfig.cost.amount) {
          console.error('Not enough mission fuel');
          return;
        }

        await message({
          process: missionConfig.cost.token,
          tags: [
            { name: "Action", value: "Transfer" },
            { name: "Quantity", value: missionConfig.cost.amount.toString() },
            { name: "Recipient", value: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI" },
            { name: "X-Action", value: "Mission" }
          ],
          signer,
          data: ""
        }, triggerRefresh);
      }

      await loadAssetBalances();
      // Start cooldown period after transaction confirms
      setMissionCooldown(true);
      setTimeout(() => {
        setMissionCooldown(false);
      }, 5000);
    } catch (error) {
      console.error('Error with mission:', error);
    } finally {
      setIsOnMission(false);
    }
  };

  const handleLevelUp = () => {
    if (!walletStatus?.monster || !wallet?.address) return;
    setShowStatModal(true);
  };

  const handleStatConfirm = async (stats: { attack: number; defense: number; speed: number; health: number }) => {
    try {
      setIsLevelingUp(true);
      console.log('Leveling up monster with stats:', stats);
      
      const signer = createDataItemSigner(window.arweaveWallet);
      await message({
        process: "j7NcraZUL6GZlgdPEoph12Q5rk_dydvQDecLNxYi8rI",
        tags: [
          { name: "Action", value: "LevelUp" },
          { name: "AttackPoints", value: stats.attack.toString() },
          { name: "DefensePoints", value: stats.defense.toString() },
          { name: "SpeedPoints", value: stats.speed.toString() },
          { name: "HealthPoints", value: stats.health.toString() }
        ],
        signer,
        data: ""
      }, triggerRefresh);
    } catch (error) {
      console.error('Error leveling up monster:', error);
    } finally {
      setIsLevelingUp(false);
    }
  };

  const handleAdoptMonster = async () => {
    try {
      setIsAdopting(true);
      const result = await adoptMonster(wallet, triggerRefresh);
      console.log('Adopt monster result:', result);
      if (result.status === "success") {
        setShowConfetti(true);
        setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Error adopting monster:', error);
    } finally {
      setIsAdopting(false);
    }
  };

  const handlePurchase = async (selectedToken: TokenOption) => {
    try {
      await purchaseAccess(selectedToken, triggerRefresh);
      setShowConfetti(true);
      setIsPurchaseModalOpen(false);
      setTimeout(() => {
        setShowConfetti(false);
      }, 5000);
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  };

  // Calculate required exp for next level using Fibonacci sequence starting at 5
  const getFibonacciExp = (level: number) => {
    if (level === 0) return 1;
    if (level === 1) return 2;
    
    let a = 1, b = 2;
    for (let i = 2; i <= level; i++) {
      const next = a + b;
      a = b;
      b = next;
    }
    return b;
  };

  // Format time remaining with rounding to nearest minute
  const formatTimeRemaining = (until: number) => {
    const remaining = Math.max(0, until - Date.now());
    const minutes = remaining / 60000;
    const roundedMinutes = Math.ceil(minutes);
    
    if (minutes < 1) {
      const seconds = Math.ceil((remaining % 60000) / 1000);
      return `${seconds}s`;
    } else {
      // Round up if more than 30 seconds into the minute
      const seconds = Math.floor((remaining % 60000) / 1000);
      if (seconds > 30) {
        return `~${roundedMinutes}m`;
      } else {
        return `~${Math.floor(minutes)}m`;
      }
    }
  };

  // Calculate progress percentage (0-100) for activities
  const calculateProgress = (since: number, until: number) => {
    const now = Date.now();
    // If time is up, return 100% immediately
    if (now >= until) return 100;
    const total = until - since;
    const elapsed = now - since;
    // Round to 2 decimal places to avoid floating point issues
    const progress = Math.round((elapsed / total) * 10000) / 100;
    return Math.min(100, Math.max(0, progress));
  };

  const renderMonsterCard = React.useMemo(() => {
    if (!walletStatus?.monster) {
      return (
        <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md text-center`}>
          <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>No Monster Yet</h2>
          <p className={`mb-4 ${theme.text}`}>Ready to begin your journey? Adopt your first monster!</p>
          <button
            onClick={handleAdoptMonster}
            disabled={isAdopting}
            className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${theme.buttonBg} ${theme.buttonHover} ${theme.text}`}
          >
            {isAdopting ? 'Adopting...' : 'Adopt Monster'}
          </button>
        </div>
      );
    }

    const monster = localMonster || walletStatus.monster;
    console.log('[MonsterManagement] Rendering monster card', {
      level: monster.level,
      status: monster.status,
      energy: monster.energy,
      happiness: monster.happiness,
      exp: monster.exp
    });

    const isPlaytime = monster.status.type === 'Play';
    const isMissionTime = monster.status.type === 'Mission';
    const now = Date.now();
    const timeUp = (isPlaytime || isMissionTime) && now >= monster.status.until_time;

    // Use monster's activities directly
    const activities = monster.activities;

    // Get berry balance for play action
    const berryBalance = assetBalances.find(a => a.info.processId === monster.activities?.play?.cost?.token)?.balance || 0;
    const fuelBalance = assetBalances.find(a => a.info.processId === monster.activities?.mission?.cost?.token)?.balance || 0;

    // Check if all requirements are met for each activity
    const canFeed = monster.status.type === 'Home' && 
                    berryBalance >= activities.feed.cost.amount && 
                    monster.energy < 100;

    const canPlay = (monster.status.type === 'Home' && 
                    berryBalance >= activities.play.cost.amount && 
                    monster.energy >= activities.play.energyCost) ||
                    (monster.status.type === 'Play' && timeUp);

    const canMission = (monster.status.type === 'Home' && 
                      fuelBalance >= activities.mission.cost.amount && 
                      monster.energy >= activities.mission.energyCost && 
                      monster.happiness >= activities.mission.happinessCost) ||
                      (monster.status.type === 'Mission' && timeUp);

    const canBattle = monster.status.type === 'Home' && 
                     fuelBalance >= activities.battle.cost.amount && 
                     monster.energy >= activities.battle.energyCost && 
                     monster.happiness >= activities.battle.happinessCost;

    return (
      <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md w-[95%] mx-auto`}>
        <div className="flex justify-between items-center mb-4">
          <div className={`${theme.text} text-xl font-bold`}>
            Level {monster.level}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleLevelUp}
              disabled={isLevelingUp || monster.status.type !== 'Home' || monster.exp < getFibonacciExp(monster.level)}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${theme.buttonBg} ${theme.buttonHover} ${theme.text} ${(isLevelingUp || monster.status.type !== 'Home' || monster.exp < getFibonacciExp(monster.level)) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLevelingUp ? 'Leveling Up...' : 'Level Up'}
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <img 
            src={`${Gateway}${monster.image}`}
            alt={monster.name}
            className="w-64 h-64 object-cover rounded-lg mb-4"
          />
          <h2 className={`text-2xl font-bold mb-4 ${theme.text}`}>{monster.name}</h2>
          
          {/* Moves Display */}
          <div className="w-full mb-6">
            <h3 className={`text-xl font-bold mb-2 ${theme.text}`}>Moves</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(monster.moves).map(([name, move]) => (
                <div 
                  key={name} 
                  className={`p-2 rounded-lg ${
                    move.type === 'fire' ? 'bg-red-500' :
                    move.type === 'water' ? 'bg-blue-500' :
                    move.type === 'air' ? 'bg-gray-300' :
                    move.type === 'rock' ? 'bg-yellow-700' :
                    move.type === 'boost' ? 'bg-purple-500' :
                    'bg-green-500' // heal type
                  } bg-opacity-20`}
                >
                  <div className={`font-semibold ${theme.text}`}>{name}</div>
                  <div className={`text-sm ${theme.text}`}>Type: {move.type}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="w-full grid grid-cols-2 gap-4">
            {/* Status */}
            <div className="col-span-2 mb-4">
              <div className="flex justify-between mb-1">
                <span className={`${theme.text} text-sm`}>Status: {monster.status.type}</span>
                {monster.status.type !== 'Home' && (
                  <span className={`${theme.text} text-sm`}>
                    Time Remaining: {formatTimeRemaining(monster.status.until_time)}
                  </span>
                )}
              </div>
              {monster.status.type !== 'Home' && (
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-yellow-600 h-2.5 rounded-full transition-all duration-1000" 
                    style={{ 
                      width: `${calculateProgress(monster.status.since, monster.status.until_time)}%` 
                    }}
                  ></div>
                </div>
              )}
            </div>

            {/* Energy Bar */}
            <div className="col-span-2">
              <div className="flex justify-between mb-1">
                <span className={`${theme.text} text-sm`}>Energy</span>
                <span className={`${theme.text} text-sm`}>{monster.energy}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${monster.energy}%` }}
                ></div>
              </div>
            </div>

            {/* Happiness Bar */}
            <div className="col-span-2">
              <div className="flex justify-between mb-1">
                <span className={`${theme.text} text-sm`}>Happiness</span>
                <span className={`${theme.text} text-sm`}>{monster.happiness}/100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-pink-600 h-2.5 rounded-full" 
                  style={{ width: `${monster.happiness}%` }}
                ></div>
              </div>
            </div>

            {/* Experience Bar */}
            <div className="col-span-2">
              <div className="flex justify-between mb-1">
                <span className={`${theme.text} text-sm`}>Experience</span>
                <span className={`${theme.text} text-sm`}>{monster.exp}/{getFibonacciExp(monster.level)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min((monster.exp / getFibonacciExp(monster.level)) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Stats Display */}
            <div className="col-span-2 flex gap-4 mt-4">
              {/* Stats Grid */}
              <div className="flex-1 space-y-2">
                <h3 className={`text-xl font-bold mb-4 ${theme.text}`}>Stats</h3>
                <div className={`${theme.text} p-2 rounded bg-opacity-20 ${theme.container}`}>
                  <span className="font-semibold">Attack:</span> {monster.attack}/{5 + (monster.level * 5)}
                </div>
                <div className={`${theme.text} p-2 rounded bg-opacity-20 ${theme.container}`}>
                  <span className="font-semibold">Defense:</span> {monster.defense}/{5 + (monster.level * 5)}
                </div>
                <div className={`${theme.text} p-2 rounded bg-opacity-20 ${theme.container}`}>
                  <span className="font-semibold">Speed:</span> {monster.speed}/{5 + (monster.level * 5)}
                </div>
                <div className={`${theme.text} p-2 rounded bg-opacity-20 ${theme.container}`}>
                  <span className="font-semibold">Health:</span> {monster.health}/{5 + (monster.level * 5)}
                </div>
              </div>
              
              {/* Radar Chart */}
              <div className="flex-1 px-8">
                <div className="w-full h-[300px] flex items-center justify-center">
                  <Radar
                    data={{
                      labels: ['Attack', 'Defense', 'Speed', 'Health'],
                      datasets: [
                        {
                          label: 'Stats',
                          data: [monster.attack, monster.defense, monster.speed, monster.health],
                          backgroundColor: darkMode ? 'rgba(147, 197, 253, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                          borderColor: darkMode ? 'rgba(147, 197, 253, 1)' : 'rgba(59, 130, 246, 1)',
                          borderWidth: 2,
                          pointBackgroundColor: darkMode ? 'rgba(244, 134, 10, 1)' : 'rgba(129, 78, 51, 1)',
                          pointBorderColor: darkMode ? '#FCF5D8' : '#2A1912',
                          pointHoverBackgroundColor: darkMode ? '#FCF5D8' : '#2A1912',
                          pointHoverBorderColor: darkMode ? 'rgba(244, 134, 10, 1)' : 'rgba(129, 78, 51, 1)',
                        },
                      ],
                    }}
                    options={{
                      scales: {
                        r: {
                          beginAtZero: true,
                          min: 0,
                          max: 5 + (monster.level * 5),
                          ticks: {
                            stepSize: 1,
                            color: darkMode ? '#FCF5D8' : '#2A1912',
                            font: {
                              size: 12
                            }
                          },
                          grid: {
                            color: darkMode ? 'rgba(252, 245, 216, 0.2)' : 'rgba(42, 25, 18, 0.2)',
                          },
                          angleLines: {
                            color: darkMode ? 'rgba(252, 245, 216, 0.2)' : 'rgba(42, 25, 18, 0.2)',
                          },
                          pointLabels: {
                            color: darkMode ? '#FCF5D8' : '#2A1912',
                            font: {
                              size: 16,
                              weight: 'bold'
                            },
                            padding: 20
                          }
                        }
                      },
                      plugins: {
                        legend: {
                          display: false
                        }
                      },
                      maintainAspectRatio: true,
                      responsive: true,
                      aspectRatio: 1,
                      devicePixelRatio: 0.85, // Makes the chart 15% smaller
                      layout: {
                        padding: {
                          top: 20,
                          bottom: 20,
                          left: 20,
                          right: 20
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6 col-span-2 px-4">
              {/* Feed Button */}
              <div className={`rounded-lg overflow-hidden ${theme.container} border ${theme.border}`}>
                <div className="bg-black text-white px-4 py-2 text-center font-bold">
                  INSTANT
                </div>
                <div className="p-6 flex flex-col h-[300px] relative">
                  <div className="flex-1 flex justify-between items-start">
                    <div className="w-1/2 pr-4 relative">
                      <div className="absolute top-0 right-0 w-px h-[calc(100%-48px)] bg-gray-300"></div>
                      <div className="text-sm font-bold mb-3 text-gray-400">COSTS</div>
                      <div className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto">
                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${
                          berryBalance >= activities.feed.cost.amount ? 
                          'bg-gray-700/50 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' ? '' : 'opacity-50'}`}>
                          <img src={`${Gateway}${assetBalances.find(a => a.info.processId === activities.feed.cost.token)?.info.logo}`} 
                               alt="Berry" className="w-4 h-4 rounded-full" />
                          <span>-{activities.feed.cost.amount}</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2 pl-4">
                      <div className="text-sm font-bold mb-3 text-gray-400">REWARDS</div>
                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 rounded-full bg-blue-500/30 text-black font-medium">
                          +{activities.feed.energyGain} Energy
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleFeedMonster}
                    disabled={isFeeding || feedingCooldown || !canFeed}
                    className={`w-full px-4 py-2 rounded-lg font-bold text-lg transition-all duration-300 bg-gradient-to-br from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 text-white ${
                      (isFeeding || feedingCooldown || !canFeed) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isFeeding || feedingCooldown ? 'Feeding...' : 'Feed'}
                  </button>
                </div>
              </div>

              {/* Play Button */}
              <div className={`rounded-lg overflow-hidden ${theme.container} border ${theme.border}`}>
                <div className="bg-black text-white px-4 py-2 text-center font-bold">
                  {activities.play.duration / 60000} MIN
                </div>
                <div className="p-6 flex flex-col h-[300px] relative">
                  <div className="flex-1 flex justify-between items-start">
                    <div className="w-1/2 pr-4 relative">
                      <div className="absolute top-0 right-0 w-px h-[calc(100%-48px)] bg-gray-300"></div>
                      <div className="text-sm font-bold mb-3 text-gray-400">COSTS</div>
                      <div className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto">
                        <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                          berryBalance >= activities.play.cost.amount ? 
                          'bg-gray-700/50 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' || (monster.status.type === 'Play' && timeUp) ? '' : 'opacity-50'}`}>
                          <img src={`${Gateway}${assetBalances.find(a => a.info.processId === activities.play.cost.token)?.info.logo}`} 
                               alt="Berry" className="w-4 h-4 rounded-full" />
                          <span>-{activities.play.cost.amount}</span>
                        </div>
                        <div className={`px-3 py-1.5 rounded-full ${
                          monster.energy >= activities.play.energyCost ? 
                          'bg-blue-500/30 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' || (monster.status.type === 'Play' && timeUp) ? '' : 'opacity-50'}`}>
                          -{activities.play.energyCost} Energy
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2 pl-4">
                      <div className="text-sm font-bold mb-3 text-gray-400">REWARDS</div>
                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 rounded-full bg-yellow-500/30 text-black font-medium">
                          +{activities.play.happinessGain} Happy
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handlePlayMonster}
                    disabled={isPlaying || playingCooldown || !canPlay || (monster.status.type !== 'Home' && monster.status.type !== 'Play')}
                    className={`w-full px-4 py-2 rounded-lg font-bold text-lg transition-all duration-300 bg-gradient-to-br from-yellow-500 to-yellow-700 hover:from-yellow-400 hover:to-yellow-600 text-white ${
                      (isPlaying || playingCooldown || !canPlay || (monster.status.type !== 'Home' && monster.status.type !== 'Play')) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isPlaying || playingCooldown ? 'Playing...' : 
                     (monster.status.type === 'Play' && timeUp) ? 'Return from Play' : 'Play'}
                  </button>
                </div>
              </div>

              {/* Battle Button */}
              <div className={`rounded-lg overflow-hidden ${theme.container} border ${theme.border}`}>
                <div className="bg-black text-white px-4 py-2 text-center font-bold">
                  BATTLE
                </div>
                <div className="p-6 flex flex-col h-[300px] relative">
                  <div className="flex-1 flex justify-between items-start">
                    <div className="w-1/2 pr-4 relative">
                      <div className="absolute top-0 right-0 w-px h-[calc(100%-48px)] bg-gray-300"></div>
                      <div className="text-sm font-bold mb-3 text-gray-400">COSTS</div>
                      <div className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto">
                        <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                          fuelBalance >= activities.battle.cost.amount ? 
                          'bg-gray-700/50 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' ? '' : 'opacity-50'}`}>
                          <img src={`${Gateway}${assetBalances.find(a => a.info.processId === activities.battle.cost.token)?.info.logo}`} 
                               alt="TRUNK" className="w-4 h-4 rounded-full" />
                          <span>-{activities.battle.cost.amount}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full ${
                          monster.energy >= activities.battle.energyCost ? 
                          'bg-blue-500/30 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' ? '' : 'opacity-50'}`}>
                          -{activities.battle.energyCost} Energy
                        </div>
                        <div className={`px-3 py-1.5 rounded-full ${
                          monster.happiness >= activities.battle.happinessCost ? 
                          'bg-yellow-500/30 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' ? '' : 'opacity-50'}`}>
                          -{activities.battle.happinessCost} Happy
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2 pl-4">
                      <div className="text-sm font-bold mb-3 text-gray-400">REWARDS</div>
                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 rounded-full bg-emerald-500/30 text-black font-medium">
                          4 Battles
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleBattle}
                    disabled={isInBattle || battleCooldown || !canBattle || monster.status.type !== 'Home'}
                    className={`w-full px-4 py-2 rounded-lg font-bold text-lg transition-all duration-300 bg-gradient-to-br from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 text-white ${
                      (isInBattle || battleCooldown || !canBattle || monster.status.type !== 'Home') ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isInBattle || battleCooldown ? 'In Battle...' : 'Start Battle'}
                  </button>
                </div>
              </div>

              {/* Mission Button */}
              <div className={`rounded-lg overflow-hidden ${theme.container} border ${theme.border}`}>
                <div className="bg-black text-white px-4 py-2 text-center font-bold">
                  {activities.mission.duration / 3600000} HOUR
                </div>
                <div className="p-6 flex flex-col h-[300px] relative">
                  <div className="flex-1 flex justify-between items-start">
                    <div className="w-1/2 pr-4 relative">
                      <div className="absolute top-0 right-0 w-px h-[calc(100%-48px)] bg-gray-300"></div>
                      <div className="text-sm font-bold mb-3 text-gray-400">COSTS</div>
                      <div className="flex flex-wrap gap-2 max-h-[210px] overflow-y-auto">
                        <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${
                          fuelBalance >= activities.mission.cost.amount ? 
                          'bg-gray-700/50 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' || (monster.status.type === 'Mission' && timeUp) ? '' : 'opacity-50'}`}>
                          <img src={`${Gateway}${assetBalances.find(a => a.info.processId === activities.mission.cost.token)?.info.logo}`} 
                               alt="TRUNK" className="w-4 h-4 rounded-full" />
                          <span>-{activities.mission.cost.amount}</span>
                        </div>
                        <div className={`px-3 py-1 rounded-full ${
                          monster.energy >= activities.mission.energyCost ? 
                          'bg-blue-500/30 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' || (monster.status.type === 'Mission' && timeUp) ? '' : 'opacity-50'}`}>
                          -{activities.mission.energyCost} Energy
                        </div>
                        <div className={`px-3 py-1.5 rounded-full ${
                          monster.happiness >= activities.mission.happinessCost ? 
                          'bg-yellow-500/30 text-black font-medium' : 
                          'bg-gray-800/50 text-gray-400 border-2 border-red-500/70 shadow-[0_0_10px_-3px_rgba(239,68,68,0.6)]'
                        } ${monster.status.type === 'Home' || (monster.status.type === 'Mission' && timeUp) ? '' : 'opacity-50'}`}>
                          -{activities.mission.happinessCost} Happy
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2 pl-4">
                      <div className="text-sm font-bold mb-3 text-gray-400">REWARDS</div>
                      <div className="flex flex-wrap gap-2">
                        <div className="px-3 py-1 rounded-full bg-emerald-500/30 text-black font-medium">
                          +1 EXP
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleMission}
                    disabled={isOnMission || missionCooldown || !canMission || (monster.status.type !== 'Home' && monster.status.type !== 'Mission')}
                    className={`w-full px-4 py-2 rounded-lg font-bold text-lg transition-all duration-300 bg-gradient-to-br from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white ${
                      (isOnMission || missionCooldown || !canMission || (monster.status.type !== 'Home' && monster.status.type !== 'Mission')) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isOnMission || missionCooldown ? 'On Mission...' : 
                     (monster.status.type === 'Mission' && timeUp) ? 'Return from Mission' : 'Start Mission'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }, [
    localMonster?.level,
    localMonster?.status,
    localMonster?.energy,
    localMonster?.happiness,
    localMonster?.exp,
    localMonster?.attack,
    localMonster?.defense,
    localMonster?.speed,
    localMonster?.health,
    localMonster?.moves,
    assetBalances,
    isAdopting,
    isFeeding,
    isPlaying,
    isLevelingUp,
    isOnMission,
    feedingCooldown,
    playingCooldown,
    missionCooldown,
    darkMode,
    theme,
    handleAdoptMonster,
    handleFeedMonster,
    handlePlayMonster,
    handleMission,
    handleLevelUp,
    handleBattle,
    isInBattle,
    battleCooldown
  ]);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden relative">
      <div className={`min-h-screen flex flex-col ${theme.bg}`}>
        <Header
          theme={theme}
          darkMode={darkMode}
          onDarkModeToggle={() => setDarkMode(!darkMode)}
        />
        
        {showConfetti && (
          <Confetti
            width={window.innerWidth}
            height={window.innerHeight}
            recycle={false}
            numberOfPieces={500}
            gravity={0.3}
          />
        )}

        <StatAllocationModal
          isOpen={showStatModal}
          onClose={() => setShowStatModal(false)}
          onConfirm={handleStatConfirm}
          darkMode={darkMode}
        />
        <PurchaseModal
          isOpen={isPurchaseModalOpen}
          onClose={() => setIsPurchaseModalOpen(false)}
          onPurchase={handlePurchase}
          contractName="Eternal Pass"
        />

        <div className={`container mx-auto px-6 py-8 flex-1 overflow-y-auto ${theme.text} pr-72 md:pr-80`}>
          <div className="max-w-6xl mx-auto mb-8">
            <h1 className={`text-3xl font-bold mb-4 ${theme.text}`}>Monster Management</h1>
            
            {!walletStatus?.isUnlocked ? (
              <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md text-center`}>
                <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>Unlock Access to Manage Monsters</h2>
                <button
                  onClick={() => setIsPurchaseModalOpen(true)}
                  className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${theme.buttonBg} ${theme.buttonHover} ${theme.text}`}
                >
                  Purchase Access
                </button>
              </div>
            ) : !walletStatus?.faction ? (
              <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md text-center`}>
                <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>Join a Faction First</h2>
                <a
                  href="/faction"
                  className={`px-6 py-3 rounded-lg font-bold transition-all duration-300 ${theme.buttonBg} ${theme.buttonHover} ${theme.text}`}
                >
                  Choose Your Faction
                </a>
              </div>
            ) : (
              renderMonsterCard
            )}
          </div>
        </div>
        {wallet?.address && <Inventory />}
        <Footer darkMode={darkMode} />
      </div>
    </div>
  );
};

export default MonsterManagement;
