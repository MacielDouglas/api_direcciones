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

const MONGODB_URI = process.env.MONGO_DB;
console.log("Conectando ao MongoDB....");

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Conectado ao MongoDB");
  })
  .catch((error) => {
    console.log("Erro de conexão com MongoDB: ", error.message);
  });

const app = express();

const mergedTypeDefs = mergeTypeDefs([
  userTypeDef,
  cardTypeDef,
  addressTypeDef,
]);

const mergedResolvers = mergeResolvers([
  userResolver,
  cardResolver,
  addressResolver,
]);

const startServer = async () => {
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
  });

  const schema = makeExecutableSchema({
    typeDefs: mergedTypeDefs,
    resolvers: mergedResolvers,
  });

  const serverCleanup = useServer({ schema }, wsServer);

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

  await server.start();

  app.use(
    "/graphql",
    cors({
      origin: ["http://localhost:5173", "https://direcciones.vercel.app"],
      credentials: true,
    }),
    express.json(),
    expressMiddleware(server, {
      context: ({ req, res }) => ({ req, res }),
    })
  );

  return httpServer;
};

// Condição para rodar em modo local
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 8000;
  startServer().then((httpServer) => {
    httpServer.listen(PORT, () => {
      console.log(
        `Servidor rodando localmente em http://localhost:${PORT}/graphql`
      );
    });
  });
}

// Exporta para ser utilizado no Vercel
export default async (req, res) => {
  const httpServer = await startServer();
  httpServer.emit("request", req, res);
};
