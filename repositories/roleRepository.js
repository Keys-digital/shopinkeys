const Role = require("../models/Role");
const winston = require("../utils/logger");

/**
 * Find a role by filter
 */
exports.findRole = async (filter) => {
  try {
    return await Role.findOne(filter).lean();
  } catch (error) {
    winston.error(`Error finding role: ${error.message}`);
    throw error; // Let service layer handle response
  }
};

/**
 * Create a new role
 */
exports.createRole = async (data) => {
  try {
    const newRole = new Role(data);
    return await newRole.save();
  } catch (error) {
    winston.error(`Error creating role: ${error.message}`);
    throw error;
  }
};

/**
 * Update a role
 */
exports.updateRole = async (filter, update) => {
  try {
    return await Role.findOneAndUpdate(filter, update, { new: true }).lean();
  } catch (error) {
    winston.error(`Error updating role: ${error.message}`);
    throw error;
  }
};

/**
 * Delete a role
 */
exports.deleteRole = async (filter) => {
  try {
    return await Role.findOneAndDelete(filter).lean();
  } catch (error) {
    winston.error(`Error deleting role: ${error.message}`);
    throw error;
  }
};
