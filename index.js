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
const PORT = process.env.PORT || 4000; // Porta do Railway ou 4000 localmente

export const pubsub = new PubSub(); // Instância do PubSub para Subscriptions

// Conectar ao MongoDB
const connectToDatabase = async () => {
  try {
    console.log("🔄 Conectando ao MongoDB...");
    await mongoose.connect(MONGO_DB);
    console.log("✅ Conectado ao MongoDB");
  } catch (error) {
    console.error("❌ Erro ao conectar ao MongoDB:", error.message);
    process.exit(1);
  }
};

// Criar o Apollo Server
const createApolloServer = async () => {
  const schema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(typeDefs),
    resolvers: mergeResolvers(resolvers),
  });

  const server = new ApolloServer({ schema });
  await server.start();

  return { server, schema };
};

// Iniciar o servidor
const startServer = async () => {
  await connectToDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  const { server, schema } = await createApolloServer();

  // ⚡️ Melhorando Middleware para evitar Buffer
  app.use(express.json()); // Apenas JSON
  app.use(express.urlencoded({ extended: true })); // URL Encoded (opcional)

  // 🔥 Removido `express.text()` e `express.raw()` (não são necessários)

  // Configuração de CORS
  const allowedOrigins = CLIENT_ORIGIN
    ? CLIENT_ORIGIN.split(",")
    : ["http://localhost:5173", "https://direcciones.vercel.app"];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"], // 🔧 Garantindo suporte para GraphQL
    })
  );

  // Middleware do Apollo Server
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: ({ req, res }) => ({ req, res, pubsub }),
    })
  );

  // Rota de teste
  app.get("/", (req, res) => res.json({ message: "✅ Servidor rodando!" }));

  // Configuração do WebSocket para Subscriptions
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
    perMessageDeflate: false, // Evita compressão desnecessária
  });

  useServer(
    {
      schema,
      context: async () => {
        console.log("📡 Cliente conectado ao WebSocket");
        return { pubsub };
      },
      onConnect: () => console.log("✅ WebSocket conectado"),
      onDisconnect: () => console.log("🔴 WebSocket desconectado"),
      keepAlive: 10000, // Mantém a conexão ativa a cada 10s
    },
    wsServer
  );

  // Iniciar servidor HTTP e WebSocket na mesma porta
  httpServer.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`🔗 GraphQL: http://localhost:${PORT}/graphql`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}/graphql`);
  });
};

// Iniciar o servidor
startServer().catch((err) =>
  console.error("❌ Erro ao iniciar o servidor:", err)
);

// import express from "express";
// import cors from "cors";
// import { ApolloServer } from "@apollo/server";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { WebSocketServer } from "ws";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import { PubSub } from "graphql-subscriptions";
// import typeDefs from "./graphql/typeDefs/index.js";
// import resolvers from "./graphql/resolvers/index.js";
// import { useServer } from "graphql-ws/use/ws";

// dotenv.config();

// const { MONGO_DB, NODE_ENV, CLIENT_ORIGIN } = process.env;
// const PORT = process.env.PORT || 4000; // Usar a porta do Railway ou 4000 localmente

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
//     perMessageDeflate: false, // Evita problemas de compressão com proxies
//   });

//   // Configurar o uso do WebSocket Server com o schema e o contexto
//   useServer(
//     {
//       schema,
//       context: () => ({ pubsub }), // Passar o pubsub para o contexto
//     },
//     wsServer
//   );

//   // Configurar o CORS para produção
//   const allowedOrigins = CLIENT_ORIGIN
//     ? CLIENT_ORIGIN.split(",")
//     : ["http://localhost:5173", "https://direcciones.vercel.app"];

//   app.use(
//     cors({
//       origin: ["http://localhost:5173", "https://direcciones.vercel.app"], // Adicione os domínios necessários
//       credentials: true, // Permite cookies e autenticação
//     })
//   );

//   // Middleware para o Apollo Server
//   app.use(
//     "/graphql",
//     express.json(),
//     expressMiddleware(server, {
//       context: ({ req, res }) => ({ req, res, pubsub }), // Passar o pubsub para o contexto
//     })
//   );

//   // Rota de teste para verificar se o servidor está funcionando
//   app.get("/", (req, res) => {
//     res.send("Servidor rodando!");
//   });

//   app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

//   // Iniciar o servidor
//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando na porta ${PORT}`);
//     console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
//     console.log(`WebSocket endpoint: ws://localhost:${PORT}/graphql`);
//   });
// };

// startServer();
