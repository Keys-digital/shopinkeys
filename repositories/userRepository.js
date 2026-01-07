const User = require("../models/User");
const winston = require("../utils/logger");

exports.findOne = async (filter) => {
  try {
    return await User.findOne(filter).lean();
  } catch (error) {
    winston.error(`Error finding user: ${error.message}`);
    throw error;
  }
};

exports.findUser = async (filter) => {
  try {
    // Handle both 'id' and '_id' filter properties
    if (filter.id) {
      filter._id = filter.id;
      delete filter.id;
    }
    return await User.findOne(filter);
  } catch (error) {
    winston.error(`Error finding user: ${error.message}`);
    throw error;
  }
};

exports.findUserAndRole = async (filter) => {
  try {
    return await User.findOne(filter).populate("role", "name").lean();
  } catch (error) {
    winston.error(`Error finding user and role: ${error.message}`);
    throw error;
  }
};

exports.createUser = async (data) => {
  try {
    const newUser = new User(data);
    return await newUser.save();
  } catch (error) {
    winston.error(`Error creating user: ${error.message}`);
    throw error;
  }
};

exports.updateUser = async (filter, update) => {
  try {
    return await User.findOneAndUpdate(filter, update, {
      new: true,
      lean: true,
    });
  } catch (error) {
    winston.error(`Error updating user: ${error.message}`);
    throw error;
  }
};

exports.deleteUser = async (filter) => {
  try {
    return await User.findOneAndDelete(filter, { lean: true });
  } catch (error) {
    winston.error(`Error deleting user: ${error.message}`);
    throw error;
  }
};
