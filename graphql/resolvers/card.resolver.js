import Card from "../../models/card.models.js";
import User from "../../models/user.models.js";
import Address from "../../models/address.models.js";
import {
  findCardById,
  findNextNumber,
  notifyClients,
  sendUpdatedCards,
  validateObjectId,
  verifyAuthorization,
} from "../../utils/utils.js";

// Função para buscar todos os cartões
const fetchAllCards = async () => {
  const cards = await sendUpdatedCards();
  await notifyClients();
  return cards || [];
};

// Função para criar um novo cartão
const createNewCard = async (newCard, group) => {
  const number = await findNextNumber();
  const card = new Card({
    ...newCard,
    number: number,
    group: group,
    usersAssigned: [],
  });
  await card.save();
  await notifyClients();
  return card;
};

// Função para atualizar um cartão existente
const updateExistingCard = async (id, street) => {
  validateObjectId(id);
  const card = await findCardById(id);
  if (!card) throw new Error("Cartão não encontrado.");

  let updatedStreet = [...card.street];

  if (street && Array.isArray(street)) {
    for (const streetId of street) {
      validateObjectId(streetId);

      if (updatedStreet.includes(streetId)) {
        updatedStreet = updatedStreet.filter((sId) => sId !== streetId);
      } else {
        const existingCard = await Card.findOne({
          street: streetId,
          _id: { $ne: id },
        });
        if (existingCard) {
          throw new Error(
            `O endereço ${streetId} já está vinculado a outro cartão.`
          );
        }
        updatedStreet.push(streetId);
      }
    }
  }

  updatedStreet = [...new Set(updatedStreet)];

  if (updatedStreet.length === 0) {
    await Card.findByIdAndDelete(id);
    return null;
  }

  const updatedCard = await Card.findByIdAndUpdate(
    id,
    { street: updatedStreet },
    { new: true }
  );

  await notifyClients();
  return updatedCard;
};

// Função para deletar um cartão
const deleteExistingCard = async (id) => {
  validateObjectId(id);
  await Card.deleteOne({ _id: id });
  await notifyClients();
};

// Função para designar cartões a um usuário
const assignCardsToUser = async (userId, cardIds, group) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("Usuário não encontrado.");

  if (group !== user.group) {
    throw new Error(
      "Você não pode enviar um card para um usuário que não é do seu grupo."
    );
  }

  const currentDate = new Date().toISOString();

  const updatedCards = await Promise.all(
    cardIds.map(async (cardId) => {
      const card = await Card.findById(cardId);
      if (!card) {
        throw new Error(`Cartão com ID ${cardId} não encontrado.`);
      }

      if (card.startDate !== null) {
        throw new Error(`Cartão com ID ${cardId} já está em uso.`);
      }

      const updatedCard = await Card.findByIdAndUpdate(
        cardId,
        {
          $set: {
            startDate: currentDate,
            endDate: null,
          },
          $push: {
            usersAssigned: { userId, date: currentDate },
          },
        },
        { new: true }
      );

      if (!updatedCard || !updatedCard._id) {
        throw new Error(`Erro ao atualizar o cartão com ID ${cardId}.`);
      }

      updatedCard.id = updatedCard._id.toString();
      delete updatedCard._id;

      return updatedCard;
    })
  );

  await notifyClients();
  return updatedCards;
};

// Função para devolver um cartão
const returnCardToSystem = async (userId, cardId) => {
  const card = await Card.findById(cardId);
  if (!card) throw new Error("Cartão não encontrado.");

  const lastAssignedUser = card.usersAssigned.at(-1);
  if (!lastAssignedUser || lastAssignedUser.userId.toString() !== userId)
    throw new Error("Cartão não pertence a esse usuário.");

  const currentDate = new Date().toISOString();

  const cardReturn = await Card.findByIdAndUpdate(
    cardId,
    {
      $set: {
        startDate: null,
        endDate: currentDate,
        usersAssigned: [],
      },
    },
    { new: true }
  );

  await notifyClients();
  return cardReturn;
};

const cardResolver = {
  Query: {
    card: async (_, __, { req }) => {
      try {
        verifyAuthorization(req);
        const cards = await fetchAllCards();
        return cards;
      } catch (error) {
        throw new Error(`Erro ao buscar cartões: ${error.message}`);
      }
    },
  },

  Mutation: {
    createCard: async (_, { newCard }, { req }) => {
      try {
        const decodedToken = verifyAuthorization(req);
        if (!decodedToken) throw new Error("Você não tem permissão.");

        const card = await createNewCard(newCard, decodedToken.group);
        return { message: "Cartão criado com sucesso.", success: true, card };
      } catch (error) {
        return {
          message: `Erro ao criar cartão: ${error.message}`,
          success: false,
        };
      }
    },

    updateCard: async (_, { updateCardInput }, { req }) => {
      try {
        verifyAuthorization(req);
        const { id, street } = updateCardInput;

        const updatedCard = await updateExistingCard(id, street);
        if (!updatedCard) {
          return {
            message: "Cartão deletado, pois não há mais endereços associados.",
            success: true,
            card: null,
          };
        }

        return {
          message: "Cartão atualizado.",
          success: true,
          card: updatedCard,
        };
      } catch (error) {
        return {
          message: `Erro ao atualizar cartão: ${error.message}`,
          success: false,
        };
      }
    },

    deleteCard: async (_, { id }, { req }) => {
      try {
        verifyAuthorization(req);
        await deleteExistingCard(id);
        return { message: "Cartão deletado.", success: true };
      } catch (error) {
        return {
          message: `Erro ao deletar cartão: ${error.message}`,
          success: false,
        };
      }
    },

    assignCard: async (_, { assignCardInput }, { req }) => {
      try {
        const decodedToken = verifyAuthorization(req);
        if (
          !decodedToken ||
          (!decodedToken.isSS &&
            !decodedToken.isAdmin &&
            !decodedToken.isSCards)
        ) {
          throw new Error("Você não tem permissão para designar cards.");
        }
        if (!assignCardInput) throw new Error("Input inválido.");

        const { userId, cardIds } = assignCardInput;

        if (!userId || !Array.isArray(cardIds) || cardIds.length === 0) {
          throw new Error("Os campos 'userId' e 'cardIds' são obrigatórios.");
        }

        const updatedCards = await assignCardsToUser(
          userId,
          cardIds,
          decodedToken.group
        );
        const user = await User.findById(userId);

        return {
          message: `Cartões designados para o usuário ${user.name}.`,
          success: true,
          card: updatedCards,
        };
      } catch (error) {
        return {
          message: `Erro ao designar cartões: ${error.message}`,
          success: false,
        };
      }
    },

    returnCard: async (_, { returnCardInput }, { req }) => {
      try {
        verifyAuthorization(req);
        const { userId, cardId } = returnCardInput;
        if (!userId || !cardId)
          throw new Error("ID do usuário e do cartão são necessários.");

        const cardReturn = await returnCardToSystem(userId, cardId);
        return {
          message: "Cartão devolvido com sucesso.",
          success: true,
          card: cardReturn,
        };
      } catch (error) {
        return {
          message: `Erro ao devolver cartão: ${error.message}`,
          success: false,
        };
      }
    },
  },
};

export default cardResolver;

// import Card from "../../models/card.models.js";
// import User from "../../models/user.models.js";
// import Address from "../../models/address.models.js";
// import {
//   findCardById,
//   findNextNumber,
//   notifyClients,
//   sendUpdatedCards,
//   validateObjectId,
//   verifyAuthorization,
// } from "../../utils/utils.js";

// const cardResolver = {
//   Query: {
//     card: async (_, __, { req }) => {
//       try {
//         verifyAuthorization(req);
//         const cards = await sendUpdatedCards(); // Busca os cartões sem enviar SSE
//         await notifyClients();
//         return cards || [];
//       } catch (error) {
//         throw new Error(`Erro ao buscar cartões: ${error.message}`);
//       }
//     },
//   },

//   Mutation: {
//     createCard: async (_, { newCard }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (!decodedToken) throw new Error("Você não tem permissão.");

//         const number = await findNextNumber();
//         const card = new Card({
//           ...newCard,
//           number: number,
//           group: decodedToken.group,
//           usersAssigned: [],
//         });
//         await card.save();

//         await notifyClients(); // Atualiza os cartões
//         return { message: "Cartão criado com sucesso.", success: true, card };
//       } catch (error) {
//         return {
//           message: `Erro ao criar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     updateCard: async (_, { updateCardInput }, { req }) => {
//       try {
//         verifyAuthorization(req);
//         const { id, street } = updateCardInput;
//         validateObjectId(id);

//         const card = await findCardById(id);
//         if (!card) throw new Error("Cartão não encontrado.");

//         let updatedStreet = [...card.street];

//         if (street && Array.isArray(street)) {
//           for (const streetId of street) {
//             validateObjectId(streetId);

//             if (updatedStreet.includes(streetId)) {
//               updatedStreet = updatedStreet.filter((sId) => sId !== streetId);
//             } else {
//               const existingCard = await Card.findOne({
//                 street: streetId,
//                 _id: { $ne: id },
//               });
//               if (existingCard) {
//                 throw new Error(
//                   `O endereço ${streetId} já está vinculado a outro cartão.`
//                 );
//               }
//               updatedStreet.push(streetId);
//             }
//           }
//         }

//         updatedStreet = [...new Set(updatedStreet)];

//         if (updatedStreet.length === 0) {
//           await Card.findByIdAndDelete(id);
//           return {
//             message: "Cartão deletado, pois não há mais endereços associados.",
//             success: true,
//             card: null,
//           };
//         }

//         const updatedCard = await Card.findByIdAndUpdate(
//           id,
//           { street: updatedStreet },
//           { new: true }
//         );

//         await notifyClients();

//         // await sendUpdatedCards(); // Atualiza os cartões
//         return {
//           message: "Cartão atualizado.",
//           success: true,
//           card: updatedCard,
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao atualizar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     deleteCard: async (_, { id }, { req }) => {
//       try {
//         verifyAuthorization(req);
//         validateObjectId(id);
//         await Card.deleteOne({ _id: id });
//         await sendUpdatedCards(); // Atualiza os cartões
//         return { message: "Cartão deletado.", success: true };
//       } catch (error) {
//         return {
//           message: `Erro ao deletar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     assignCard: async (_, { assignCardInput }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (
//           !decodedToken ||
//           (!decodedToken.isSS &&
//             !decodedToken.isAdmin &&
//             !decodedToken.isSCards)
//         ) {
//           throw new Error("Você não tem permissão para designar cards.");
//         }
//         if (!assignCardInput) throw new Error("Input inválido.");

//         const { userId, cardIds } = assignCardInput;

//         if (!userId || !Array.isArray(cardIds) || cardIds.length === 0) {
//           throw new Error("Os campos 'userId' e 'cardIds' são obrigatórios.");
//         }

//         const user = await User.findById(userId);
//         if (!user) throw new Error("Usuário não encontrado.");

//         if (decodedToken.group !== user.group) {
//           throw new Error(
//             "Você não pode enviar um card para um usuário que não é do seu grupo."
//           );
//         }

//         const currentDate = new Date().toISOString();

//         const updatedCards = await Promise.all(
//           cardIds.map(async (cardId) => {
//             const card = await Card.findById(cardId);
//             if (!card) {
//               throw new Error(`Cartão com ID ${cardId} não encontrado.`);
//             }

//             if (card.startDate !== null) {
//               throw new Error(`Cartão com ID ${cardId} já está em uso.`);
//             }

//             const updatedCard = await Card.findByIdAndUpdate(
//               cardId,
//               {
//                 $set: {
//                   startDate: currentDate,
//                   endDate: null,
//                 },
//                 $push: {
//                   usersAssigned: { userId, date: currentDate },
//                 },
//               },
//               { new: true }
//             );

//             if (!updatedCard || !updatedCard._id) {
//               throw new Error(`Erro ao atualizar o cartão com ID ${cardId}.`);
//             }

//             updatedCard.id = updatedCard._id.toString();
//             delete updatedCard._id;

//             return updatedCard;
//           })
//         );

//         await notifyClients(); // Atualiza os cartões
//         return {
//           message: `Cartões designados para o usuário ${user.name}.`,
//           success: true,
//           card: updatedCards,
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao designar cartões: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     returnCard: async (_, { returnCardInput }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (!decodedToken) throw new Error("Você não tem permissão.");

//         const { userId, cardId } = returnCardInput;
//         if (!userId || !cardId)
//           throw new Error("ID do usuário e do cartão são necessários.");

//         const card = await Card.findById(cardId);
//         if (!card) throw new Error("Cartão não encontrado.");

//         const lastAssignedUser = card.usersAssigned.at(-1);
//         if (!lastAssignedUser || lastAssignedUser.userId.toString() !== userId)
//           throw new Error("Cartão não pertence a esse usuário.");

//         const currentDate = new Date().toISOString();

//         const cardReturn = await Card.findByIdAndUpdate(
//           cardId,
//           {
//             $set: {
//               startDate: null,
//               endDate: currentDate,
//               usersAssigned: [],
//             },
//           },
//           { new: true }
//         );

//         await notifyClients(); // Atualiza os cartões
//         return {
//           message: "Cartão devolvido com sucesso.",
//           success: true,
//           card: cardReturn,
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao devolver cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },
//   },
// };

// export default cardResolver;

// import Card from "../../models/card.models.js";
// import User from "../../models/user.models.js";
// import Address from "../../models/address.models.js";
// import {
//   findCardById,
//   findNextNumber,
//   validateObjectId,
//   verifyAuthorization,
// } from "../../utils/utils.js";
// import { PubSub } from "graphql-subscriptions";

// const pubsub = new PubSub();
// const CARD_UPDATED = "CARD_UPDATED";

// const sendUpdatedCards = async () => {
//   const cards = (await Card.find({}).lean()) || [];
//   const cardsWithAddresses = await Promise.all(
//     cards.map(async (card) => {
//       const addresses = await Address.find({
//         _id: { $in: card.street || [] },
//       }).lean();

//       return {
//         ...card,
//         id: card._id.toString(),
//         street: addresses.map((address) => ({
//           ...address,
//           id: address._id.toString(),
//         })),
//       };
//     })
//   );
//   pubsub.publish(CARD_UPDATED, { card: cardsWithAddresses });
//   return cardsWithAddresses; // Adiciona o retorno para a lista de cards
// };

// const cardResolver = {
//   Query: {
//     card: async (_, __, { req }) => {
//       try {
//         verifyAuthorization(req);
//         const cards = await sendUpdatedCards(); // Chama a função, mas capture o valor.
//         return cards || []; // Garante que um valor válido seja retornado (mesmo que seja uma lista vazia).
//       } catch (error) {
//         throw new Error(`Erro ao buscar cartões: ${error.message}`);
//       }
//     },
//   },

//   Mutation: {
//     createCard: async (_, { newCard }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (!decodedToken) throw new Error("Você não tem permissão.");

//         const number = await findNextNumber();
//         const card = new Card({
//           ...newCard,
//           number: number,
//           group: decodedToken.group,
//           usersAssigned: [],
//         });
//         await card.save();

//         await sendUpdatedCards();
//         return { message: "Cartão criado com sucesso.", success: true, card };
//       } catch (error) {
//         return {
//           message: `Erro ao criar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     updateCard: async (_, { updateCardInput }, { req }) => {
//       try {
//         verifyAuthorization(req);
//         const { id, street } = updateCardInput;
//         validateObjectId(id);

//         const card = await findCardById(id);
//         if (!card) throw new Error("Cartão não encontrado.");

//         let updatedStreet = [...card.street]; // Mantém os valores existentes

//         if (street && Array.isArray(street)) {
//           for (const streetId of street) {
//             validateObjectId(streetId);

//             // Remove o ID do campo street se já estiver no cartão
//             if (updatedStreet.includes(streetId)) {
//               updatedStreet = updatedStreet.filter((sId) => sId !== streetId);
//             } else {
//               // Verifica se o ID está em outro cartão, ignorando o próprio
//               const existingCard = await Card.findOne({
//                 street: streetId,
//                 _id: { $ne: id },
//               });
//               if (existingCard) {
//                 throw new Error(
//                   `O endereço ${streetId} já está vinculado a outro cartão.`
//                 );
//               }
//               // Se não está em outro cartão, adiciona
//               updatedStreet.push(streetId);
//             }
//           }
//         }

//         // Remove duplicatas de street
//         updatedStreet = [...new Set(updatedStreet)];

//         // Se a lista de `street` estiver vazia, deletar o cartão
//         if (updatedStreet.length === 0) {
//           await Card.findByIdAndDelete(id);
//           return {
//             message: "Cartão deletado, pois não há mais endereços associados.",
//             success: true,
//             card: null,
//           };
//         }

//         // Atualiza o cartão com a nova lista de endereços
//         const updatedCard = await Card.findByIdAndUpdate(
//           id,
//           { street: updatedStreet },
//           { new: true }
//         );

//         await sendUpdatedCards();
//         return {
//           message: "Cartão atualizado.",
//           success: true,
//           card: updatedCard,
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao atualizar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     deleteCard: async (_, { id }, { req }) => {
//       try {
//         verifyAuthorization(req);
//         validateObjectId(id);
//         await Card.deleteOne({ _id: id });
//         await sendUpdatedCards();
//         return { message: "Cartão deletado.", success: true };
//       } catch (error) {
//         return {
//           message: `Erro ao deletar cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     assignCard: async (_, { assignCardInput }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (
//           !decodedToken ||
//           (!decodedToken.isSS &&
//             !decodedToken.isAdmin &&
//             !decodedToken.isSCards)
//         ) {
//           throw new Error("Você não tem permissão para designar cards.");
//         }
//         if (!assignCardInput) throw new Error("Input inválido.");

//         const { userId, cardIds } = assignCardInput;

//         if (!userId || !Array.isArray(cardIds) || cardIds.length === 0) {
//           throw new Error("Os campos 'userId' e 'cardIds' são obrigatórios.");
//         }

//         const user = await User.findById(userId);
//         if (!user) throw new Error("Usuário não encontrado.");

//         if (decodedToken.group !== user.group) {
//           throw new Error(
//             "Você não pode enviar um card para um usuário que não é do seu grupo."
//           );
//         }

//         const currentDate = new Date().toISOString();

//         // Verificar e atualizar múltiplos cartões
//         const updatedCards = await Promise.all(
//           cardIds.map(async (cardId) => {
//             const card = await Card.findById(cardId);
//             if (!card) {
//               throw new Error(`Cartão com ID ${cardId} não encontrado.`);
//             }

//             // Verificar se o cartão já está em uso (startDate não é null)
//             if (card.startDate !== null) {
//               throw new Error(`Cartão com ID ${cardId} já está em uso.`);
//             }

//             // Atualizar o cartão e garantir que ele seja retornado com o campo 'id' válido
//             const updatedCard = await Card.findByIdAndUpdate(
//               cardId,
//               {
//                 $set: {
//                   startDate: currentDate, // Definir o startDate para a data atual
//                   endDate: null, // Garantir que o endDate é null
//                 },
//                 $push: {
//                   usersAssigned: { userId, date: currentDate },
//                 },
//               },
//               { new: true } // Retorna o documento atualizado
//             );

//             // Se o cartão não foi encontrado ou atualizado corretamente
//             if (!updatedCard || !updatedCard._id) {
//               throw new Error(`Erro ao atualizar o cartão com ID ${cardId}.`);
//             }

//             // Converter o _id para uma string antes de retornar
//             updatedCard.id = updatedCard._id.toString();
//             delete updatedCard._id; // Remover o _id original, pois já estamos usando 'id'

//             return updatedCard; // Retorna o cartão atualizado com o campo 'id' como string
//           })
//         );

//         await sendUpdatedCards();
//         return {
//           message: `Cartões designados para o usuário ${user.name}.`,
//           success: true,
//           card: updatedCards, // Retorna a lista de cartões atualizados
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao designar cartões: ${error.message}`,
//           success: false,
//         };
//       }
//     },

//     returnCard: async (_, { returnCardInput }, { req }) => {
//       try {
//         const decodedToken = verifyAuthorization(req);
//         if (!decodedToken) throw new Error("Você não tem permissão.");

//         const { userId, cardId } = returnCardInput;
//         if (!userId || !cardId)
//           throw new Error("ID do usuário e do cartão são necessários.");

//         const card = await Card.findById(cardId);
//         if (!card) throw new Error("Cartão não encontrado.");

//         const lastAssignedUser = card.usersAssigned.at(-1);
//         if (!lastAssignedUser || lastAssignedUser.userId.toString() !== userId)
//           throw new Error("Cartão não pertence a esse usuário.");

//         const currentDate = new Date().toISOString();

//         // Atualizar o cartão para indicar a devolução
//         const cardReturn = await Card.findByIdAndUpdate(
//           cardId,
//           {
//             $set: {
//               startDate: null,
//               endDate: currentDate,
//               usersAssigned: [], // Garantir que usersAssigned seja uma lista vazia
//             },
//           },
//           { new: true } // Retorna o cartão atualizado
//         );

//         // Retornar o cartão como um item em uma lista
//         await sendUpdatedCards();
//         return {
//           message: "Cartão devolvido com sucesso.",
//           success: true,
//           card: cardReturn, // Coloca o cartão em uma lista para atender à expectativa do GraphQL
//         };
//       } catch (error) {
//         return {
//           message: `Erro ao devolver cartão: ${error.message}`,
//           success: false,
//         };
//       }
//     },
//   },

//   Subscription: {
//     card: {
//       subscribe: () => pubsub.asyncIterator([CARD_UPDATED]),
//     },
//   },
// };

// export default cardResolver;
