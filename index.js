import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
import userResolver from "./graphql/resolvers/user.resolver.js";
import cardResolver from "./graphql/resolvers/card.resolver.js";
import addressResolver from "./graphql/resolvers/address.resolver.js";

dotenv.config();

// Conexão com MongoDB
const MONGODB_URI = process.env.MONGO_DB;
console.log("Conectando ao MongoDB...");

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch((error) => console.error("❌ Erro ao conectar ao MongoDB:", error));

const app = express();

// Configurar CORS corretamente
const allowedOrigins = [
  "http://localhost:5173",
  "https://direcciones.vercel.app",
  "https://apidirecciones-production.up.railway.app",
];

app.use(
  cors({
    origin: allowedOrigins,
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

// Criar servidor WebSocket
const wsServer = new WebSocketServer({
  server: httpServer,
  path: "/graphql",
});

const serverCleanup = useServer({ schema }, wsServer);

// Criar Apollo Server
const server = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await serverCleanup.dispose();
          },
        };
      },
    },
  ],
});

// Iniciar o Apollo Server
const startServer = async () => {
  await server.start();
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req, res }) => ({ req, res }),
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
