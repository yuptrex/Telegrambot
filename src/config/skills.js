/**
 * Skill catalogue per class. `unlockLevel` gates availability.
 * `type` drives which stat the battle engine uses for damage:
 *   'physical' -> strength, 'magic' -> intelligence, 'heal' -> intelligence (healing power)
 */
module.exports = {
  warrior: [
    { id: 'w_slash', name: 'Power Slash', unlockLevel: 1, manaCost: 5, type: 'physical', multiplier: 1.4, description: 'A heavy blade strike.' },
    { id: 'w_shield_bash', name: 'Shield Bash', unlockLevel: 3, manaCost: 8, type: 'physical', multiplier: 1.1, stun: 1, description: 'Bash with your shield, may stun.' },
    { id: 'w_rally', name: 'Rally Cry', unlockLevel: 5, manaCost: 12, type: 'buff', buff: { strength: 1.2 }, duration: 3, description: 'Boost your own strength temporarily.' },
    { id: 'w_whirlwind', name: 'Whirlwind', unlockLevel: 8, manaCost: 16, type: 'physical', multiplier: 1.8, description: 'A spinning multi-hit strike.' },
    { id: 'w_last_stand', name: 'Last Stand', unlockLevel: 12, manaCost: 20, type: 'physical', multiplier: 2.4, description: 'An all-out desperate attack.' },
  ],
  mage: [
    { id: 'm_firebolt', name: 'Firebolt', unlockLevel: 1, manaCost: 8, type: 'magic', multiplier: 1.5, burn: 2, description: 'A bolt of fire, may burn.' },
    { id: 'm_frost_nova', name: 'Frost Nova', unlockLevel: 3, manaCost: 12, type: 'magic', multiplier: 1.2, slow: 1, description: 'Chilling burst that slows the enemy.' },
    { id: 'm_arcane_shield', name: 'Arcane Shield', unlockLevel: 5, manaCost: 10, type: 'shield', shieldAmount: 1.5, description: 'Absorb incoming damage.' },
    { id: 'm_meteor', name: 'Meteor', unlockLevel: 8, manaCost: 22, type: 'magic', multiplier: 2.2, description: 'A devastating meteor strike.' },
    { id: 'm_time_warp', name: 'Time Warp', unlockLevel: 12, manaCost: 18, type: 'buff', buff: { agility: 1.5 }, duration: 2, description: 'Warp time to act faster.' },
  ],
  rogue: [
    { id: 'r_backstab', name: 'Backstab', unlockLevel: 1, manaCost: 6, type: 'physical', multiplier: 1.6, critBonus: 0.15, description: 'A precise strike, high crit chance.' },
    { id: 'r_poison_blade', name: 'Poison Blade', unlockLevel: 3, manaCost: 9, type: 'physical', multiplier: 1.1, poison: 3, description: 'Poison the target over time.' },
    { id: 'r_smoke_bomb', name: 'Smoke Bomb', unlockLevel: 5, manaCost: 10, type: 'evade', evadeChance: 0.5, duration: 1, description: 'Vanish, greatly boosting evasion.' },
    { id: 'r_flurry', name: 'Flurry', unlockLevel: 8, manaCost: 16, type: 'physical', multiplier: 1.3, hits: 2, description: 'Two rapid strikes.' },
    { id: 'r_assassinate', name: 'Assassinate', unlockLevel: 12, manaCost: 24, type: 'physical', multiplier: 2.8, critBonus: 0.25, description: 'A lethal finishing blow.' },
  ],
  paladin: [
    { id: 'p_smite', name: 'Smite', unlockLevel: 1, manaCost: 7, type: 'magic', multiplier: 1.3, description: 'Holy damage to the enemy.' },
    { id: 'p_heal', name: 'Lay on Hands', unlockLevel: 3, manaCost: 12, type: 'heal', multiplier: 1.4, description: 'Heal yourself.' },
    { id: 'p_guard', name: 'Guardian Stance', unlockLevel: 5, manaCost: 10, type: 'buff', buff: { defense: 1.5 }, duration: 3, description: 'Boost your defense temporarily.' },
    { id: 'p_judgment', name: 'Judgment', unlockLevel: 8, manaCost: 18, type: 'magic', multiplier: 2.0, description: 'A righteous strike.' },
    { id: 'p_sacrifice', name: 'Sacred Sacrifice', unlockLevel: 12, manaCost: 22, type: 'heal', multiplier: 2.2, description: 'A powerful self-heal.' },
  ],
};
