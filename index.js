import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
import userResolver from "./graphql/resolvers/user.resolver.js";
import cardResolver from "./graphql/resolvers/card.resolver.js";
import addressResolver from "./graphql/resolvers/address.resolver.js";

dotenv.config();

const MONGODB_URI = process.env.MONGO_DB;
console.log("Conectando ao MongoDB...");

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch((error) => console.error("❌ Erro ao conectar ao MongoDB:", error));

const app = express();
app.use(cookieParser());

// Configurar CORS corretamente
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://direcciones.vercel.app",
      "https://apidirecciones-production.up.railway.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

// Unir os TypeDefs e Resolvers
const schema = makeExecutableSchema({
  typeDefs: mergeTypeDefs([userTypeDef, cardTypeDef, addressTypeDef]),
  resolvers: mergeResolvers([userResolver, cardResolver, addressResolver]),
});

// Criar servidor HTTP
const httpServer = http.createServer(app);

// Criar Apollo Server
const server = new ApolloServer({ schema });

const startServer = async () => {
  await server.start();
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => {
        const token = req.cookies.access_token;
        return { req, res, token };
      },
    })
  );
};

startServer()
  .then(() => {
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor rodando em http://localhost:${PORT}/graphql`);
    });
  })
  .catch((err) => console.error("❌ Erro ao iniciar servidor:", err));

// Configurar WebSocket Server
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  // 📌 Ler o cookie da requisição WebSocket
  const cookies = cookie.parse(req.headers.cookie || "");
  const token = cookies.access_token;

  if (!token) {
    ws.close(4001, "Token não fornecido");
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Usuário autenticado:", decoded);
  } catch (err) {
    console.error("❌ Token inválido:", err.message);
    ws.close(4002, "Token inválido");
  }
});

// import express from "express";
// import cors from "cors";
// import cookieParser from "cookie-parser"; // 📌 Adicionado
// import { ApolloServer } from "@apollo/server";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { WebSocketServer } from "ws";
// import { useServer } from "graphql-ws/lib/use/ws";
// import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
// import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
// import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
// import userResolver from "./graphql/resolvers/user.resolver.js";
// import cardResolver from "./graphql/resolvers/card.resolver.js";
// import addressResolver from "./graphql/resolvers/address.resolver.js";

// dotenv.config();

// const MONGODB_URI = process.env.MONGO_DB;
// console.log("Conectando ao MongoDB...");

// mongoose
//   .connect(MONGODB_URI)
//   .then(() => console.log("✅ Conectado ao MongoDB"))
//   .catch((error) => console.error("❌ Erro ao conectar ao MongoDB:", error));

// const app = express();
// app.use(cookieParser()); // 📌 Adicionado para ler cookies

// // Configurar CORS corretamente
// // const allowedOrigins = [
// //   "http://localhost:5173",
// //   "https://direcciones.vercel.app",
// //   "https://apidirecciones-production.up.railway.app",
// // ];

// // app.use(
// //   cors({
// //     origin: allowedOrigins,
// //     credentials: true, // 📌 Permite cookies na requisição
// //   })
// // );

// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "https://direcciones.vercel.app",
//       "https://apidirecciones-production.up.railway.app",
//     ],
//     credentials: true, // 🔥 ESSENCIAL para permitir cookies
//   })
// );

// app.use(express.json());

// // Unir os TypeDefs e Resolvers
// const schema = makeExecutableSchema({
//   typeDefs: mergeTypeDefs([userTypeDef, cardTypeDef, addressTypeDef]),
//   resolvers: mergeResolvers([userResolver, cardResolver, addressResolver]),
// });

// // Criar servidor HTTP
// const httpServer = http.createServer(app);

// // Criar Apollo Server
// const server = new ApolloServer({
//   schema,
// });

// const startServer = async () => {
//   await server.start();
//   app.use(
//     "/graphql",
//     expressMiddleware(server, {
//       context: async ({ req, res }) => {
//         const token = req.cookies.access_token; // 📌 Agora ele pode ler o token do cookie
//         return { req, res, token };
//       },
//     })
//   );
// };

// startServer()
//   .then(() => {
//     const PORT = process.env.PORT || 4000;
//     httpServer.listen(PORT, () => {
//       console.log(`🚀 Servidor rodando em http://localhost:${PORT}/graphql`);
//     });
//   })
//   .catch((err) => console.error("❌ Erro ao iniciar servidor:", err));
