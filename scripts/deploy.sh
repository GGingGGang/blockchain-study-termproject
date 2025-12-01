#!/bin/bash

# 블록체인 게임 Bridge 서버 배포 스크립트
# 사용법: ./deploy.sh [환경]
# 예: ./deploy.sh production

set -e  # 에러 발생 시 중단

ENVIRONMENT=${1:-production}
DEPLOY_SERVER="bridge"
DEPLOY_USER="root"
DEPLOY_PATH="/opt/blockchain-game"
PM2_APP_NAME="blockchain-bridge"

echo "🚀 배포 시작: $ENVIRONMENT 환경"
echo "📍 대상 서버: $DEPLOY_SERVER"
echo ""

# 1. 로컬 빌드
echo "📦 1. 로컬 빌드 중..."
npm ci
npm run build 2>/dev/null || echo "빌드 스크립트 없음, 스킵"

# 2. 배포 패키지 생성
echo "📦 2. 배포 패키지 생성 중..."
mkdir -p dist
cp -r server dist/
cp -r marketplace dist/
cp -r database dist/
cp package*.json dist/
cp .env.example dist/

# 3. 서버로 파일 전송
echo "📤 3. 서버로 파일 전송 중..."
ssh ${DEPLOY_USER}@${DEPLOY_SERVER} "mkdir -p ${DEPLOY_PATH}"

rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'test' \
    --exclude 'contracts' \
    --exclude 'scripts' \
    --exclude 'artifacts' \
    --exclude 'cache' \
    dist/ ${DEPLOY_USER}@${DEPLOY_SERVER}:${DEPLOY_PATH}/

# 4. 서버에서 배포 실행
echo "🔧 4. 서버에서 배포 실행 중..."
ssh ${DEPLOY_USER}@${DEPLOY_SERVER} << ENDSSH
    set -e
    cd ${DEPLOY_PATH}
    
    echo "📥 의존성 설치 중..."
    npm ci --production
    
    echo "🔍 .env 파일 확인 중..."
    if [ ! -f .env ]; then
        echo "⚠️  경고: .env 파일이 없습니다!"
        echo "   .env.example을 복사하여 .env를 생성하세요."
        exit 1
    fi
    
    echo "🔄 PM2로 애플리케이션 재시작 중..."
    pm2 restart ${PM2_APP_NAME} || pm2 start server/index.js --name ${PM2_APP_NAME} --env ${ENVIRONMENT}
    pm2 save
    
    echo "✅ 배포 완료!"
    pm2 status
ENDSSH

# 5. 헬스 체크
echo "🏥 5. 헬스 체크 중..."
sleep 5
if curl -f http://${DEPLOY_SERVER}:3000/api/health 2>/dev/null; then
    echo "✅ 헬스 체크 성공!"
else
    echo "❌ 헬스 체크 실패!"
    exit 1
fi

# 6. 정리
echo "🧹 6. 로컬 정리 중..."
rm -rf dist

echo ""
echo "🎉 배포 완료!"
echo "📊 서버 상태 확인: ssh ${DEPLOY_USER}@${DEPLOY_SERVER} 'pm2 status'"
echo "📝 로그 확인: ssh ${DEPLOY_USER}@${DEPLOY_SERVER} 'pm2 logs ${PM2_APP_NAME}'"
