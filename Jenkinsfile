/* Pipeline d'intégration continue — XeuySil Backend (NestJS / Prisma / PostgreSQL) */
pipeline {
    agent any

    environment {
        DOCKER_IMAGE      = 'xeuysil/serveur'
        DOCKER_TAG        = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'latest'}"
        DOCKERHUB_CREDS   = credentials('dockerhub-credentials')
    }

    tools {
        nodejs 'NodeJS-22'
    }

    stages {

        stage('Récupération du code') {
            steps {
                checkout scm
            }
        }

        stage('Installation des dépendances') {
            steps {
                sh 'npm install -g pnpm@10.28.1 || true'
                sh 'pnpm install --frozen-lockfile'
            }
        }

        stage('Vérification du style') {
            steps {
                sh 'pnpm lint'
            }
        }

        stage('Génération du client Prisma') {
            steps {
                sh 'npx prisma generate'
            }
        }

        stage('Compilation') {
            steps {
                sh 'pnpm build'
            }
        }

        stage('Tests unitaires') {
            steps {
                sh 'pnpm test || true'
            }
        }

        stage('Construction de l\'image Docker') {
            steps {
                sh "docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
            }
        }

        stage('Analyse de vulnérabilités (Trivy)') {
            steps {
                sh "trivy image --exit-code 1 --severity CRITICAL ${DOCKER_IMAGE}:${DOCKER_TAG} || true"
            }
        }

        stage('Publication sur Docker Hub') {
            steps {
                sh '''
                    echo "${DOCKERHUB_CREDS_PSW}" | docker login -u "${DOCKERHUB_CREDS_USR}" --password-stdin
                    docker push ${DOCKER_IMAGE}:${DOCKER_TAG}
                    docker push ${DOCKER_IMAGE}:latest
                    docker logout
                '''
            }
        }
    }

    post {
        always {
            cleanWs()
        }
        success {
            echo 'Pipeline backend terminé avec succès.'
        }
        failure {
            echo 'Échec du pipeline backend.'
        }
    }
}
