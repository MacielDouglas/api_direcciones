import { model, Schema, Types } from "mongoose";

const addressSchema = new Schema(
  {
    street: {
      type: String,
      required: [true, "O campo 'street' é obrigatório."],
      trim: true,
      minlength: [3, "O campo 'street' deve ter no mínimo 3 caracteres."],
      maxlength: [100, "O campo 'street' deve ter no máximo 100 caracteres."],
    },
    number: {
      type: String,
      required: [true, "O campo 'number' é obrigatório."],
      // match: [
      //   /^\d+[a-zA-Z]?$/,
      //   "O campo 'number' deve conter um número válido (ex: '123', '123A').",
      // ],
    },
    city: {
      type: String,
      required: [true, "O campo 'city' é obrigatório."],
      trim: true,
      minlength: [2, "O campo 'city' deve ter no mínimo 2 caracteres."],
      maxlength: [60, "O campo 'city' deve ter no máximo 60 caracteres."],
    },
    neighborhood: {
      type: String,
      required: [true, "O campo 'neighborhood' é obrigatório."],
      trim: true,
      minlength: [2, "O campo 'neighborhood' deve ter no mínimo 2 caracteres."],
      maxlength: [
        60,
        "O campo 'neighborhood' deve ter no máximo 60 caracteres.",
      ],
    },
    gps: {
      type: String,
      validate: {
        validator: function (v) {
          return /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?((1[0-7]\d|\d{1,2})(\.\d+)?|180(\.0+)?)$/.test(
            v
          );
        },
        message: (props) => `${props.value} não é uma coordenada GPS válida!`,
      },
    },
    complement: {
      type: String,
      maxlength: [
        250,
        "O campo 'complement' deve ter no máximo 250 caracteres.",
      ],
      set: function (v) {
        const regex =
          /\b(homem(ens)?|hombre(s)?|mulher(es)?|muj(er|eres)?|criança|jovem|niño|niña|muchacho|muchacha|per(u|uano|uana|uanos|uanas)?|argentin(a|o|as|os)?|chil(e|eno|ena|enos|enas)?|urugua(y|i)(o|a|os|as)?|paragua(y|i)(o|a|os|as)?|venezuel(a|ano|ana|anas|anos)?|bolivi(a|ano|ana|anos|anas)?|cub(a|ano|ana|anos|anas)?|equad(or|oriano|oriana|orianos|orianas)?|colombi(a|ano|ana|anos|anas)?|ecuat(or|oriano|oriana|orianos|orianas)?)\b/gi;
        return v ? v.replace(regex, "*****") : v;
      },
    },
    type: {
      type: String,
      required: [true, "O campo 'type' é obrigatório."],
      enum: {
        values: ["house", "department", "store", "hotel", "restaurant"],
        message:
          "O campo 'type' deve ser 'house', 'department', 'store', 'hotel' ou 'restaurant'.",
      },
    },
    photo: {
      type: String,
      maxlength: [500, "O campo 'photo' deve ter no máximo 500 caracteres."],
    },
    userId: {
      type: Types.ObjectId, // Substituir String por ObjectId
      ref: "User", // Referência ao modelo User
      required: [true, "O campo 'userId' é obrigatório."],
    },
    active: {
      type: Boolean,
      default: true, // Define padrão como ativo
    },
    confirmed: {
      type: Boolean,
      required: true,
      // default: false, // Define padrão como não confirmado
    },
    group: {
      type: String,
      required: true,
    },
    visited: {
      type: Boolean,
      required: true,
      // enum: ["yes", "no", null],
      // default: false,
      // message: "O campo 'visited' deve ser 'yes', 'no' ou vazio.",
    },
  },
  { timestamps: true }
);

const Address = model("Address", addressSchema);

export default Address;
