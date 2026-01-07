const express = require("express");
const { authenticateUser } = require("../middlewares/authMiddleware");
const { roleMiddleware } = require("../middlewares/roleMiddleware");
const { validateRoleAssignment } = require("../validations/roleValidation");
const roleHandlers = require("../controllers/role.controller");

const router = express.Router();

/**
 * Assign role to user
 * - Only Super Admins and Admins can do this
 */
router.post(
  "/assign",
  authenticateUser,
  roleMiddleware(["Super Admin", "Admin"]),
  validateRoleAssignment,
  roleHandlers.assignRoleToUser
);

/**
 * Protected role-based routes (DRY)
 */
const roleRoutes = {
  admin: "Admin",
  collaborator: "Collaborator",
  editor: "Editor",
  user: "Registered User",
};

Object.entries(roleRoutes).forEach(([path, role]) => {
  router.get(`/${path}`, authenticateUser, roleMiddleware([role]), (req, res) =>
    res.json({ msg: `Welcome ${role}!` })
  );
});

module.exports = router;
