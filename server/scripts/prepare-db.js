import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');

// Load environment variables from server root .env if present
const envPath = path.join(serverDir, '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://');
const targetProvider = isPostgres ? 'postgresql' : 'sqlite';

console.log(`[DB Prepare] Database target: ${targetProvider} (${databaseUrl.split('@')[1] || databaseUrl})`);

// Ensure directory exists if SQLite
if (!isPostgres) {
  let dbFilePath = databaseUrl.replace(/^file:/, '').replace(/^sqlite:/, '');
  if (dbFilePath) {
    const resolvedPath = path.isAbsolute(dbFilePath) ? dbFilePath : path.resolve(serverDir, dbFilePath);
    const dbDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dbDir)) {
      console.log(`[DB Prepare] Creating database directory: ${dbDir}`);
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }
}

// Update schema.prisma provider if necessary
let providerChanged = false;
if (fs.existsSync(schemaPath)) {
  let schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const currentProviderMatch = schemaContent.match(/provider\s*=\s*"([^"]+)"/);
  const currentProvider = currentProviderMatch ? currentProviderMatch[1] : null;

  if (currentProvider !== targetProvider) {
    console.log(`[DB Prepare] Updating schema datasource provider: ${currentProvider} -> ${targetProvider}`);
    schemaContent = schemaContent.replace(
      /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*"[^"]+"/,
      `datasource db {\n  provider = "${targetProvider}"`
    );
    fs.writeFileSync(schemaPath, schemaContent, 'utf8');
    providerChanged = true;
    console.log('[DB Prepare] schema.prisma successfully updated.');
  } else {
    console.log(`[DB Prepare] schema.prisma is already configured for ${targetProvider}.`);
  }
}

const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Generate Prisma client
try {
  console.log('[DB Prepare] Generating Prisma Client...');
  execSync(`${cmd} prisma generate`, { cwd: serverDir, stdio: 'inherit', shell: true });
  console.log('[DB Prepare] Prisma Client generated successfully.');
} catch (err) {
  console.error('[DB Prepare] Failed to generate Prisma Client:', err);
  process.exit(1);
}

// If --push argument is passed, safely push schema to the database (creates tables if missing, never drops data)
if (process.argv.includes('--push')) {
  try {
    console.log('[DB Prepare] Pushing database schema (non-destructive)...');
    execSync(`${cmd} prisma db push --skip-generate`, { cwd: serverDir, stdio: 'inherit', shell: true });
    console.log('[DB Prepare] Database schema synchronized successfully.');
  } catch (err) {
    console.error('[DB Prepare] Failed to push database schema:', err);
    process.exit(1);
  }
}
