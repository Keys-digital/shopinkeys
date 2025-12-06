const formatMessage = require("../utils/messageFormatter");

const testPayload = {
  message: "hi",
};

const testUser = {
  id: "u1",
  name: "You",
};

const result = formatMessage(testPayload, testUser);

console.log(result);
