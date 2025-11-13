#!/bin/bash

# ============================================================
# MariaDB 자동 설치 및 설정 스크립트
# Rocky Linux / CentOS / RHEL 용
# ============================================================

set -e  # 오류 발생 시 스크립트 중단

echo "============================================================"
echo "MariaDB 설치 및 설정 시작"
echo "============================================================"
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 함수: 성공 메시지
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 함수: 경고 메시지
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 함수: 오류 메시지
error() {
    echo -e "${RED}✗ $1${NC}"
}

# Root 권한 확인
if [ "$EUID" -ne 0 ]; then 
    error "이 스크립트는 root 권한이 필요합니다."
    echo "sudo ./install-mariadb.sh 로 실행하세요."
    exit 1
fi

success "Root 권한 확인 완료"

# 1. MariaDB 설치
echo ""
echo "1. MariaDB 설치 중..."
if command -v mysql &> /dev/null; then
    warning "MariaDB가 이미 설치되어 있습니다."
else
    dnf install -y mariadb-server mariadb
    success "MariaDB 설치 완료"
fi

# 2. MariaDB 서비스 시작
echo ""
echo "2. MariaDB 서비스 시작 중..."
systemctl start mariadb
systemctl enable mariadb
success "MariaDB 서비스 시작 및 자동 시작 설정 완료"

# 3. MariaDB 상태 확인
echo ""
echo "3. MariaDB 상태 확인..."
if systemctl is-active --quiet mariadb; then
    success "MariaDB가 정상적으로 실행 중입니다."
else
    error "MariaDB 서비스 시작 실패"
    exit 1
fi

# 4. 방화벽 설정
echo ""
echo "4. 방화벽 설정 중..."
if command -v firewall-cmd &> /dev/null; then
    # 로컬 접속만 허용하려면 이 부분을 주석 처리하세요
    firewall-cmd --permanent --add-service=mysql 2>/dev/null || warning "방화벽 규칙 추가 실패 (이미 존재할 수 있음)"
    firewall-cmd --reload 2>/dev/null || warning "방화벽 재시작 실패"
    success "방화벽 설정 완료"
else
    warning "firewalld가 설치되어 있지 않습니다. 방화벽 설정을 건너뜁니다."
fi

# 5. MariaDB 보안 설정
echo ""
echo "5. MariaDB 보안 설정..."
echo "   다음 질문에 답변하세요:"
echo "   - Set root password? [Y/n] Y"
echo "   - Remove anonymous users? [Y/n] Y"
echo "   - Disallow root login remotely? [Y/n] Y"
echo "   - Remove test database? [Y/n] Y"
echo "   - Reload privilege tables? [Y/n] Y"
echo ""
read -p "보안 설정을 진행하시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mysql_secure_installation
    success "보안 설정 완료"
else
    warning "보안 설정을 건너뛰었습니다. 나중에 'mysql_secure_installation' 명령으로 실행하세요."
fi

# 6. 데이터베이스 초기화
echo ""
echo "6. 데이터베이스 초기화..."
read -p "데이터베이스를 초기화하시겠습니까? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -sp "MariaDB root 비밀번호를 입력하세요: " ROOT_PASSWORD
    echo ""
    
    # 스크립트 디렉토리 확인
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    if [ -f "$SCRIPT_DIR/init.sql" ]; then
        mysql -u root -p"$ROOT_PASSWORD" < "$SCRIPT_DIR/init.sql"
        success "데이터베이스 초기화 완료"
        
        if [ -f "$SCRIPT_DIR/schema.sql" ]; then
            mysql -u root -p"$ROOT_PASSWORD" < "$SCRIPT_DIR/schema.sql"
            success "스키마 생성 완료"
        fi
        
        if [ -f "$SCRIPT_DIR/seed.sql" ]; then
            read -p "샘플 데이터를 삽입하시겠습니까? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                mysql -u root -p"$ROOT_PASSWORD" < "$SCRIPT_DIR/seed.sql"
                success "샘플 데이터 삽입 완료"
            fi
        fi
    else
        warning "init.sql 파일을 찾을 수 없습니다. 수동으로 데이터베이스를 초기화하세요."
    fi
else
    warning "데이터베이스 초기화를 건너뛰었습니다."
fi

# 7. 연결 테스트
echo ""
echo "7. 연결 테스트..."
if mysql -u bridge_user -pbridge_password_2024 -e "USE blockchain_game; SHOW TABLES;" &> /dev/null; then
    success "데이터베이스 연결 테스트 성공"
    echo ""
    echo "생성된 테이블 목록:"
    mysql -u bridge_user -pbridge_password_2024 -e "USE blockchain_game; SHOW TABLES;"
else
    warning "연결 테스트 실패. 데이터베이스가 초기화되지 않았을 수 있습니다."
fi

# 완료 메시지
echo ""
echo "============================================================"
success "MariaDB 설치 및 설정 완료!"
echo "============================================================"
echo ""
echo "📋 연결 정보:"
echo "   Host: localhost"
echo "   Port: 3306"
echo "   Database: blockchain_game"
echo "   User: bridge_user"
echo "   Password: bridge_password_2024"
echo ""
echo "🔧 유용한 명령어:"
echo "   MariaDB 접속: mysql -u bridge_user -p blockchain_game"
echo "   서비스 상태: systemctl status mariadb"
echo "   서비스 재시작: systemctl restart mariadb"
echo "   로그 확인: journalctl -u mariadb -f"
echo ""
echo "⚠️  보안 권장사항:"
echo "   1. 프로덕션 환경에서는 비밀번호를 변경하세요"
echo "   2. 필요한 IP에서만 접근을 허용하세요"
echo "   3. 정기적으로 백업을 수행하세요"
echo ""
