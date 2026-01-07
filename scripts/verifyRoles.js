const roleController = require("../controllers/role.controller");

// Mock Logger
const logger = require("../utils/logger");
logger.info = console.log;
logger.warn = console.log;
logger.error = console.error;

// Mock StatusCodes
const StatusCodes = {
    OK: 200,
    BAD_REQUEST: 400,
    FORBIDDEN: 403,
    SERVER_ERROR: 500,
};
// Mock utils/statusCodes if it's a module
jest = { fn: (impl) => impl }; // Simple mock if needed, but we can just replace require

// We need to intercept require calls or just mock the modules if we were using a test runner.
// Since we are running with node, we can't easily intercept require unless we use a library.
// BUT, the controller requires them.
// So we might need to rely on the fact that `require` caches modules.
// We can try to pre-load the modules and modify them.

const userRepository = require("../repositories/userRepository");
const User = require("../models/User");

// Mock Data
const mockUsers = {
    superadmin: { _id: "superadmin_id", role: "Super Admin", save: async () => { } },
    admin: { _id: "admin_id", role: "Admin", save: async () => { } },
    user: { _id: "user_id", role: "Registered User", save: async () => { } },
    targetAdmin: { _id: "target_admin_id", role: "Admin", save: async () => { } },
};

// Mock Repository
userRepository.findUser = async (filter) => {
    if (filter.id === "user_id") return mockUsers.user;
    if (filter.id === "superadmin_id") return mockUsers.superadmin;
    if (filter.id === "admin_id") return mockUsers.admin;
    if (filter.id === "target_admin_id") return mockUsers.targetAdmin;
    return null;
};

// Mock User Model
User.countDocuments = async (filter) => {
    if (filter.role === "Admin") {
        // Return 1 if we are testing the "last admin" scenario
        // We can control this via a global flag or just return 2 by default
        return global.mockAdminCount !== undefined ? global.mockAdminCount : 2;
    }
    return 0;
};

// Mock Response
const createResponse = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.data = data;
        return res;
    };
    return res;
};

async function runVerification() {
    console.log("Starting Verification (Mocked)...");

    // --- Scenario 1: Super Admin assigns Admin role to User ---
    console.log("\n--- Scenario 1: Super Admin assigns Admin role to User ---");
    let req = {
        user: { id: "superadmin_id", role: "Super Admin" },
        body: { userId: "user_id", roleName: "Admin" },
    };
    let res = createResponse();

    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

    // --- Scenario 2: Admin tries to assign Super Admin role to User ---
    console.log("\n--- Scenario 2: Admin tries to assign Super Admin role to User ---");
    req = {
        user: { id: "admin_id", role: "Admin" },
        body: { userId: "user_id", roleName: "Super Admin" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

    // --- Scenario 3: Admin tries to assign Admin role to User ---
    console.log("\n--- Scenario 3: Admin tries to assign Admin role to User ---");
    req = {
        user: { id: "admin_id", role: "Admin" },
        body: { userId: "user_id", roleName: "Admin" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

    // --- Scenario 4: Admin assigns Collaborator role to User ---
    console.log("\n--- Scenario 4: Admin assigns Collaborator role to User ---");
    req = {
        user: { id: "admin_id", role: "Admin" },
        body: { userId: "user_id", roleName: "Collaborator" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

    // --- Scenario 5: Admin tries to modify Super Admin ---
    console.log("\n--- Scenario 5: Admin tries to modify Super Admin ---");
    // Temporarily set user role to Super Admin for this test
    mockUsers.user.role = "Super Admin";
    req = {
        user: { id: "admin_id", role: "Admin" },
        body: { userId: "user_id", roleName: "Collaborator" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);
    mockUsers.user.role = "Registered User"; // Reset

    // --- Scenario 6: Super Admin demotes last Admin ---
    console.log("\n--- Scenario 6: Super Admin demotes last Admin ---");
    global.mockAdminCount = 1; // Simulate only 1 admin
    req = {
        user: { id: "superadmin_id", role: "Super Admin" },
        body: { userId: "target_admin_id", roleName: "Registered User" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

    // --- Scenario 7: Admin tries to demote last Admin (themselves or another) ---
    console.log("\n--- Scenario 7: Admin tries to demote last Admin ---");
    global.mockAdminCount = 1;
    req = {
        user: { id: "admin_id", role: "Admin" },
        body: { userId: "target_admin_id", roleName: "Registered User" },
    };
    res = createResponse();
    await roleController.assignRoleToUser(req, res);
    console.log(`Status: ${res.statusCode}`);
    console.log(`Response: ${JSON.stringify(res.data)}`);

}

runVerification();
