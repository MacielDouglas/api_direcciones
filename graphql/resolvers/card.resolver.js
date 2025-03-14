import Card from "../../models/card.models.js";
import User from "../../models/user.models.js";
import Address from "../../models/address.models.js";
import {
  findCardById,
  findNextNumber,
  validateObjectId,
  verifyAuthorization,
} from "../../utils/utils.js";
import { pubsub } from "../../index.js";

const CARD_UPDATED = "CARD_UPDATED";

const sendUpdatedCards = async () => {
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

  console.log(
    "REusltado do PUB",
    await pubsub.publish(CARD_UPDATED, { card: cardsWithAddresses })
  );
  console.log(
    "REusltado do PUB com json forçado: ",
    await pubsub.publish(CARD_UPDATED, {
      card: JSON.stringify(cardsWithAddresses),
    })
  );

  await pubsub.publish(CARD_UPDATED, {
    card: cardsWithAddresses, // ✅ Enviar como objeto, não como string!
  });

  return cardsWithAddresses;
};

const cardResolver = {
  Query: {
    card: async (_, __, { req }) => {
      try {
        verifyAuthorization(req);
        const cards = await sendUpdatedCards(); // Chama a função, mas capture o valor.
        return cards || []; // Garante que um valor válido seja retornado (mesmo que seja uma lista vazia).
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

        const number = await findNextNumber();
        const card = new Card({
          ...newCard,
          number: number,
          group: decodedToken.group,
          usersAssigned: [],
        });
        await card.save();

        await sendUpdatedCards();
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
        validateObjectId(id);

        const card = await findCardById(id);
        if (!card) throw new Error("Cartão não encontrado.");

        let updatedStreet = [...card.street]; // Mantém os valores existentes

        if (street && Array.isArray(street)) {
          for (const streetId of street) {
            validateObjectId(streetId);

            // Remove o ID do campo street se já estiver no cartão
            if (updatedStreet.includes(streetId)) {
              updatedStreet = updatedStreet.filter((sId) => sId !== streetId);
            } else {
              // Verifica se o ID está em outro cartão, ignorando o próprio
              const existingCard = await Card.findOne({
                street: streetId,
                _id: { $ne: id },
              });
              if (existingCard) {
                throw new Error(
                  `O endereço ${streetId} já está vinculado a outro cartão.`
                );
              }
              // Se não está em outro cartão, adiciona
              updatedStreet.push(streetId);
            }
          }
        }

        // Remove duplicatas de street
        updatedStreet = [...new Set(updatedStreet)];

        // Se a lista de `street` estiver vazia, deletar o cartão
        if (updatedStreet.length === 0) {
          await Card.findByIdAndDelete(id);
          return {
            message: "Cartão deletado, pois não há mais endereços associados.",
            success: true,
            card: null,
          };
        }

        // Atualiza o cartão com a nova lista de endereços
        const updatedCard = await Card.findByIdAndUpdate(
          id,
          { street: updatedStreet },
          { new: true }
        );

        await sendUpdatedCards();
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
        validateObjectId(id);
        await Card.deleteOne({ _id: id });
        await sendUpdatedCards();
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

        const user = await User.findById(userId);
        if (!user) throw new Error("Usuário não encontrado.");

        if (decodedToken.group !== user.group) {
          throw new Error(
            "Você não pode enviar um card para um usuário que não é do seu grupo."
          );
        }

        const currentDate = new Date().toISOString();

        // Verificar e atualizar múltiplos cartões
        const updatedCards = await Promise.all(
          cardIds.map(async (cardId) => {
            const card = await Card.findById(cardId);
            if (!card) {
              throw new Error(`Cartão com ID ${cardId} não encontrado.`);
            }

            // Verificar se o cartão já está em uso (startDate não é null)
            if (card.startDate !== null) {
              throw new Error(`Cartão com ID ${cardId} já está em uso.`);
            }

            // Atualizar o cartão e garantir que ele seja retornado com o campo 'id' válido
            const updatedCard = await Card.findByIdAndUpdate(
              cardId,
              {
                $set: {
                  startDate: currentDate, // Definir o startDate para a data atual
                  endDate: null, // Garantir que o endDate é null
                },
                $push: {
                  usersAssigned: { userId, date: currentDate },
                },
              },
              { new: true } // Retorna o documento atualizado
            );

            // Se o cartão não foi encontrado ou atualizado corretamente
            if (!updatedCard || !updatedCard._id) {
              throw new Error(`Erro ao atualizar o cartão com ID ${cardId}.`);
            }

            // Converter o _id para uma string antes de retornar
            updatedCard.id = updatedCard._id.toString();
            delete updatedCard._id; // Remover o _id original, pois já estamos usando 'id'

            return updatedCard; // Retorna o cartão atualizado com o campo 'id' como string
          })
        );

        await sendUpdatedCards();
        return {
          message: `Cartões designados para o usuário ${user.name}.`,
          success: true,
          card: updatedCards, // Retorna a lista de cartões atualizados
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
        const decodedToken = verifyAuthorization(req);
        if (!decodedToken) throw new Error("Você não tem permissão.");

        const { userId, cardId } = returnCardInput;
        if (!userId || !cardId)
          throw new Error("ID do usuário e do cartão são necessários.");

        const card = await Card.findById(cardId);
        if (!card) throw new Error("Cartão não encontrado.");

        const lastAssignedUser = card.usersAssigned.at(-1);
        if (!lastAssignedUser || lastAssignedUser.userId.toString() !== userId)
          throw new Error("Cartão não pertence a esse usuário.");

        const currentDate = new Date().toISOString();

        // Atualizar o cartão para indicar a devolução
        const cardReturn = await Card.findByIdAndUpdate(
          cardId,
          {
            $set: {
              startDate: null,
              endDate: currentDate,
              usersAssigned: [], // Garantir que usersAssigned seja uma lista vazia
            },
          },
          { new: true } // Retorna o cartão atualizado
        );

        // Retornar o cartão como um item em uma lista
        await sendUpdatedCards();
        return {
          message: "Cartão devolvido com sucesso.",
          success: true,
          card: cardReturn, // Coloca o cartão em uma lista para atender à expectativa do GraphQL
        };
      } catch (error) {
        return {
          message: `Erro ao devolver cartão: ${error.message}`,
          success: false,
        };
      }
    },
  },

  Subscription: {
    card: {
      subscribe: () => pubsub.asyncIterableIterator([CARD_UPDATED]),
      resolve: (payload) => {
        console.log("🔹 Dados enviados para o cliente:", payload);
        return JSON.parse(JSON.stringify(payload)); // Garante que seja JSON válido
      },
    },
  },
};
// Subscription: {
//   card: {
//     subscribe: async () => {
//       console.log("📡 Nova inscrição para a subscription CARD_UPDATED");
//       return pubsub.asyncIterator([CARD_UPDATED]); // Use asyncIterator
//     },
//   },
// },

export default cardResolver;
