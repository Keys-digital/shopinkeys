const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      enum: ["Admin", "Collaborator", "Editor", "Registered User"],
      required: true,
      unique: true,
    },
    permissions: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return (
            Array.isArray(arr) && arr.every((perm) => typeof perm === "string")
          );
        },
        message: "Permissions must be an array of strings",
      },
    },
  },
  { timestamps: true }
);

const Role = mongoose.model("Role", roleSchema);

module.exports = Role;
