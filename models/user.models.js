import mongoose, { model, Schema, Types } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    group: {
      type: String,
      required: true,
      default: "0",
    },
    password: {
      type: String,
      required: true,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isSS: {
      type: Boolean,
      default: false,
    },
    isSCards: {
      type: Boolean,
      default: false,
    },
    uid: {
      type: String,
      default: "",
    },
    codUser: {
      type: Number,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

// Middleware para resetar privilégios caso o grupo seja alterado
userSchema.pre("save", function (next) {
  if (this.isModified("group")) {
    this.isAdmin = false;
    this.isSS = false;
    this.isSCards = false;
  }
  next();
});

const User = model("User", userSchema);
export default User;
