import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import { neon } from "@neondatabase/serverless";
import { 
  users, 
  gbairais as gbairaisTable, 
  gbairais,
  conversations,
  interactions, 
  messages, 
  follows, 
  notifications 
} from "@shared/schema";
import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Nettoyer l'URL de base de données pour éviter les problèmes d'encodage
let databaseUrl = process.env.DATABASE_URL;

// Supprimer le préfixe psql%20 s'il existe
if (databaseUrl.startsWith('psql%20')) {
  databaseUrl = databaseUrl.replace('psql%20', '');
}

// Décoder l'URL si elle est encodée
try {
  databaseUrl = decodeURIComponent(databaseUrl);
} catch (error) {
  console.log("URL déjà décodée ou erreur de décodage:", error);
}

// Vérifier que l'URL commence par postgresql://
if (!databaseUrl.startsWith('postgresql://')) {
  throw new Error("DATABASE_URL doit commencer par postgresql://");
}

console.log("URL nettoyée:", databaseUrl.substring(0, 30) + "...");

console.log("DATABASE_URL chargée depuis l'environnement");

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: {
    rejectUnauthorized: false
  },
  // Configuration pour éviter les timeouts
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Gestion des erreurs de connexion
pool.on('error', (err) => {
  console.error('❌ Database pool error:', err);
});

pool.on('connect', () => {
  console.log('✅ Database pool connected');
});

export const db = drizzle({ client: pool, schema });

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  role: text("role").default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // 'like', 'comment', 'follow', 'message'
  message: text("message").notNull(),
  fromUserId: integer("from_user_id").references(() => users.id),
  gbairaiId: integer("gbairai_id").references(() => gbairais.id),
  conversationId: integer("conversation_id").references(() => conversations.id),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});