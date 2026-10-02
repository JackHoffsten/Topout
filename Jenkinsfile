pipeline {
    agent { label 'debian-builder' }
    options {
        disableConcurrentBuilds()
        timeout(time: 45, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '20'))
        skipDefaultCheckout(true)
    }
    triggers { githubPush() }
    stages {
        stage('Checkout main') {
            steps {
                deleteDir()
                checkout scm
                script { env.RELEASE_SHA = sh(script: 'git rev-parse HEAD', returnStdout: true).trim() }
                sh 'test "$(git ls-remote https://github.com/JackHoffsten/Topout.git refs/heads/main | cut -f1)" = "$RELEASE_SHA"'
            }
        }
        stage('Backend') {
            steps {
                sh 'dotnet test server/Topout.sln -c Release -m:1'
            }
        }
        stage('Frontend') {
            steps { sh 'npm ci && npm run typecheck && npm test && npm run build' }
        }
        stage('Build images and deploy') {
            steps {
                sh 'sudo -n /usr/local/sbin/topout-deploy "$RELEASE_SHA"'
                script { currentBuild.description = "Deployed ${env.RELEASE_SHA}" }
            }
        }
    }
    post { always { deleteDir() } }
}
