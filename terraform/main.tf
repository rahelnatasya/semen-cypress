terraform {
  required_version = ">= 1.3.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

variable "docker_host" {
  description = "Docker daemon host for the Terraform Docker provider."
  type        = string
  default     = "unix:///var/run/docker.sock"
}

variable "run_id" {
  description = "Unique ID per Jenkins build (e.g. BUILD_NUMBER) so container names don't collide."
  type        = string
}

variable "base_url" {
  description = "Target app base URL for Cypress."
  type        = string
}

variable "repo_archive_url" {
  description = "URL to a tar.gz archive of the Cypress repo (used so the runner doesn't need git)."
  type        = string
  default     = "https://github.com/rahelnatasya/semen-cypress/archive/refs/heads/main.tar.gz"
}

variable "runner_image" {
  description = "Docker image that contains Cypress + Node (recommended: cypress/included:<version>)."
  type        = string
  default     = "cypress/included:15.15.0"
}

variable "spec" {
  description = "Optional Cypress spec glob/path. Leave empty to run all specs."
  type        = string
  default     = ""
}

variable "log_tail_chars" {
  description = "How many characters of Cypress container logs to print to CI output."
  type        = number
  default     = 60000
}

provider "docker" {
  host = var.docker_host
}

resource "docker_image" "runner" {
  name         = var.runner_image
  keep_locally = true
}

locals {
  container_name = "cypress-runner-${var.run_id}"

  runner_script = <<-BASH
    set -eo pipefail

    # Always print a completion marker with the final exit code,
    # even if the script fails early (download/npm/cypress, etc.).
    trap 'rc=$?; echo "CYPRESS_EXIT_CODE=$rc"' EXIT

    echo "Downloading test repo: $REPO_ARCHIVE_URL"
    rm -rf /e2e
    mkdir -p /e2e
    cd /e2e

    node <<'NODE'
    const fs = require('fs');
    const { URL } = require('url');
    const https = require('https');
    const http = require('http');

    function downloadToFile(urlStr, destPath, redirects) {
      const maxRedirects = 10;
      const redirectCount = redirects || 0;
      if (redirectCount > maxRedirects) {
        return Promise.reject(new Error('Too many redirects'));
      }

      const urlObj = new URL(urlStr);
      const lib = urlObj.protocol === 'https:' ? https : http;

      return new Promise((resolve, reject) => {
        const req = lib.get(
          urlObj,
          { headers: { 'User-Agent': 'node' } },
          (res) => {
            const code = res.statusCode || 0;
            const isRedirect = [301, 302, 303, 307, 308].indexOf(code) !== -1;

            if (isRedirect && res.headers.location) {
              const nextUrl = new URL(res.headers.location, urlObj).toString();
              res.resume();
              resolve(downloadToFile(nextUrl, destPath, redirectCount + 1));
              return;
            }

            if (code !== 200) {
              res.resume();
              reject(new Error('Failed to download archive. HTTP ' + code));
              return;
            }

            const file = fs.createWriteStream(destPath);
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
            file.on('error', (err) => {
              try { fs.unlinkSync(destPath); } catch (_) {}
              reject(err);
            });
          }
        );

        req.on('error', reject);
      });
    }

    (async () => {
      const urlStr = process.env.REPO_ARCHIVE_URL;
      if (!urlStr) {
        console.error('REPO_ARCHIVE_URL is empty');
        process.exit(2);
      }

      const dest = '/tmp/repo.tgz';
      await downloadToFile(urlStr, dest, 0);
      console.log('Downloaded archive to ' + dest);
    })().catch((err) => {
      console.error(err && err.stack ? err.stack : String(err));
      process.exit(2);
    });
NODE

    tar -xzf /tmp/repo.tgz --strip-components=1
    rm -f /tmp/repo.tgz

    echo "Installing npm deps..."
    npm ci

    SPEC_ARG=""
    if [ -n "$CYPRESS_SPEC" ]; then
      SPEC_ARG="--spec $CYPRESS_SPEC"
    fi

    echo "Running Cypress against baseUrl=$CYPRESS_baseUrl"
    npx cypress run --posix-exit-codes --config baseUrl="$CYPRESS_baseUrl" $SPEC_ARG
  BASH
}

resource "docker_container" "cypress_runner" {
  name  = local.container_name
  image = docker_image.runner.image_id

  must_run = false
  logs     = true

  tty = true

  entrypoint = ["bash", "-lc"]
  command    = [local.runner_script]

  env = [
    "CI=1",
    "NO_COLOR=1",
    "FORCE_COLOR=0",
    "CYPRESS_baseUrl=${var.base_url}",
    "REPO_ARCHIVE_URL=${var.repo_archive_url}",
    "CYPRESS_SPEC=${var.spec}",
  ]

  shm_size = 1024
}

output "runner_container_name" {
  value = docker_container.cypress_runner.name
}

output "runner_exit_code" {
  value = try(tostring(docker_container.cypress_runner.exit_code), "")
}

locals {
  runner_logs = try(docker_container.cypress_runner.container_logs, "")

  runner_logs_tail = try(
    length(local.runner_logs) > var.log_tail_chars ? substr(
      local.runner_logs,
      length(local.runner_logs) - var.log_tail_chars,
      var.log_tail_chars
    ) : local.runner_logs,
    ""
  )
}

output "runner_logs_tail" {
  value = local.runner_logs_tail
}
