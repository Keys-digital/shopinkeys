// seedTestDB.js
const mongoose = require("mongoose");
const Role = require("../../models/Role");
const User = require("../../models/User");

async function seedTestDB() {
    // Clear existing data
    await Role.deleteMany({});
    await User.deleteMany({});

    // Create roles
    const roleNames = ["Registered User", "Collaborator", "Editor", "Admin", "Super Admin"];
    await Promise.all(roleNames.map(name => Role.create({ name })));

    // Fetch roles
    const registeredUserRole = await Role.findOne({ name: "Registered User" });
    const collabRole = await Role.findOne({ name: "Collaborator" });
    const editorRole = await Role.findOne({ name: "Editor" });
    const adminRole = await Role.findOne({ name: "Admin" });
    const superAdminRole = await Role.findOne({ name: "Super Admin" });

    // Create baseline users
    const users = [
        { name: "Frank Praise", email: "frankpraise@example.com", username: "frankpraise", password: "password123", role: "Super Admin" },
        { name: "Sarah Johnson", email: "sarahjohnson@example.com", username: "sarahjohnson", password: "password123", role: "Admin" },
        { name: "John Doe", email: "johndoe@example.com", username: "johndoe", password: "password123", role: "Editor" },
        { name: "Jane Smith", email: "janesmith@example.com", username: "janesmith", password: "password123", role: "Collaborator" },
        { name: "Bob Johnson", email: "bobjohnson@example.com", username: "bobjohnson", password: "password123", role: "Registered User" },
    ];



    for (const userData of users) {
        await User.create({ ...userData, isEmailVerified: true });
    }

    console.log("Test DB seeded with roles and baseline users.");
}

module.exports = seedTestDB;
