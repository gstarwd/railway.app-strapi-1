export default ({ env }) => ({
    'users-permissions': {
        config: {
            jwtSecret: env('JWT_SECRET'),
        },
    },
    upload: {
        config: {
            provider: 'aws-s3',
            providerOptions: {
                accessKeyId: env('AWS_ACCESS_KEY_ID'),
                secretAccessKey: env('AWS_ACCESS_SECRET'),
                region: env('AWS_REGION', 'auto'),
                params: {
                    Bucket: env('AWS_BUCKET'),
                },
                endpoint: env('AWS_ENDPOINT'),
                s3ForcePathStyle: true,
                signatureVersion: 'v4',
            },
            actionOptions: {
                upload: {},
                uploadStream: {},
                delete: {},
            },
        },
    },
});
