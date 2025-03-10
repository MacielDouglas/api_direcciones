import User from "../../models/user.models.js";
import Card from "../../models/card.models.js";
import Address from "../../models/address.models.js";
import bcrypt from "bcryptjs";
import {
  createToken,
  existing,
  hashToNumbers,
  sanitizeUser,
  setTokenCookie,
  validateUserCredentials,
  verifyAuthorization,
} from "../../utils/utils.js";

const userResolver = {
  Query: {
    getUsers: async (_, __, { req }) => {
      try {
        const decodedToken = verifyAuthorization(req);
        if (!decodedToken) throw new Error("Você não tem permissão.");

        const users = await User.find({}).lean();

        // ✅ Converte `_id` para `id` e remove `_id`
        const formattedUsers = users.map((user) => ({
          ...user,
          id: user._id ? user._id.toString() : null, // Garante que `id` seja string
        }));

        return formattedUsers.filter((user) => user.id !== null); // ✅ Remove usuários sem `id`
      } catch (error) {
        console.error("Erro ao buscar usuários:", error);
        return [];
      }
    },

    // Consulta para pegar um único usuário com base no id ou email
    user: async (_, { id, email }, { req }) => {
      const decodedToken = verifyAuthorization(req);

      if (!decodedToken) {
        throw new Error("Você não tem permissão para acessar este usuário.");
      }

      try {
        let user;
        if (id) {
          user = await existing(id, "user");
        } else if (email) {
          user = await User.findOne({ email });
        }

        if (!user) {
          throw new Error("Usuário não encontrado.");
        }

        const cards = await Card.find({ userId: user.id });
        const myCards = await Promise.all(
          cards.map(async (card) => {
            const streets = await Address.find({
              street: { $in: card.street },
            });

            return {
              id: card.id,
              number: card.number,
              startDate: card.startDate,
              endDate: card.endDate,
              streets,
            };
          })
        );

        return {
          success: true,
          message: `Usuário: ${user.name}, encontrado.`,
          user: {
            ...sanitizeUser(user),
            myCards,
          },
        };
      } catch (error) {
        throw new Error(`Erro ao buscar o usuário: ${error.message}`);
      }
    },
    logout: async (_, __, { req, res }) => {
      try {
        const decodedToken = verifyAuthorization(req);
        if (!decodedToken) {
          throw new Error("Você não tem permissão para acessar este usuário.");
        }

        res.clearCookie("access_token");
        return {
          success: true,
          message: "Usuário deslogado com sucesso.",
        };
      } catch (error) {
        throw new Error(`Error logout User: ${error.message}`);
      }
    },
  },

  Mutation: {
    // Login usando o Google
    loginWithGoogle: async (_, { user }, { res }) => {
      const { email, displayName, photoUrl, uid } = user;

      try {
        // Validação do e-mail
        if (!email || typeof email !== "string") {
          throw new Error("E-mail inválido.");
        }

        // Verifica se o usuário já existe
        let existUser = await User.findOne({ email });

        if (!existUser) {
          const saltRounds = parseInt(process.env.SALT_ROUNDS) || 10;
          const hashedPassword = await bcrypt.hash(uid, saltRounds);

          // Criação do novo usuário
          const numberUnique = await hashToNumbers(uid);
          const newUser = new User({
            name: displayName,
            email: email,
            password: hashedPassword,
            profilePicture: photoUrl,
            uid: uid,
            codUser: numberUnique,
          });

          await newUser.save();
          existUser = newUser;
        }

        // Valida as credenciais do usuário
        const user = await validateUserCredentials(email, uid);

        // Cria o token de acesso
        const token = createToken(user);
        setTokenCookie(res, token);

        return {
          success: true,
          message: `Usuário: ${user.name}, encontrado.`,
          user: sanitizeUser(user),
        };
      } catch (error) {
        throw new Error(`Erro ao fazer login com Google: ${error.message}`);
      }
    },

    // Deleta um usuário
    deleteUser: async (_, { id }, { req, res }) => {
      const decodedToken = verifyAuthorization(req);

      if (!decodedToken) {
        throw new Error("Você não tem permissão para excluir esse usuário.");
      }

      try {
        const user = await existing(id, "user");

        // Verifica se o usuário tem permissão para excluir
        const hasPermission =
          decodedToken.userId === user.id ||
          decodedToken.isAdmin ||
          decodedToken.isSS;

        if (!hasPermission) {
          throw new Error("Você não tem permissão para excluir este usuário.");
        }

        const deleteResult = await User.deleteOne({ _id: user.id });
        if (deleteResult.deletedCount === 0) {
          throw new Error("Erro ao excluir o usuário. Usuário não encontrado.");
        }

        res.clearCookie("access_token");

        return {
          success: true,
          message: `Usuário: ${user.name} foi excluído com sucesso.`,
        };
      } catch (error) {
        throw new Error(`Erro ao excluir usuário: ${error.message}`);
      }
    },

    // Atualiza informações de um usuário
    updateUser: async (_, { id, user }, { req }) => {
      const decodedToken = verifyAuthorization(req);

      if (!decodedToken || decodedToken.userId !== id) {
        throw new Error("Você não tem permissão para alterar esse usuário.");
      }

      try {
        const userToUpdate = await existing(id, "user");
        const userUpdate = { ...user };

        if (user.name) {
          userUpdate.name = user.name.trim();
        }

        const updatedUser = await User.findByIdAndUpdate(id, userUpdate, {
          new: true,
        });

        return {
          success: true,
          message: "Usuário atualizado com sucesso.",
          user: sanitizeUser(updatedUser),
        };
      } catch (error) {
        throw new Error(`Erro ao atualizar o usuário: ${error.message}`);
      }
    },
  },
};

export default userResolver;
