import React, { useEffect, useState, useCallback } from 'react';
import { useWallet } from '../hooks/useWallet';
import { getBattleManagerInfo, getActiveBattle, executeAttack, endBattle, returnFromBattle, BattleManagerInfo, ActiveBattle, BattleResult } from '../utils/aoHelpers';
import { currentTheme } from '../constants/theme';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import { useNavigate } from 'react-router-dom';
import BattleScene from '../components/BattleScene';

// Attack animation component
const AttackAnimation: React.FC<{
  attacker: 'player' | 'opponent';
  moveName: string;
  onComplete: () => void;
}> = ({ attacker, moveName, onComplete }): JSX.Element => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-40 pointer-events-none">
      <div className={`text-2xl font-bold ${attacker === 'player' ? 'text-blue-500' : 'text-red-500'} transform scale-100 animate-pulse`}>
        {attacker === 'player' ? 'Your Monster' : 'Opponent'} using {moveName}...
      </div>
    </div>
  );
};

// Small loading indicator for updates
const UpdateIndicator: React.FC = () => (
  <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm animate-pulse">
    Updating...
  </div>
);

export const ActiveBattlePage: React.FC = (): JSX.Element => {
  const { wallet, darkMode, setDarkMode } = useWallet();
  const [battleManagerInfo, setBattleManagerInfo] = useState<BattleManagerInfo | null>(null);
  const [activeBattle, setActiveBattle] = useState<ActiveBattle | null>(null);
  const [previousBattle, setPreviousBattle] = useState<ActiveBattle | null>(null);
  const [attackAnimation, setAttackAnimation] = useState<{
    attacker: 'player' | 'opponent';
    moveName: string;
  } | null>(null);
  const [playerAnimation, setPlayerAnimation] = useState<'walkRight' | 'walkLeft' | 'walkUp' | 'walkDown' | 'attack1' | 'attack2' | undefined>();
  const [opponentAnimation, setOpponentAnimation] = useState<'walkRight' | 'walkLeft' | 'walkUp' | 'walkDown' | 'attack1' | 'attack2' | undefined>();
  const [initialLoading, setInitialLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const theme = currentTheme(darkMode);
  const navigate = useNavigate();

  // Memoized comparison function to prevent unnecessary updates
  const hasBattleChanged = useCallback((oldBattle: ActiveBattle | null, newBattle: ActiveBattle | null) => {
    if (!oldBattle || !newBattle) return true;
    
    // Compare relevant battle data excluding status
    const oldData = {
      player: { ...oldBattle.player, status: undefined },
      opponent: { ...oldBattle.opponent, status: undefined },
      turns: oldBattle.turns,
      moveCounts: oldBattle.moveCounts
    };
    
    const newData = {
      player: { ...newBattle.player, status: undefined },
      opponent: { ...newBattle.opponent, status: undefined },
      turns: newBattle.turns,
      moveCounts: newBattle.moveCounts
    };
    
    return JSON.stringify(oldData) !== JSON.stringify(newData);
  }, []);

  // Effect to handle initial load and polling
  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout | null = null;
    
    const checkBattleStatus = async () => {
      if (!wallet?.address || !mounted || isUpdating) return;
      
      try {
        const info = await getBattleManagerInfo(wallet.address);
        if (!mounted) return;
        setBattleManagerInfo(info);
        
        const battle = await getActiveBattle(wallet.address);
        if (!mounted) return;
        
        if (battle) {
          if (!activeBattle) {
            // Initial battle load
            setActiveBattle({
              ...battle,
              status: 'active'
            });
            setPreviousBattle({
              ...battle,
              status: 'active'
            });
          } else if (hasBattleChanged(activeBattle, battle)) {
            // Only update if there are meaningful changes
            setPreviousBattle(activeBattle);
            setActiveBattle({
              ...battle,
              status: activeBattle.status
            });
          }
        } else {
          // No battle at all
          navigate('/battle');
        }
      } catch (error) {
        console.error('Error checking battle status:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    checkBattleStatus();
    
    // Only start polling after initial load
    if (!initialLoading) {
      pollInterval = setInterval(checkBattleStatus, 10000);
    }
    
    return () => {
      mounted = false;
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [wallet?.address, navigate, activeBattle, hasBattleChanged, initialLoading, isUpdating]);

  const handleAttack = async (moveName: string) => {
    if (!wallet?.address || !activeBattle || isUpdating) return;
    try {
      setIsUpdating(true);
      const response = await executeAttack(wallet, activeBattle.id, moveName);
      if (response.status === 'success') {
        if ('result' in response.data!) {
          // Battle is over
          const result = response.data as BattleResult;
          setBattleManagerInfo(result.session);
          if (activeBattle) {
            setActiveBattle({
              ...activeBattle,
              status: 'ended'
            });
          }
        } else {
          // Battle continues - process new turns
          const battleData = response.data as ActiveBattle;
          const previousTurns = activeBattle?.turns.length || 0;
          const newTurns = battleData.turns.length;
          
          if (newTurns > previousTurns) {
            // Process turns in sequence
            const processNextTurn = async (turnIndex: number, currentBattle: ActiveBattle) => {
              if (turnIndex >= newTurns) {
                // All turns processed
                setActiveBattle(battleData);
                setPreviousBattle(battleData);
                getBattleManagerInfo(wallet.address).then(info => {
                  if (info) setBattleManagerInfo(info);
                });
                return;
              }

              const turn = battleData.turns[turnIndex];
              
              const processTurnEffects = async () => {
                // Show attack animation
                setAttackAnimation({
                  attacker: turn.attacker,
                  moveName: turn.move
                });

                // Sequence: move in (1s) -> pause (1s) -> move out (1s)
                if (turn.attacker === 'player') {
                  // Move in (1s)
                  setPlayerAnimation('walkRight');
                  await new Promise(resolve => setTimeout(resolve, 1000));
                  
                  // Stop walking animation but stay in position (1s)
                  setPlayerAnimation('attack1');
                  await new Promise(resolve => setTimeout(resolve, 1250));
                  
                  // Move back (1s)
                  setPlayerAnimation('walkLeft');
                  await new Promise(resolve => setTimeout(resolve, 1250));
                } else {
                  // Move in (1s)
                  setOpponentAnimation('walkRight');
                  await new Promise(resolve => setTimeout(resolve, 1250));
                  
                  // Stop walking animation but stay in position (1s)
                  setOpponentAnimation('attack1');
                  await new Promise(resolve => setTimeout(resolve, 1250));
                  
                  // Move back (1s)
                  setOpponentAnimation('walkLeft');
                  await new Promise(resolve => setTimeout(resolve, 1250));
                }

                // Clear all animations
                setAttackAnimation(null);
                setPlayerAnimation(undefined);
                setOpponentAnimation(undefined);

                // Apply turn effects after animation completes
                const updatedBattle = {...currentBattle};
                const target = turn.attacker === 'player' ? 'opponent' : 'player';
                
                if (turn.healthDamage > 0) {
                  updatedBattle[target].healthPoints = Math.max(
                    0,
                    updatedBattle[target].healthPoints - turn.healthDamage
                  );
                }
                
                if (turn.shieldDamage > 0) {
                  updatedBattle[target].shield = Math.max(
                    0,
                    updatedBattle[target].shield - turn.shieldDamage
                  );
                }

                if (turn.statsChanged) {
                  const stats = turn.statsChanged;
                  const entity = turn.attacker === 'player' ? 'player' : 'opponent';
                  updatedBattle[entity].speed += stats.speed || 0;
                  updatedBattle[entity].shield = Math.min(
                    (updatedBattle[entity].shield || 0) + (stats.defense || 0),
                    updatedBattle[entity].defense
                  );
                }

                // Update battle state
                setActiveBattle(updatedBattle);
                setPreviousBattle(updatedBattle);

                // Small delay before next turn
                await new Promise(resolve => setTimeout(resolve, 1000));
                processNextTurn(turnIndex + 1, updatedBattle);
              };

              // Start processing this turn's effects
              processTurnEffects();
            };

            // Start processing turns from the first new turn
            processNextTurn(previousTurns, {...activeBattle});
          }
        }
      }
    } catch (error) {
      console.error('Error executing attack:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReturnToBattleManager = async () => {
    if (!wallet?.address || isUpdating) return;
    try {
      setIsUpdating(true);
      const response = await returnFromBattle(wallet);
      if (response.status === 'success') {
        navigate('/battle');
      }
    } catch (error) {
      console.error('Error returning from battle:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEndBattle = async () => {
    if (!wallet?.address || !activeBattle || isUpdating) return;
    try {
      setIsUpdating(true);
      const response = await endBattle(wallet, activeBattle.id);
      if (response.status === 'success') {
        navigate('/battle');
      }
    } catch (error) {
      console.error('Error ending battle:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className={`min-h-screen flex flex-col ${theme.bg}`}>
        <Header
          theme={theme}
          darkMode={darkMode}
          onDarkModeToggle={() => setDarkMode(!darkMode)}
        />
        
        <div className={`container mx-auto px-6 py-8 flex-1 ${theme.text}`}>
          <div className="max-w-4xl mx-auto">
            {!wallet?.address ? (
              <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md text-center`}>
                <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>Connect Wallet</h2>
                <p className={`mb-4 ${theme.text}`}>Please connect your wallet to view battle status.</p>
              </div>
            ) : initialLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loading darkMode={darkMode} />
              </div>
            ) : !battleManagerInfo || !activeBattle ? (
              <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md text-center`}>
                <h2 className={`text-xl font-bold mb-4 ${theme.text}`}>No Active Battle</h2>
                <p className={`mb-4 ${theme.text}`}>Returning to battle manager...</p>
              </div>
            ) : (
              <div className={`p-6 rounded-xl ${theme.container} border ${theme.border} backdrop-blur-md`}>
                {attackAnimation && (
                  <AttackAnimation
                    attacker={attackAnimation.attacker}
                    moveName={attackAnimation.moveName}
                    onComplete={() => setAttackAnimation(null)}
                  />
                )}
                {isUpdating && <UpdateIndicator />}
                
                <div className="flex justify-between items-center mb-6">
                  <h2 className={`text-2xl font-bold ${theme.text}`}>Active Battle</h2>
                  {activeBattle.status === 'ended' && (
                    <button
                      onClick={handleEndBattle}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition-all duration-300"
                    >
                      Exit Battle
                    </button>
                  )}
                </div>
                
                <div className={`p-4 rounded-lg ${theme.container} bg-opacity-20 mb-4 transition-all duration-300`}>
                  {/* Battle Scene */}
                  <BattleScene
                    player={activeBattle.player}
                    opponent={activeBattle.opponent}
                    playerAnimation={playerAnimation}
                    opponentAnimation={opponentAnimation}
                    onPlayerAnimationComplete={() => {}}
                    onOpponentAnimationComplete={() => {}}
                  />
                </div>

                <div className="mt-6">
                  <h3 className={`text-lg font-bold mb-4 ${theme.text}`}>Available Moves</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Player Moves */}
                    <div className={`p-4 rounded-lg ${theme.container} bg-opacity-20`}>
                      <h4 className="text-md font-semibold mb-3">Your Moves</h4>
                      <div className="space-y-2">
                        {/* Regular moves */}
                        {Object.entries(activeBattle.player.moves).map(([moveName, move]) => (
                          <button
                            key={moveName}
                            onClick={() => handleAttack(moveName)}
                            disabled={isUpdating || activeBattle.status === 'ended' || move.count === 0}
                            className={`w-full p-3 rounded-lg font-medium text-left transition-all duration-300 
                              ${moveName === 'attack' ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'} 
                              ${activeBattle.status === 'ended' || move.count === 0 ? 'opacity-50 cursor-not-allowed' : ''}
                              text-white relative overflow-hidden group`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="capitalize">{moveName}</span>
                              <span className="text-sm opacity-75">
                                {move.count} uses left
                              </span>
                            </div>
                            <div className="text-sm mt-1 space-x-3">
                              {move.damage > 0 && (
                                <span>⚔️ +{move.damage}</span>
                              )}
                              {move.defense > 0 && (
                                <span>🛡️ +{move.defense}</span>
                              )}
                              {move.speed > 0 && (
                                <span>⚡ +{move.speed}</span>
                              )}
                              {move.health > 0 && (
                                <span>❤️ +{move.health}</span>
                              )}
                            </div>
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                          </button>
                        ))}

                        {/* Struggle button - only show when all moves have 0 uses */}
                        {Object.values(activeBattle.player.moves).every(move => move.count === 0) && (
                          <button
                            onClick={() => handleAttack('struggle')}
                            disabled={isUpdating || activeBattle.status === 'ended'}
                            className={`w-full mt-4 p-3 rounded-lg font-medium text-left transition-all duration-300 
                              bg-purple-500 hover:bg-purple-600
                              ${activeBattle.status === 'ended' ? 'opacity-50 cursor-not-allowed' : ''}
                              text-white relative overflow-hidden group`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="capitalize">Struggle</span>
                              <span className="text-sm opacity-75">Last Resort</span>
                            </div>
                            <div className="text-sm mt-1 space-x-3">
                              <span>⚔️ +1</span>
                            </div>
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Opponent Moves */}
                    <div className={`p-4 rounded-lg ${theme.container} bg-opacity-20`}>
                      <h4 className="text-md font-semibold mb-3">Opponent's Moves</h4>
                      <div className="space-y-2">
                        {Object.entries(activeBattle.opponent.moves).map(([moveName, move]) => (
                          <div
                            key={moveName}
                            className={`w-full p-3 rounded-lg font-medium text-left
                              ${moveName === 'attack' ? 'bg-red-500/50' : 'bg-blue-500/50'} 
                              text-white`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="capitalize">{moveName}</span>
                              <span className="text-sm opacity-75">
                                {move.count} uses left
                              </span>
                            </div>
                            <div className="text-sm mt-1 space-x-3">
                              {move.damage > 0 && (
                                <span>⚔️ +{move.damage}</span>
                              )}
                              {move.defense > 0 && (
                                <span>🛡️ +{move.defense}</span>
                              )}
                              {move.speed > 0 && (
                                <span>⚡ +{move.speed}</span>
                              )}
                              {move.health > 0 && (
                                <span>❤️ +{move.health}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Battle Log */}
                  <div className="mt-8">
                    <h3 className={`text-lg font-bold mb-4 ${theme.text}`}>Battle Log</h3>
                    <div className="space-y-4 max-h-96 overflow-y-auto p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                      {activeBattle.turns.map((turn, index) => (
                        <div
                          key={index}
                          className={`flex ${turn.attacker === 'player' ? 'justify-start' : 'justify-end'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              turn.attacker === 'player'
                                ? 'bg-blue-500 rounded-tr-lg'
                                : 'bg-red-500 rounded-tl-lg'
                            } text-white`}
                          >
                            <div className="font-medium mb-1">
                              {turn.attacker === 'player' ? 'Your Monster' : 'Opponent'} used {turn.move}
                            </div>
                            <div className="text-sm space-x-2">
                              {turn.healthDamage > 0 && (
                                <span>⚔️ {turn.healthDamage} damage</span>
                              )}
                              {turn.shieldDamage > 0 && (
                                <span>🛡️ {turn.shieldDamage} shield damage</span>
                              )}
                              {turn.missed && (
                                <span>❌ Missed!</span>
                              )}
                              {turn.statsChanged && (
                                <>
                                  {turn.statsChanged.speed && (
                                    <span>⚡ {turn.statsChanged.speed > 0 ? '+' : ''}{turn.statsChanged.speed} speed</span>
                                  )}
                                  {turn.statsChanged.defense && (
                                    <span>🛡️ {turn.statsChanged.defense > 0 ? '+' : ''}{turn.statsChanged.defense} defense</span>
                                  )}
                                  {turn.statsChanged.health && (
                                    <span>❤️ {turn.statsChanged.health > 0 ? '+' : ''}{turn.statsChanged.health} health</span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleReturnToBattleManager}
                    className={`w-full mt-4 px-6 py-3 rounded-lg font-bold transition-all duration-300 ${theme.buttonBg} ${theme.buttonHover} ${theme.text}`}
                  >
                    Return to Battle Manager
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Footer darkMode={darkMode} />
      </div>
    </div>
  );
};

export default ActiveBattlePage;
