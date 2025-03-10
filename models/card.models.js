import { model, Schema, Types } from "mongoose";

const cardSchema = new Schema(
  {
    street: {
      type: [{ type: Types.ObjectId, ref: "Address", required: true }],
      default: [],
    },
    userId: {
      type: Types.ObjectId,
      ref: "User",
    },
    number: {
      type: Number,
      required: true,
      unique: true,
    },
    startDate: {
      type: String,
      default: null,
    },
    endDate: {
      type: String,
      default: null,
    },
    group: {
      type: String,
      required: true,
    },
    usersAssigned: {
      type: [
        {
          userId: {
            type: Types.ObjectId,
            ref: "User",
            required: true,
          },
          date: {
            type: String,
            required: true,
          },
        },
      ],
      default: [],
    },
    assignedHistory: {
      type: [
        {
          userId: {
            type: Types.ObjectId,
            ref: "User",
            required: true,
          },
          date: {
            type: String,
            required: true,
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

// Middleware para garantir regras de data conforme usersAssigned
cardSchema.pre("save", function (next) {
  if (this.usersAssigned.length === 0) {
    if (!this.endDate) {
      this.endDate = new Date().toISOString();
    }
    this.startDate = null;
  } else {
    this.endDate = null;
    if (this.usersAssigned.length > 0) {
      this.startDate = this.usersAssigned[0].date;
      this.assignedHistory.push(...this.usersAssigned);
    }
  }
  next();
});

// Middleware para verificar duplicidade de streets
cardSchema.pre("save", async function (next) {
  const duplicateCard = await model("Card").findOne({
    street: { $in: this.street },
    _id: { $ne: this._id },
  });
  if (duplicateCard) {
    throw new Error("Os endereços já estão associados a outro cartão.");
  }
  next();
});

// Middleware para findOneAndUpdate e updateOne
const updateMiddleware = async function (next) {
  const update = this.getUpdate();
  const street = update.$set?.street || update.street;

  if (street) {
    const duplicateCard = await model("Card").findOne({
      street: { $in: street },
      _id: { $ne: this.getQuery()._id },
    });
    if (duplicateCard) {
      throw new Error("Os endereços já estão associados a outro cartão.");
    }
  }

  if (update.usersAssigned) {
    if (update.usersAssigned.length === 0) {
      update.endDate = new Date().toISOString();
      update.startDate = null;
    } else {
      update.endDate = null;
      update.startDate = update.usersAssigned[0].date;
      update.$push = update.$push || {};
      update.$push.assignedHistory = { $each: update.usersAssigned };
    }
  }
  next();
};

cardSchema.pre("updateOne", updateMiddleware);
cardSchema.pre("findOneAndUpdate", updateMiddleware);

// Método estático para limpar registros antigos em assignedHistory
cardSchema.statics.cleanOldAssignments = async function () {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  await this.updateMany(
    {},
    {
      $pull: {
        usersAssigned: { date: { $lt: oneYearAgo.toISOString() } },
        assignedHistory: { date: { $lt: oneYearAgo.toISOString() } },
      },
    }
  );
};

const Card = model("Card", cardSchema);
export default Card;
