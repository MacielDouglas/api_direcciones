import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.models.js";
import Card from "../models/card.models.js";
import Address from "../models/address.models.js";

// Auth Utils
export const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      isAdmin: user.isAdmin,
      name: user.name,
      isSS: user.isSS,
      group: user.group,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
};

export const setTokenCookie = (res, token) => {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 3600000, // 1 hora
  });
};

export const sanitizeUser = (user) => {
  const {
    _id,
    isAdmin,
    name,
    profilePicture,
    group,
    isSS,
    myCards,
    myTotalCards,
    comments,
    codUser,
  } = user;
  return {
    id: _id,
    isAdmin,
    name,
    profilePicture,
    group,
    isSS,
    myCards,
    myTotalCards,
    comments,
    codUser,
  };
};

export const validateUserCredentials = async (email, password) => {
  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new Error("Credenciais inválidas.");

  if (password !== "google") {
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) throw new Error("Credenciais inválidas.");
  }

  return user;
};

export const verifyAuthorization = (req) => {
  const authorizationHeader = req.headers.cookie;
  if (!authorizationHeader)
    throw new Error("Token de autorização não fornecido.");

  const token = authorizationHeader.split("access_token=")[1];
  if (!token) throw new Error("Acesso negado. Token inválido ou ausente.");

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    const errorMessage =
      error.name === "TokenExpiredError"
        ? "Sessão expirada. Faça login novamente."
        : "Acesso negado. Token inválido.";
    throw new Error(errorMessage);
  }
};

// Card Utils
export const validateObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("ID inválido.");
};

export const findCardById = async (id) => {
  validateObjectId(id);
  const card = await Card.findById(id).lean();
  if (!card) throw new Error("Cartão não encontrado.");
  return { ...card, id: card._id.toString() };
};

export const findNextNumber = async () => {
  const existingNumbers = await Card.find().distinct("number").exec();

  if (existingNumbers.length === 0) return 1;

  const uniqueNumbers = existingNumbers.map(Number).sort((a, b) => a - b);
  for (let i = 0; i < uniqueNumbers.length - 1; i++) {
    if (uniqueNumbers[i + 1] !== uniqueNumbers[i] + 1)
      return uniqueNumbers[i] + 1;
  }

  return uniqueNumbers[uniqueNumbers.length - 1] + 1;
};

// Address Utils

export const clients = new Set(); // Armazena as conexões dos clientes

export const notifyClients = async () => {
  try {
    const cardsWithAddresses = await sendUpdatedCards(); // Busca os cartões atualizados

    // Envia os dados para todos os clientes conectados
    clients.forEach((res) => {
      if (res && typeof res.write === "function") {
        res.write(`data: ${JSON.stringify(cardsWithAddresses)}\n\n`);
      } else {
        // Remove conexões inválidas
        clients.delete(res);
      }
    });
  } catch (error) {
    console.error("Erro ao notificar clientes:", error.message);
  }
};

export const sendUpdatedCards = async (res = null) => {
  try {
    const cards = (await Card.find({}).lean()) || [];
    const cardsWithAddresses = await Promise.all(
      cards.map(async (card) => {
        const addresses = await Address.find({
          _id: { $in: card.street || [] },
        }).lean();

        return {
          ...card,
          id: card._id.toString(),
          street: addresses.map((address) => ({
            ...address,
            id: address._id.toString(),
          })),
        };
      })
    );

    // Envia os cartões atualizados via SSE (se res estiver definido)
    if (res && typeof res.write === "function") {
      res.write(`data: ${JSON.stringify(cardsWithAddresses)}\n\n`);
    }

    return cardsWithAddresses;
  } catch (error) {
    console.error("Erro ao buscar cartões:", error.message);

    // Envia o erro via SSE (se res estiver definido)
    if (res && typeof res.write === "function") {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    }

    return [];
  }
};

// General Utils
export const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export const hashToNumbers = async (
  input,
  min = 10000,
  max = 99999,
  algorithm = "SHA-256"
) => {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("Input must be a non-empty string.");
  }

  if (min >= max || max - min < 10000) {
    throw new Error(
      "Invalid range: Ensure that max > min and the range is at least 10,000."
    );
  }

  // Converte a string para um ArrayBuffer
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Cria o hash
  const hashBuffer = await crypto.subtle.digest(algorithm, data);

  // Converte o ArrayBuffer para um array de bytes
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Reduz o hash para um número no intervalo definido
  const range = max - min;
  const uniqueNumber =
    hashArray.reduce((acc, byte) => {
      return (acc * 256 + byte) % range;
    }, 0) + min;

  return uniqueNumber;
};

// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import mongoose from "mongoose";
// import User from "../models/user.models.js";
// import Card from "../models/card.models.js";
// import Address from "../models/address.models.js";

// // ======= Funções de Utilidade de Usuário =======

// export const createToken = (user) => {
//   return jwt.sign(
//     {
//       userId: user._id,
//       isAdmin: user.isAdmin,
//       name: user.name,
//       isSS: user.isSS,
//       group: user.group,
//     },
//     process.env.JWT_SECRET,
//     { expiresIn: "1h" }
//   );
// };

// export const existing = async (id, type) => {
//   validateObjectId(id);
//   const models = { user: User, card: Card };
//   const Model = models[type];

//   if (!Model) throw new Error("Tipo inválido!");

//   try {
//     const document = await Model.findById(id);
//     if (!document) throw new Error(`${capitalize(type)} não encontrado.`);
//     return document;
//   } catch (error) {
//     throw new Error("Erro ao buscar o documento.");
//   }
// };

// export const setTokenCookie = (res, token) => {
//   res.cookie("access_token", token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
//     maxAge: 3600000, // 1 hora
//   });
// };

// export const sanitizeUser = (user) => {
//   const {
//     _id,
//     isAdmin,
//     name,
//     profilePicture,
//     group,
//     isSS,
//     myCards,
//     myTotalCards,
//     comments,
//     codUser,
//   } = user;
//   return {
//     id: _id,
//     isAdmin,
//     name,
//     profilePicture,
//     group,
//     isSS,
//     myCards,
//     myTotalCards,
//     comments,
//     codUser,
//   };
// };

// export const validateUserCredentials = async (email, password) => {
//   try {
//     const user = await User.findOne({ email }).select("+password");
//     if (!user) throw new Error("Credenciais inválidas.");

//     if (password !== "google") {
//       const isValidPassword = await bcrypt.compare(password, user.password);
//       if (!isValidPassword) throw new Error("Credenciais inválidas.");
//     }

//     return user;
//   } catch (error) {
//     throw new Error("Erro ao buscar o usuário.");
//   }
// };

// export const verifyAuthorization = (req) => {
//   const authorizationHeader = req.headers.cookie;
//   if (!authorizationHeader)
//     throw new Error("Token de autorização não fornecido.");

//   const token = authorizationHeader.split("access_token=")[1];

//   if (!token) throw new Error("Acesso negado. Token inválido ou ausente.");

//   try {
//     return jwt.verify(token, process.env.JWT_SECRET);
//   } catch (error) {
//     const errorMessage =
//       error.name === "TokenExpiredError"
//         ? "Sessão expirada. Faça login novamente."
//         : "Acesso negado. Token inválido.";
//     throw new Error(errorMessage);
//   }
// };

// // ======= Funções de Utilidade de Cartão =======

// export const validateObjectId = (id) => {
//   if (!mongoose.Types.ObjectId.isValid(id)) throw new Error("ID inválido.");
// };

// export const findCardById = async (id) => {
//   validateObjectId(id);
//   const card = await Card.findById(id).lean();
//   if (!card) throw new Error("Cartão não encontrado.");
//   return { ...card, id: card._id.toString() };
// };

// export const findNextNumber = async () => {
//   const existingNumbers = await Card.find().distinct("number").exec();

//   if (existingNumbers.length === 0) return 1;

//   const uniqueNumbers = existingNumbers.map(Number).sort((a, b) => a - b);
//   for (let i = 0; i < uniqueNumbers.length - 1; i++) {
//     if (uniqueNumbers[i + 1] !== uniqueNumbers[i] + 1)
//       return uniqueNumbers[i] + 1;
//   }

//   return uniqueNumbers[uniqueNumbers.length - 1] + 1;
// };

// // ======= Funções Auxiliares =======

// const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

// export const hashToNumbers = async (
//   input,
//   min = 10000,
//   max = 99999,
//   algorithm = "SHA-256"
// ) => {
//   if (typeof input !== "string" || input.trim() === "") {
//     throw new Error("Input must be a non-empty string.");
//   }

//   if (min >= max || max - min < 10000) {
//     throw new Error(
//       "Invalid range: Ensure that max > min and the range is at least 10,000."
//     );
//   }

//   // Converte a string para um ArrayBuffer
//   const encoder = new TextEncoder();
//   const data = encoder.encode(input);

//   // Cria o hash
//   const hashBuffer = await crypto.subtle.digest(algorithm, data);

//   // Converte o ArrayBuffer para um array de bytes
//   const hashArray = Array.from(new Uint8Array(hashBuffer));

//   // Reduz o hash para um número no intervalo definido
//   const range = max - min;
//   const uniqueNumber =
//     hashArray.reduce((acc, byte) => {
//       return (acc * 256 + byte) % range;
//     }, 0) + min;

//   return uniqueNumber;
// };

// export const clients = new Set(); // Armazena as conexões dos clientes

// export const notifyClients = async () => {
//   try {
//     const cardsWithAddresses = await sendUpdatedCards(); // Busca os cartões atualizados

//     // Envia os dados para todos os clientes conectados
//     clients.forEach((res) => {
//       if (res && typeof res.write === "function") {
//         res.write(`data: ${JSON.stringify(cardsWithAddresses)}\n\n`);
//       } else {
//         // Remove conexões inválidas
//         clients.delete(res);
//       }
//     });
//   } catch (error) {
//     console.error("Erro ao notificar clientes:", error.message);
//   }
// };

// export const sendUpdatedCards = async (res = null) => {
//   try {
//     const cards = (await Card.find({}).lean()) || [];
//     const cardsWithAddresses = await Promise.all(
//       cards.map(async (card) => {
//         const addresses = await Address.find({
//           _id: { $in: card.street || [] },
//         }).lean();

//         return {
//           ...card,
//           id: card._id.toString(),
//           street: addresses.map((address) => ({
//             ...address,
//             id: address._id.toString(),
//           })),
//         };
//       })
//     );

//     // Envia os cartões atualizados via SSE (se res estiver definido)
//     if (res && typeof res.write === "function") {
//       res.write(`data: ${JSON.stringify(cardsWithAddresses)}\n\n`);
//     }

//     return cardsWithAddresses;
//   } catch (error) {
//     console.error("Erro ao buscar cartões:", error.message);

//     // Envia o erro via SSE (se res estiver definido)
//     if (res && typeof res.write === "function") {
//       res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
//     }

//     return [];
//   }
// };
