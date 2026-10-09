module.exports = {
  apps: [
    {
      name: "hello-hub-bot",
      script: "./artifacts/api-server/dist/index.mjs",
      env: {
        NODE_ENV: "production",
        PORT: "8080"
      },
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    },
    {
      name: "hello-hub-updater",
      script: "./scripts/updater.cjs",
      error_file: "./logs/updater-err.log",
      out_file: "./logs/updater-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    }
  ]
};
