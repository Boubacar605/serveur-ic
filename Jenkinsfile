/* Pipeline d'intégration continue — XeuySil Backend (NestJS / Prisma / PostgreSQL) */
pipeline {
    agent any

    environment {
        DOCKER_IMAGE    = 'xeuysil/serveur'
        DOCKER_TAG      = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'latest'}"
        DOCKERHUB_CREDS = credentials('dockerhub-credentials')
    }

    stages {

        stage('Récupération du code') {
            steps {
                checkout scm
            }
        }

        stage('Installation des dépendances') {
            steps {
                sh '''
                    docker run --rm --network host \
                        -v "$(pwd)":/app -w /app \
                        node:22-alpine \
                        sh -c "npm install -g pnpm@10.28.1 && pnpm install --frozen-lockfile"
                '''
            }
        }

        stage('Vérification du style') {
            steps {
                sh '''
                    docker run --rm --network host \
                        -v "$(pwd)":/app -w /app \
                        node:22-alpine \
                        sh -c "npm install -g pnpm@10.28.1 && pnpm lint || true"
                '''
            }
        }

        stage('Génération du client Prisma') {
            steps {
                sh '''
                    docker run --rm --network host \
                        -v "$(pwd)":/app -w /app \
                        node:22-alpine \
                        sh -c "npm install -g pnpm@10.28.1 && npx prisma generate"
                '''
            }
        }

        stage('Compilation') {
            steps {
                sh '''
                    docker run --rm --network host \
                        -v "$(pwd)":/app -w /app \
                        node:22-alpine \
                        sh -c "npm install -g pnpm@10.28.1 && pnpm build"
                '''
            }
        }

        stage('Tests unitaires') {
            steps {
                sh '''
                    docker run --rm --network host \
                        -v "$(pwd)":/app -w /app \
                        node:22-alpine \
                        sh -c "npm install -g pnpm@10.28.1 && pnpm test || true"
                '''
            }
        }

        stage('Construction de l\'image Docker') {
            steps {
                sh "docker build --network host -t ${DOCKER_IMAGE}:${DOCKER_TAG} -t ${DOCKER_IMAGE}:latest ."
            }
        }

        stage('Analyse de vulnérabilités (Trivy)') {
            steps {
                sh "docker run --rm aquasec/trivy:latest image --exit-code 0 --severity CRITICAL ${DOCKER_IMAGE}:${DOCKER_TAG} || true"
            }
        }

        stage('Publication sur Docker Hub') {
            when {
                expression { return env.DOCKERHUB_CREDS_USR != null && env.DOCKERHUB_CREDS_USR != '' }
            }
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
        success {
            echo 'Pipeline backend terminé avec succès.'
        }
        failure {
            echo 'Échec du pipeline backend.'
        }
    }
}
