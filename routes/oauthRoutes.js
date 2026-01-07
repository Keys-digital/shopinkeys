const express = require("express");
const passport = require("passport");
const authHandlers = require("../controllers/auth.controller");

const router = express.Router();

// Google Auth
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: "/login" }),
    authHandlers.oauthCallback
);

// Facebook Auth
router.get(
    "/facebook",
    passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
    "/facebook/callback",
    passport.authenticate("facebook", { session: false, failureRedirect: "/login" }),
    authHandlers.oauthCallback
);

module.exports = router;
