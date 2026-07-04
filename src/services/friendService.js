const User = require('../models/User');

async function sendFriendRequest(fromUser, toUser) {
  if (String(fromUser._id) === String(toUser._id)) throw new Error("You can't friend yourself.");
  if (fromUser.friends.some((id) => String(id) === String(toUser._id))) {
    throw new Error('You are already friends.');
  }
  if (toUser.friendRequestsIncoming.some((id) => String(id) === String(fromUser._id))) {
    throw new Error('Friend request already sent.');
  }

  toUser.friendRequestsIncoming.push(fromUser._id);
  fromUser.friendRequestsOutgoing.push(toUser._id);
  await toUser.save();
  await fromUser.save();
}

async function acceptFriendRequest(user, requesterId) {
  if (!user.friendRequestsIncoming.some((id) => String(id) === String(requesterId))) {
    throw new Error('No such friend request.');
  }

  const requester = await User.findById(requesterId);
  if (!requester) throw new Error('Requesting user no longer exists.');

  user.friendRequestsIncoming = user.friendRequestsIncoming.filter((id) => String(id) !== String(requesterId));
  requester.friendRequestsOutgoing = requester.friendRequestsOutgoing.filter((id) => String(id) !== String(user._id));

  user.friends.push(requester._id);
  requester.friends.push(user._id);

  await user.save();
  await requester.save();
}

async function declineFriendRequest(user, requesterId) {
  user.friendRequestsIncoming = user.friendRequestsIncoming.filter((id) => String(id) !== String(requesterId));
  await user.save();

  const requester = await User.findById(requesterId);
  if (requester) {
    requester.friendRequestsOutgoing = requester.friendRequestsOutgoing.filter((id) => String(id) !== String(user._id));
    await requester.save();
  }
}

async function getFriendsList(user) {
  return User.find({ _id: { $in: user.friends } });
}

module.exports = { sendFriendRequest, acceptFriendRequest, declineFriendRequest, getFriendsList };
