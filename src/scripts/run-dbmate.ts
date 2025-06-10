import { spawn } from 'bun';

async function executeDbmateForDb(
  dbType: 'mysql' | 'clickhouse',
  command: 'up' | 'rollback',
) {
  let dbUrl: string;
  let migrationsDir: string;
  let dbNameForLog: string;

  if (dbType === 'mysql') {
    dbNameForLog = 'MySQL';
    migrationsDir = 'db/migrations/mysql';
    if (!process.env.MYSQL_USER || !process.env.MYSQL_PASSWORD || !process.env.MYSQL_PORT || !process.env.MYSQL_DATABASE || !process.env.MYSQL_HOST) {
      console.error('Missing one or more MySQL environment variables (MYSQL_USER, MYSQL_PASSWORD, MYSQL_PORT, MYSQL_DATABASE, MYSQL_HOST)');
      return 1; // Return error code
    }
    dbUrl = `mysql://${process.env.MYSQL_USER}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`;
  } else { // Only 'clickhouse' is the other option for this internal function
    dbNameForLog = 'ClickHouse';
    migrationsDir = 'db/migrations/clickhouse';
    if (!process.env.CLICKHOUSE_USER || !process.env.CLICKHOUSE_PASSWORD || !process.env.CLICKHOUSE_TCP_PORT || !process.env.CLICKHOUSE_HOST) {
      console.error('Missing one or more ClickHouse environment variables (CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_TCP_PORT, CLICKHOUSE_HOST)');
      return 1; // Return error code
    }
        const clickhouseHost = (process.env.CLICKHOUSE_HOST || '').replace(/^(https?|tcp):\/\//, '');
    dbUrl = `clickhouse://${process.env.CLICKHOUSE_USER}:${process.env.CLICKHOUSE_PASSWORD}@${clickhouseHost}:${process.env.CLICKHOUSE_TCP_PORT}/${process.env.CLICKHOUSE_DATABASE || 'default'}`;
  }

  const safeLogUrl = dbUrl.includes('@') ? `${dbUrl.substring(0, dbUrl.indexOf('@') + 1)}...` : dbUrl;
  console.log(`\n--- Running ${dbNameForLog} migrations (${command}) ---`);
  console.log(`Constructed ${dbNameForLog} URL for migrations in ${migrationsDir}, starting with: ${safeLogUrl}`);
  console.log(`Executing: dbmate --migrations-dir ${migrationsDir} ${command}`);

  const proc = spawn(
    command === 'up'
      ? ['bunx', 'dbmate', '--no-dump-schema', '--migrations-dir', migrationsDir, command]
      : ['bunx', 'dbmate', '--migrations-dir', migrationsDir, command],
    {
      env: {
        ...process.env,
        DATABASE_URL: dbUrl,
      },
      stdio: ['inherit', 'inherit', 'inherit'],
    }
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    console.error(`${dbNameForLog} migration (${command}) failed with exit code ${exitCode}.`);
  } else {
    console.log(`${dbNameForLog} migration (${command}) completed successfully.`);
  }
  return exitCode;
}

async function runDbMate() {
  // Bun automatically loads .env variables into process.env
  // so we can access them here.

  const dbTypeArg = process.argv[2]; // 'mysql', 'clickhouse', or 'all'
  const commandArg = process.argv[3]; // 'up' or 'rollback'

  if (!dbTypeArg || !commandArg) {
    console.error('Usage: bun src/scripts/run-dbmate.ts <mysql|clickhouse|all> <up|rollback>');
    process.exit(1);
  }

  if (commandArg !== 'up' && commandArg !== 'rollback') {
    console.error(`Invalid command: ${commandArg}. Must be 'up' or 'rollback'.`);
    process.exit(1);
  }

  let overallExitCode = 0;

  if (dbTypeArg === 'mysql' || dbTypeArg === 'clickhouse') {
    overallExitCode = await executeDbmateForDb(dbTypeArg, commandArg);
  } else if (dbTypeArg === 'all') {
    console.log(`Executing all migrations (${commandArg})...`);

    // Run MySQL first
    const mysqlExitCode = await executeDbmateForDb('mysql', commandArg);
    if (mysqlExitCode !== 0) {
      console.error('MySQL migrations failed. Halting execution of "all" migrations.');
      process.exit(mysqlExitCode); // Exit with MySQL's error code
    }

    // Then run ClickHouse
    const clickhouseExitCode = await executeDbmateForDb('clickhouse', commandArg);
    if (clickhouseExitCode !== 0) {
      console.error('ClickHouse migrations failed.');
      process.exit(clickhouseExitCode); // Exit with ClickHouse's error code
    }
    console.log('\nAll migrations executed successfully.');
    // If both succeed, overallExitCode remains 0
  } else {
    console.error(`Unsupported DB type: ${dbTypeArg}. Must be 'mysql', 'clickhouse', or 'all'.`);
    overallExitCode = 1;
  }

  process.exit(overallExitCode);
}

runDbMate().catch(err => {
  console.error('Failed to run dbmate script:', err);
  process.exit(1);
});
