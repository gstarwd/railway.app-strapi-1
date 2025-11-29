import fs from 'fs';
import path from 'path';

const resolveSqliteFilename = (env) => {
    const filename = env('DATABASE_FILENAME', '.tmp/data.db');
    const resolved = path.resolve(process.cwd(), filename);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    return resolved;
};

export default ({ env }) => {
    const hasPostgresUrl = Boolean(env('DATABASE_URL'));

    if (hasPostgresUrl) {
        return {
            connection: {
                client: 'postgres',
                connection: {
                    connectionString: env('DATABASE_URL'),
                },
                acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
            },
        };
    }

    return {
        connection: {
            client: 'sqlite',
            connection: {
                filename: resolveSqliteFilename(env),
            },
            useNullAsDefault: true,
        },
    };
};
