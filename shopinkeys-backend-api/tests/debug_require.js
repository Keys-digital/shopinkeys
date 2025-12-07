const path = require("path");

console.log("Checking constants...");
try {
    const constants = require("../constants");
    console.log("Constants loaded:", Object.keys(constants));
} catch (e) {
    console.error("Failed loading constants:", e);
}

console.log("Checking validationSchemas...");
try {
    const schemas = require("../utils/validationSchemas");
    console.log("Schemas loaded:", Object.keys(schemas));
} catch (e) {
    console.error("Failed loading validationSchemas:", e);
}

console.log("Checking blogPost.controller...");
try {
    const controller = require("../controllers/blogPost.controller");
    console.log("Controller loaded:", Object.keys(controller));
} catch (e) {
    console.error("Failed loading blogPost.controller:", e.message);
    console.error(e.stack);
}
