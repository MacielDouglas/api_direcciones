import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { makeExecutableSchema } from "@graphql-tools/schema";
import http from "http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
import typeDefs from "./graphql/typeDefs/index.js";
import resolvers from "./graphql/resolvers/index.js";
import { clients, sendUpdatedCards } from "./utils/utils.js";

dotenv.config();

const { MONGO_DB, PORT = 4000, CLIENT_ORIGIN } = process.env;

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

  const server = new ApolloServer({ schema });
  await server.start();
  return server;
};

// Iniciar o servidor
const startServer = async () => {
  await connectToDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  const server = await createApolloServer();

  // Middleware para o Apollo Server
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

  // Rota para SSE de cartões
  app.get("/sse/cards", (req, res) => {
    // Configura os headers para SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Adiciona a conexão do cliente à lista
    clients.add(res);

    console.log("Novo cliente conectado. Total de clientes:", clients.size);

    // Envia os dados na primeira conexão
    sendUpdatedCards(res)
      .then(() => {
        console.log("Dados iniciais enviados para o cliente.");
      })
      .catch((error) => {
        console.error("Erro ao enviar dados iniciais:", error.message);
        // Envia uma mensagem de erro para o cliente
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        }
      });

    // Remove a conexão do cliente quando ele fecha a requisição
    req.on("close", () => {
      clients.delete(res);
      if (!res.writableEnded) {
        res.end();
      }
      console.log("Cliente desconectado. Total de clientes:", clients.size);
    });
  });

  // Rota de teste para verificar se o servidor está funcionando
  app.get("/", (req, res) => {
    res.send("Servidor rodando!");
  });

  // Iniciar o servidor
  httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    console.log(`SSE endpoint: http://localhost:${PORT}/sse/cards`);
  });
};

startServer();

// import express from "express";
// import cors from "cors";
// import { ApolloServer } from "@apollo/server";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import typeDefs from "./graphql/typeDefs/index.js";
// import resolvers from "./graphql/resolvers/index.js";
// import { clients, sendUpdatedCards } from "./utils/utils.js";

// dotenv.config();

// const { MONGO_DB, PORT = 4000, CLIENT_ORIGIN } = process.env;

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

//   const server = new ApolloServer({ schema });
//   await server.start();
//   return server;
// };

// // Iniciar o servidor
// const startServer = async () => {
//   await connectToDatabase();

//   const app = express();
//   const httpServer = http.createServer(app);
//   const server = await createApolloServer();

//   // Middleware para o Apollo Server
//   app.use(
//     "/graphql",
//     cors({
//       origin: ["http://localhost:5173", "https://direcciones.vercel.app"],
//       credentials: true,
//     }),
//     express.json(),
//     expressMiddleware(server, {
//       context: ({ req, res }) => ({ req, res }),
//     })
//   );

//   // Rota para SSE
//   app.get("/sse", (req, res) => {
//     // Configura os headers para SSE
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");

//     // Envie uma mensagem inicial
//     res.write(
//       `data: ${JSON.stringify({ message: "Conexão estabelecida!" })}\n\n`
//     );

//     // Simule atualizações periódicas
//     const intervalId = setInterval(() => {
//       const data = { message: "Dados atualizados!", timestamp: new Date() };
//       res.write(`data: ${JSON.stringify(data)}\n\n`);
//     }, 5000);

//     // Encerre a conexão quando o cliente fechar a requisição
//     req.on("close", () => {
//       clearInterval(intervalId);
//       res.end();
//     });
//   });

//   // Rota para SSE de cartões

//   app.get("/sse/cards", (req, res) => {
//     // Configura os headers para SSE
//     res.setHeader("Content-Type", "text/event-stream");
//     res.setHeader("Cache-Control", "no-cache");
//     res.setHeader("Connection", "keep-alive");

//     // Adiciona a conexão do cliente à lista
//     clients.add(res);

//     console.log("Novo cliente conectado. Total de clientes:", clients.size);

//     // Envia os dados na primeira conexão
//     sendUpdatedCards(res)
//       .then(() => {
//         console.log("Dados iniciais enviados para o cliente.");
//       })
//       .catch((error) => {
//         console.error("Erro ao enviar dados iniciais:", error.message);
//       });

//     // Remove a conexão do cliente quando ele fecha a requisição
//     req.on("close", () => {
//       clients.delete(res);
//       res.end();
//       console.log("Cliente desconectado. Total de clientes:", clients.size);
//     });
//   });

//   // Iniciar o servidor
//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando em http://localhost:${PORT}`);
//     console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
//     console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
//   });
// };

// startServer();

// import express from "express";
// import cors from "cors";
// import { ApolloServer } from "@apollo/server";
// import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { WebSocketServer } from "ws";
// import { useServer } from "graphql-ws/lib/use/ws";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import typeDefs from "./graphql/typeDefs/index.js";
// import resolvers from "./graphql/resolvers/index.js";

// dotenv.config();

// const { MONGO_DB, PORT = 4000, CLIENT_ORIGIN } = process.env;

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

// const createApolloServer = async (httpServer) => {
//   const schema = makeExecutableSchema({
//     typeDefs: mergeTypeDefs(typeDefs),
//     resolvers: mergeResolvers(resolvers),
//   });

//   const wsServer = new WebSocketServer({
//     server: httpServer,
//     path: "/graphql",
//     handleProtocols: (protocols) => protocols[0], // opcional, para manipular protocolos
//     verifyClient: (info, done) => {
//       const origin = info.origin;
//       if (CLIENT_ORIGIN?.split(",").includes(origin)) {
//         done(true);
//       } else {
//         done(false, 401, "Unauthorized");
//       }
//     },
//   });

//   const serverCleanup = useServer({ schema }, wsServer);

//   const server = new ApolloServer({
//     schema,
//     plugins: [
//       ApolloServerPluginDrainHttpServer({ httpServer }),
//       {
//         async serverWillStart() {
//           return {
//             async drainServer() {
//               await serverCleanup.dispose();
//             },
//           };
//         },
//       },
//     ],
//   });

//   await server.start();
//   return server;
// };

// const startServer = async () => {
//   await connectToDatabase();

//   const app = express();
//   const httpServer = http.createServer(app);
//   const server = await createApolloServer(httpServer);

//   app.use(
//     "/graphql",
//     cors({
//       origin: CLIENT_ORIGIN?.split(",") || [
//         "http://localhost:5173",
//         "https://direcciones.vercel.app",
//       ],
//       credentials: true,
//     }),
//     express.json(),
//     expressMiddleware(server, {
//       context: ({ req, res }) => ({ req, res }),
//     })
//   );

//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando em http://localhost:${PORT}/graphql`);
//   });
// };

// startServer();
