/** PM2 configuration for GhostFX web + workers */
module.exports = {
  apps: [
    {
      name: 'ghostfx-web',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 3000,
      },
    },
    {
      name: 'ghostfx-worker',
      script: 'pnpm',
      args: 'worker',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
