pipeline {
  agent any

  options {
    skipDefaultCheckout(true)
    timeout(time: 90, unit: 'MINUTES')
  }

  environment {
    TF_IN_AUTOMATION = 'true'
    TF_INPUT = '0'

    // Workaround for Docker Desktop/Windows mounts that may be 'noexec'
    // so Terraform provider binaries can be executed.
    TF_DATA_DIR = "/tmp/tfdata-${BUILD_NUMBER}"
    TF_PLUGIN_CACHE_DIR = "/tmp/tfplugin-cache"

    // Target app under test
    TF_VAR_base_url = 'http://pepi-semen.inaai.ai:5173'

    // Where Terraform should connect for Docker API
    TF_VAR_docker_host = 'unix:///var/run/docker.sock'

    // Cypress runner image (matches repo devDependency Cypress major)
    TF_VAR_runner_image = 'cypress/included:15.15.0'

    // Download source as tarball inside the runner (no git bind-mount needed)
    TF_VAR_repo_archive_url = 'https://github.com/rahelnatasya/semen-cypress/archive/refs/heads/main.tar.gz'

    // Optional: set to a specific spec, or keep empty to run all specs
    // CI default: run project specs only (exclude Cypress example specs)
    TF_VAR_spec = 'cypress/e2e/learn/**/*.cy.js'

    // Print more log context to Jenkins (helps see failing assertions)
    TF_VAR_log_tail_chars = '60000'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Terraform Init') {
      steps {
        dir('terraform') {
          sh 'mkdir -p "$TF_DATA_DIR" "$TF_PLUGIN_CACHE_DIR"'
          sh 'terraform --version'
          sh 'terraform init -upgrade'
        }
      }
    }

    stage('Run Cypress (Terraform -> Docker)') {
      steps {
        dir('terraform') {
          script {
            def applyRc = sh(script: 'terraform apply -auto-approve -var="run_id=${BUILD_NUMBER}"', returnStatus: true)

            // Always print runner logs (tail) so failures are debuggable in Jenkins.
            sh 'echo "\n===== CYPRESS LOGS (tail) ====="'
            sh 'terraform output -raw runner_logs_tail || true'
            sh 'echo "\n===== CYPRESS EXIT CODE ====="'
            def exitCode = sh(script: 'terraform output -raw runner_exit_code || echo 999', returnStdout: true).trim()
            sh "echo ${exitCode}"

            if (applyRc != 0) {
              // Fallback: if Terraform failed before state/outputs were written,
              // try to read container logs directly (if docker CLI is available).
              sh 'echo "\n===== FALLBACK DOCKER LOGS (tail) ====="'
              sh 'if command -v docker >/dev/null 2>&1; then docker logs "cypress-runner-${BUILD_NUMBER}" 2>&1 | tail -c 60000 || true; else echo "docker CLI not available in this Jenkins agent"; fi'
              error("terraform apply failed (rc=${applyRc}).")
            }
            if (exitCode != '0') {
              error("Cypress failed (exit_code=${exitCode}).")
            }
          }
        }
      }
    }
  }

  post {
    always {
      dir('terraform') {
        // Ensure we clean up the runner container even if Cypress fails
        sh 'terraform destroy -auto-approve -var="run_id=${BUILD_NUMBER}" || true'
      }
    }
  }
}
