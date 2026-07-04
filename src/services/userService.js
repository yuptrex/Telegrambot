const User = require('../models/User');

/** Get an existing user by telegramId, or create one on first contact. */
async function getOrCreateUser(ctxFrom) {
  const telegramId = String(ctxFrom.id);
  let user = await User.findOne({ telegramId });

  if (!user) {
    user = await User.create({
      telegramId,
      username: ctxFrom.username || null,
      firstName: ctxFrom.first_name || null,
    });
  } else {
    // keep username/firstName fresh in case they changed it on Telegram
    let dirty = false;
    if (ctxFrom.username && ctxFrom.username !== user.username) {
      user.username = ctxFrom.username;
      dirty = true;
    }
    if (ctxFrom.first_name && ctxFrom.first_name !== user.firstName) {
      user.firstName = ctxFrom.first_name;
      dirty = true;
    }
    if (dirty) await user.save();
  }

  return user;
}

async function setSessionValue(userId, key, value) {
  const user = await User.findById(userId);
  if (!user) return null;
  user.session = { ...(user.session || {}), [key]: value };
  user.markModified('session');
  await user.save();
  return user;
}

async function clearSessionValue(userId, key) {
  const user = await User.findById(userId);
  if (!user) return null;
  if (user.session) {
    delete user.session[key];
    user.markModified('session');
    await user.save();
  }
  return user;
}

module.exports = { getOrCreateUser, setSessionValue, clearSessionValue };
