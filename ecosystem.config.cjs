module.exports = {
  apps: [
    {
      name: "lamarum-site",
      cwd: "/var/www/lamarum-site",
      script: "server.mjs",
      interpreter: "node",
      node_args: "-r dotenv/config",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 10,
      restart_delay: 2000,
    },
  ],
};
