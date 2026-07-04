const Guild = require('../models/Guild');
const User = require('../models/User');

async function createGuild(user, name, description, joinType = 'open') {
  if (user.guildId) throw new Error('You are already in a guild. Leave it first.');

  const existing = await Guild.findOne({ name });
  if (existing) throw new Error('A guild with that name already exists.');

  const guild = await Guild.create({
    name,
    description,
    leaderId: user._id,
    joinType,
    members: [{ userId: user._id, role: 'leader' }],
  });

  user.guildId = guild._id;
  await user.save();

  return guild;
}

async function joinGuild(user, guildId) {
  if (user.guildId) throw new Error('You are already in a guild. Leave it first.');
  const guild = await Guild.findById(guildId);
  if (!guild) throw new Error('Guild not found.');

  if (guild.joinType === 'invite') {
    throw new Error('This guild is invite-only. Ask an officer or leader to invite you.');
  }

  if (guild.joinType === 'request') {
    if (!guild.joinRequests.some((id) => String(id) === String(user._id))) {
      guild.joinRequests.push(user._id);
      await guild.save();
    }
    return { pending: true, guild };
  }

  // open
  guild.members.push({ userId: user._id, role: 'member' });
  await guild.save();
  user.guildId = guild._id;
  await user.save();

  return { pending: false, guild };
}

async function approveJoinRequest(guild, approverUserId, targetUserId) {
  const approver = guild.members.find((m) => String(m.userId) === String(approverUserId));
  if (!approver || !['leader', 'officer'].includes(approver.role)) {
    throw new Error('Only the leader or officers can approve join requests.');
  }

  guild.joinRequests = guild.joinRequests.filter((id) => String(id) !== String(targetUserId));
  guild.members.push({ userId: targetUserId, role: 'member' });
  await guild.save();

  await User.findByIdAndUpdate(targetUserId, { guildId: guild._id });
  return guild;
}

async function leaveGuild(user) {
  if (!user.guildId) throw new Error('You are not in a guild.');
  const guild = await Guild.findById(user.guildId);
  if (!guild) {
    user.guildId = null;
    await user.save();
    return null;
  }

  if (String(guild.leaderId) === String(user._id) && guild.members.length > 1) {
    throw new Error('As leader, transfer leadership before leaving, or disband the guild.');
  }

  guild.members = guild.members.filter((m) => String(m.userId) !== String(user._id));
  user.guildId = null;
  await user.save();

  if (guild.members.length === 0) {
    await Guild.findByIdAndDelete(guild._id);
    return null;
  }

  await guild.save();
  return guild;
}

async function contributeToTreasury(user, guild, amount) {
  if (amount <= 0) throw new Error('Contribution must be positive.');
  if (user.gold < amount) throw new Error('Insufficient gold.');

  user.gold -= amount;
  guild.treasury += amount;
  guild.exp += Math.floor(amount / 10);

  // simple guild leveling curve
  const expNeeded = guild.level * 500;
  if (guild.exp >= expNeeded) {
    guild.exp -= expNeeded;
    guild.level += 1;
  }

  await user.save();
  await guild.save();

  return guild;
}

function formatGuildCard(guild) {
  const roster = guild.members
    .map((m) => `  • ${m.role}: ${m.userId}`)
    .join('\n');
  return (
    `🏰 *${guild.name}* (Lv.${guild.level})\n` +
    `${guild.description || 'No description.'}\n` +
    `Join type: ${guild.joinType}\n` +
    `Treasury: ${guild.treasury} gold\n` +
    `Members (${guild.members.length}):\n${roster}`
  );
}

module.exports = {
  createGuild,
  joinGuild,
  approveJoinRequest,
  leaveGuild,
  contributeToTreasury,
  formatGuildCard,
};
