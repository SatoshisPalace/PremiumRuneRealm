import React from "react";
import { BattleTurn } from "../utils/interefaces";

interface BattleLogProps {
  turns: BattleTurn[];
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  opponentName: string;
}

const BattleLog: React.FC<BattleLogProps> = ({
  turns,
  isOpen,
  onClose,
  playerName,
  opponentName,
}) => {
  if (!isOpen) return null;

  if (!isOpen) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-h-96 overflow-y-auto bg-gray-900 bg-opacity-90 text-white text-sm rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex justify-between items-center mb-2 border-b pb-1 border-gray-600">
        <h3 className="text-lg font-bold">Battle Log</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg shadow-md text-white ${
              turn.attacker === "challenger"
                ? "bg-blue-600/80"
                : "bg-red-600/80"
            }`}
          >
            <div className="font-semibold text-sm mb-1">
              {turn.attacker === "challenger" ? `🦸‍♂️ ${playerName}` : `👾 ${opponentName}`} used <span className="italic">{turn.move}</span>
            </div>

            <div className="space-y-1 text-xs leading-tight">
              {(turn.healthDamage > 0 || turn.shieldDamage > 0) && (
                <div className="flex items-center gap-1">
                  <span>💥</span>
                  <span>
                    {turn.healthDamage + turn.shieldDamage} total damage
                    {turn.superEffective && (
                      <span className="ml-1 text-yellow-300">⭐ Super Effective!</span>
                    )}
                    {turn.notEffective && (
                      <span className="ml-1 text-gray-300">💫 Not Very Effective...</span>
                    )}
                  </span>
                </div>
              )}

              {turn.healthDamage > 0 && (
                <div className="flex items-center gap-1">
                  <span>⚔️</span>
                  <span>{turn.healthDamage} health damage</span>
                </div>
              )}

              {turn.shieldDamage > 0 && (
                <div className="flex items-center gap-1">
                  <span>🛡️</span>
                  <span>{turn.shieldDamage} shield damage</span>
                </div>
              )}

              {turn.missed && (
                <div className="flex items-center gap-1">
                  <span>❌</span>
                  <span>Attack missed!</span>
                </div>
              )}

              {turn.statsChanged && (
                <div className="space-y-1">
                  {turn.statsChanged.attack && (
                    <div className="flex items-center gap-1">
                      <span>💪</span>
                      <span>{turn.statsChanged.attack > 0 ? '+' : ''}{turn.statsChanged.attack} attack</span>
                    </div>
                  )}
                  {turn.statsChanged.speed && (
                    <div className="flex items-center gap-1">
                      <span>⚡</span>
                      <span>{turn.statsChanged.speed > 0 ? '+' : ''}{turn.statsChanged.speed} speed</span>
                    </div>
                  )}
                  {turn.statsChanged.defense && (
                    <div className="flex items-center gap-1">
                      <span>🛡️</span>
                      <span>{turn.statsChanged.defense > 0 ? '+' : ''}{turn.statsChanged.defense} defense</span>
                    </div>
                  )}
                  {turn.statsChanged.health && (
                    <div className="flex items-center gap-1">
                      <span>❤️</span>
                      <span>{turn.statsChanged.health > 0 ? '+' : ''}{turn.statsChanged.health} health</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BattleLog;