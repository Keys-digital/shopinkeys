const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

const profileSchema = new mongoose.Schema({
  bio: {
    type: String,
    maxlength: [300, "Bio cannot exceed 300 characters"],
    trim: true,
  },
  avatar: {
    type: String,
    default: "https://example.com/default-avatar.png",
  },
  socialLinks: {
    type: Map,
    of: String, // Example: { "twitter": "https://twitter.com/user" }
  },
});

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters long"],
      maxlength: [50, "Name must not exceed 50 characters"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true, //  DB-level uniqueness
      lowercase: true, //  enforce case-insensitive uniqueness
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [30, "Username must not exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        "Username can only contain letters, numbers, underscores, or hyphens",
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, //  DB-level uniqueness
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      maxlength: [100, "Password must not exceed 100 characters"],
      select: false,
    },
    role: {
      type: String,
      enum: ["Admin", "Collaborator", "Editor", "Registered User"],
      required: true,
      default: "Registered User",
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    profile: {
      type: profileSchema,
      default: {},
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

//  Hash password before saving
userSchema.pre("save", function (next) {
  if (!this.isModified("password")) return next();
  this.password = bcryptjs.hashSync(this.password, 10);
  next();
});

//  Hash password when updating
userSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.password) {
    update.password = bcryptjs.hashSync(update.password, 10);
  }
  next();
});

//  Compare password method
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcryptjs.compareSync(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
