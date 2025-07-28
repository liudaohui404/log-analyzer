const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig, { env, paths }) => {
      // Optimize webpack for large file operations
      if (env === 'development') {
        // Limit file watching to reduce memory usage
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          // Reduce the number of files watched
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/tmp/**',
            '**/temp/**',
            // Ignore common large directories that might be created during file processing
            '**/uploads/**',
            '**/extracted/**',
            '**/cache/**'
          ],
          // Increase poll interval to reduce file system load
          poll: 1000,
          // Reduce aggregate timeout
          aggregateTimeout: 200
        };

        // Limit the number of files webpack tracks
        webpackConfig.snapshot = {
          ...webpackConfig.snapshot,
          // Limit managed paths to reduce memory usage
          managedPaths: [
            path.resolve(__dirname, 'node_modules')
          ],
          // Limit immutable paths
          immutablePaths: [
            path.resolve(__dirname, 'node_modules')
          ]
        };

        // Configure filesystem caching to be less aggressive
        if (webpackConfig.cache && webpackConfig.cache.type === 'filesystem') {
          webpackConfig.cache.maxMemoryGenerations = 1;
          webpackConfig.cache.maxAge = 1000 * 60 * 60; // 1 hour
        }
      }

      return webpackConfig;
    }
  }
};