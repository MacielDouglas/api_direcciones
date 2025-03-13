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
import typeDefs from "./graphql/typeDefs/index.js";
import resolvers from "./graphql/resolvers/index.js";

dotenv.config();

const { MONGO_DB, PORT = 4000, CLIENT_ORIGIN } = process.env;

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

const createApolloServer = async (httpServer) => {
  const schema = makeExecutableSchema({
    typeDefs: mergeTypeDefs(typeDefs),
    resolvers: mergeResolvers(resolvers),
  });

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
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
  return server;
};

const startServer = async () => {
  await connectToDatabase();

  const app = express();
  const httpServer = http.createServer(app);
  const server = await createApolloServer(httpServer);

  app.use(
    "/graphql",
    cors({
      origin: CLIENT_ORIGIN?.split(",") || ["http://localhost:5173"],
      credentials: true,
    }),
    express.json(),
    expressMiddleware(server, {
      context: ({ req, res }) => ({ req, res }),
    })
  );

  httpServer.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}/graphql`);
  });
};

startServer();

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
// import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
// import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
// import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
// import userResolver from "./graphql/resolvers/user.resolver.js";
// import cardResolver from "./graphql/resolvers/card.resolver.js";
// import addressResolver from "./graphql/resolvers/address.resolver.js";

// dotenv.config();

// const MONGODB_URI = process.env.MONGO_DB;
// console.log("Conectando ao MongoDB....");

// mongoose
//   .connect(MONGODB_URI)
//   .then(() => {
//     console.log("Conectado ao MongoDB");
//   })
//   .catch((error) => {
//     console.log("Erro de conexão com MongoDB: ", error.message);
//   });

// const app = express();

// const mergedTypeDefs = mergeTypeDefs([
//   userTypeDef,
//   cardTypeDef,
//   addressTypeDef,
// ]);

// const mergedResolvers = mergeResolvers([
//   userResolver,
//   cardResolver,
//   addressResolver,
// ]);

// const startServer = async () => {
//   const httpServer = http.createServer(app);

//   const wsServer = new WebSocketServer({
//     server: httpServer,
//     path: "/graphql",
//   });

//   const schema = makeExecutableSchema({
//     typeDefs: mergedTypeDefs,
//     resolvers: mergedResolvers,
//   });

//   const serverCleanup = useServer(
//     {
//       schema,
//     },
//     wsServer
//   );

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

//   return httpServer;
// };

// // Start the server
// const PORT = process.env.PORT || 4000;
// startServer().then((httpServer) => {
//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando em http://localhost:${PORT}/graphql`);
//   });
// });
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
// import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
// import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
// import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
// import userResolver from "./graphql/resolvers/user.resolver.js";
// import cardResolver from "./graphql/resolvers/card.resolver.js";
// import addressResolver from "./graphql/resolvers/address.resolver.js";

// dotenv.config();

// const MONGODB_URI = process.env.MONGO_DB;
// console.log("Conectando ao MongoDB....");

// mongoose
//   .connect(MONGODB_URI)
//   .then(() => {
//     console.log("Conectado ao MongoDB");
//   })
//   .catch((error) => {
//     console.log("Erro de conexão com MongoDB: ", error.message);
//   });

// const app = express();

// const mergedTypeDefs = mergeTypeDefs([
//   userTypeDef,
//   cardTypeDef,
//   addressTypeDef,
// ]);

// const mergedResolvers = mergeResolvers([
//   userResolver,
//   cardResolver,
//   addressResolver,
// ]);

// const startServer = async () => {
//   const httpServer = http.createServer(app);

//   const wsServer = new WebSocketServer({
//     server: httpServer,
//     path: "/graphql",
//   });

//   const schema = makeExecutableSchema({
//     typeDefs: mergedTypeDefs,
//     resolvers: mergedResolvers,
//   });

//   const serverCleanup = useServer(
//     {
//       schema,
//       // context: async (ctx) => {
//       //   const cookies = ctx.extra.request.headers.cookie;
//       //   if (!cookies) {
//       //     throw new Error("Cookies não encontrados.");
//       //   }

//       //   console.log("Cookies recebidos:", cookies);
//       //   return { user: "usuário autenticado" };
//       // },
//     },
//     wsServer
//   );

//   // wsServer.on("connection", (socket) => {
//   //   socket.on("pong", () => console.log("recebido ping/pong do client."));
//   //   console.log("Nova conexão WebSocket estabelecida!");

//   //   socket.on("close", () => {
//   //     console.log("Conexão WebSocket foi encerrada.");
//   //   });

//   //   socket.on("error", (error) => {
//   //     console.error("Erro no WebSocket:", error);
//   //   });
//   // });

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

//   return httpServer;
// };

// // Start the server
// const PORT = process.env.PORT || 4000;
// startServer().then((httpServer) => {
//   httpServer.listen(PORT, () => {
//     console.log(`Servidor rodando em http://localhost:${PORT}/graphql`);
//   });
// });

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
// import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
// import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
// import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
// import userResolver from "./graphql/resolvers/user.resolver.js";
// import cardResolver from "./graphql/resolvers/card.resolver.js";
// import addressResolver from "./graphql/resolvers/address.resolver.js";

// dotenv.config();

// const MONGODB_URI = process.env.MONGO_DB;
// console.log("Conectando ao MongoDB....");

// mongoose
//   .connect(MONGODB_URI)
//   .then(() => {
//     console.log("Conectado ao MongoDB");
//   })
//   .catch((error) => {
//     console.log("Erro de conexão com MongoDB: ", error.message);
//   });

// const app = express();

// const mergedTypeDefs = mergeTypeDefs([
//   userTypeDef,
//   cardTypeDef,
//   addressTypeDef,
// ]);

// const mergedResolvers = mergeResolvers([
//   userResolver,
//   cardResolver,
//   addressResolver,
// ]);

// const startServer = async () => {
//   const httpServer = http.createServer(app);

//   const wsServer = new WebSocketServer({
//     server: httpServer,
//     path: "/graphql",
//   });

//   const schema = makeExecutableSchema({
//     typeDefs: mergedTypeDefs,
//     resolvers: mergedResolvers,
//   });

//   // const serverCleanup = useServer({ schema }, wsServer);
//   const serverCleanup = useServer(
//     {
//       schema,
//       context: async (ctx) => {
//         const cookies = ctx.extra.request.headers.cookie;
//         if (!cookies) {
//           throw new Error("Cookies não encontrados.");
//         }

//         // Realize a validação aqui
//         console.log("Cookies recebidos:", cookies);
//         return { user: "usuário autenticado" }; // Retorne o contexto apropriado
//       },
//     },
//     wsServer
//   );

//   wsServer.on("connection", (socket) => {
//     socket.on("pong", () => console.log("recebido ping/pong do client."));
//     console.log("Nova conexão WebSocket estabelecida!");

//     socket.on("close", () => {
//       console.log("Conexão WebSocket foi encerrada.");
//     });

//     socket.on("error", (error) => {
//       console.error("Erro no WebSocket:", error);
//     });
//   });

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

//   return httpServer;
// };

// // Condição para rodar em modo local
// if (process.env.NODE_ENV !== "production") {
//   const PORT = process.env.PORT || 4000;
//   startServer().then((httpServer) => {
//     httpServer.listen(PORT, () => {
//       console.log(
//         `Servidor rodando localmente em http://localhost:${PORT}/graphql`
//       );
//     });
//   });
// }

// // Exporta para ser utilizado no Vercel
// export default async (req, res) => {
//   const httpServer = await startServer();
//   httpServer.emit("request", req, res);
// };

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
// import userTypeDef from "./graphql/typeDefs/user.typeDef.js";
// import cardTypeDef from "./graphql/typeDefs/card.typeDef.js";
// import addressTypeDef from "./graphql/typeDefs/address.typeDef.js";
// import userResolver from "./graphql/resolvers/user.resolver.js";
// import cardResolver from "./graphql/resolvers/card.resolver.js";
// import addressResolver from "./graphql/resolvers/address.resolver.js";

// dotenv.config();

// // Conexão com MongoDB
// const MONGODB_URI = process.env.MONGO_DB;
// console.log("Conectando ao MongoDB...");

// mongoose
//   .connect(MONGODB_URI)
//   .then(() => console.log("✅ Conectado ao MongoDB"))
//   .catch((error) => console.error("❌ Erro ao conectar ao MongoDB:", error));

// const app = express();

// // Configurar CORS corretamente
// const allowedOrigins = [
//   "http://localhost:5173",
//   "https://direcciones.vercel.app",
//   "https://apidirecciones-production.up.railway.app",
// ];

// app.use(
//   cors({
//     origin: allowedOrigins,
//     credentials: true,
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

// // Criar servidor WebSocket
// const wsServer = new WebSocketServer({
//   server: httpServer,
//   path: "/graphql",
// });

// const serverCleanup = useServer({ schema }, wsServer);

// // Criar Apollo Server
// const server = new ApolloServer({
//   schema,
//   plugins: [
//     ApolloServerPluginDrainHttpServer({ httpServer }),
//     {
//       async serverWillStart() {
//         return {
//           async drainServer() {
//             await serverCleanup.dispose();
//           },
//         };
//       },
//     },
//   ],
// });

// // Iniciar o Apollo Server
// const startServer = async () => {
//   await server.start();

//   app.use(
//     "/graphql",

//     expressMiddleware(server, {
//       context: async ({ req, res }) => ({ req, res }),
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

// import express from "express";
// import cors from "cors";
// import cookieParser from "cookie-parser";
// import { ApolloServer } from "@apollo/server";
// import { expressMiddleware } from "@apollo/server/express4";
// import { makeExecutableSchema } from "@graphql-tools/schema";
// import { mergeTypeDefs, mergeResolvers } from "@graphql-tools/merge";
// import http from "http";
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import { WebSocketServer } from "ws";
// import { useServer } from "graphql-ws/lib/use/ws";
// import cookie from "cookie";
// import jwt from "jsonwebtoken";
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
// app.use(cookieParser());

// // Configurar CORS corretamente
// app.use(
//   cors({
//     origin: [
//       "http://localhost:5173",
//       "https://direcciones.vercel.app",
//       "https://apidirecciones-production.up.railway.app",
//     ],
//     credentials: true,
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
// const server = new ApolloServer({ schema });

// const startServer = async () => {
//   await server.start();
//   app.use(
//     "/graphql",
//     expressMiddleware(server, {
//       context: async ({ req, res }) => {
//         const token = req.cookies.access_token;
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

// // Configurar WebSocket Server
// const wss = new WebSocketServer({ server: httpServer });

// wss.on("connection", (ws, req) => {
//   // 📌 Ler o cookie da requisição WebSocket
//   const cookies = cookie.parse(req.headers.cookie || "");
//   const token = cookies.access_token;

//   if (!token) {
//     ws.close(4001, "Token não fornecido");
//     return;
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     console.log("✅ Usuário autenticado:", decoded);
//   } catch (err) {
//     console.error("❌ Token inválido:", err.message);
//     ws.close(4002, "Token inválido");
//   }
// });

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
