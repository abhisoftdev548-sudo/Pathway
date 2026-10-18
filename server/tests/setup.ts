process.env.NODE_ENV = 'test';
process.env.TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017/pathforge_test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'pathforge-test-access-secret-not-for-production';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'pathforge-test-refresh-secret-not-for-production';
