module.exports = {
  apps: [{
    name: "api-timefly",
    script: "sh",
    args: "-c 'bun run build && bun run prod'",
    cwd: "/var/www/projects/timefly-backend",
    interpreter: "",
    env: {
      NODE_ENV: "production"
    }
  }]
}