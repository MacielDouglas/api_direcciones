import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import { PubSub } from "graphql-subscriptions";
import typeDefs from "./graphql/typeDefs/index.js";
import resolvers from "./graphql/resolvers/index.js";
import { useServer } from "graphql-ws/use/ws";

dotenv.config();

const { MONGO_DB, NODE_ENV, CLIENT_ORIGIN } = process.env;
const PORT = process.env.PORT || 4000; // Usar a porta do Railway ou 4000 localmente

// Criar uma instância do PubSub para gerenciar eventos
export const pubsub = new PubSub();

// Conectar ao MongoDB
const connectToDatabase = async () => {
  try {
    console.log("Conectando ao MongoDB...");
    await mongoose.connect(MONGO_DB);
    console.log("Conectado ao MongoDB");
  } catch (error) {
    console.error("Erro de conexão com MongoDB:", error.message);
    process.exit(1);
  }
};

// Criar o Apollo Server
const createApolloServer = async () => {
  const schema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(typeDefs),
    resolvers: mergeResolvers(resolvers),
  });

  const server = new ApolloServer({
    schema,
  });

  await server.start();
  return { server, schema };
};

// Iniciar o servidor
const startServer = async () => {
  await connectToDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  const { server, schema } = await createApolloServer();

  // Configurar o WebSocket Server para Subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  // Configurar o uso do WebSocket Server com o schema e o contexto
  useServer(
    {
      schema,
      context: () => ({ pubsub }), // Passar o pubsub para o contexto
    },
    wsServer
  );

  // Configurar o CORS para produção
  const corsOptions = {
    origin: NODE_ENV === "production" ? CLIENT_ORIGIN : "*", // Permitir apenas a origem do front-end em produção
    credentials: true,
  };

  // Middleware para o Apollo Server
  app.use(
    "/graphql",
    cors(corsOptions),
    express.json(),
    expressMiddleware(server, {
      context: ({ req, res }) => ({ req, res, pubsub }), // Passar o pubsub para o contexto
    })
  );

  // Rota de teste para verificar se o servidor está funcionando
  app.get("/", (req, res) => {
    res.send("Servidor rodando!");
  });

  // Iniciar o servidor
  httpServer.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}/graphql`);
  });
};

// Iniciar o servidor em modo de desenvolvimento
if (NODE_ENV !== "production") {
  startServer();
}

// Exportar o servidor para o Railway
export default async (req, res) => {
  const httpServer = await startServer();
  httpServer.emit("request", req, res);
};

// import express from "express";
// import cors from "cors";
// import { ApolloServer } from "@apollo/server";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { WebSocketServer } from "ws";
// // import { useServer } from "graphql-ws/lib/use/ws";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import { PubSub } from "graphql-subscriptions";
// import typeDefs from "./graphql/typeDefs/index.js";
// import resolvers from "./graphql/resolvers/index.js";
// import { useServer } from "graphql-ws/use/ws";

// dotenv.config();

// const { MONGO_DB, PORT = 4000 } = process.env;

// // Criar uma instância do PubSub para gerenciar eventos
// export const pubsub = new PubSub();

// // Conectar ao MongoDB
// const connectToDatabase = async () => {
//   try {
//     console.log("Conectando ao MongoDB...");
//     await mongoose.connect(MONGO_DB);
//     console.log("Conectado ao MongoDB");
//   } catch (error) {
//     console.error("Erro de conexão com MongoDB:", error.message);
//     process.exit(1);
//   }
// };

// // Criar o Apollo Server
// const createApolloServer = async () => {
//   const schema = makeExecutableSchema({
//     typeDefs: mergeTypeDefs(typeDefs),
//     resolvers: mergeResolvers(resolvers),
//   });

//   const server = new ApolloServer({
//     schema,
//   });

//   await server.start();
//   return { server, schema };
// };

// // Iniciar o servidor
// const startServer = async () => {
//   await connectToDatabase();

//   const app = express();
//   const httpServer = http.createServer(app);
//   const { server, schema } = await createApolloServer();

//   // Configurar o WebSocket Server para Subscriptions
//   const wsServer = new WebSocketServer({
//     server: httpServer,
//     path: "/graphql",
//   });

//   // Configurar o uso do WebSocket Server com o schema e o contexto
//   useServer(
//     {
//       schema,
//       context: () => ({ pubsub }), // Passar o pubsub para o contexto
//     },
//     wsServer
//   );

//   // Middleware para o Apollo Server
//   app.use(
//     "/graphql",
//     cors({
//       origin: ["http://localhost:5173", "https://direcciones.vercel.app"],
//       credentials: true,
//     }),
//     express.json(),
//     expressMiddleware(server, {
//       context: ({ req, res }) => ({ req, res, pubsub }), // Passar o pubsub para o contexto
//     })
//   );

//   // Rota de teste para verificar se o servidor está funcionando
//   app.get("/", (req, res) => {
//     res.send("Servidor rodando!");
//   });

//   // Iniciar o servidor
//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando em http://localhost:${PORT}`);
//     console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
//     console.log(`WebSocket endpoint: ws://localhost:${PORT}/graphql`);
//   });
// };

// startServer();
