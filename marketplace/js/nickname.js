/**
 * 닉네임 관리 기능
 */

let currentUserAddress = null;

/**
 * 닉네임 모달 초기화
 */
function initNicknameModal() {
    ui.initModal('nicknameModal');
    
    const saveBtn = document.getElementById('saveNickname');
    const cancelBtn = document.getElementById('cancelNickname');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', saveNickname);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            ui.closeModal('nicknameModal');
        });
    }
}

/**
 * 닉네임 설정 모달 열기
 */
async function openNicknameModal(address) {
    currentUserAddress = address;
    
    // 현재 닉네임 조회
    try {
        const response = await api.getUserProfile(address);
        const currentNicknameSpan = document.getElementById('currentNickname');
        const nicknameInput = document.getElementById('nicknameInput');
        
        if (response.user && response.user.nickname) {
            currentNicknameSpan.textContent = response.user.nickname;
            nicknameInput.value = response.user.nickname;
        } else {
            currentNicknameSpan.textContent = '없음';
            nicknameInput.value = '';
        }
    } catch (error) {
        console.error('닉네임 조회 실패:', error);
    }
    
    ui.openModal('nicknameModal');
}

/**
 * 닉네임 저장
 */
async function saveNickname() {
    const nicknameInput = document.getElementById('nicknameInput');
    const nickname = nicknameInput.value.trim();
    
    if (!nickname) {
        Utils.showNotification('닉네임을 입력해주세요.', 'warning');
        return;
    }
    
    if (nickname.length < 2 || nickname.length > 20) {
        Utils.showNotification('닉네임은 2-20자여야 합니다.', 'warning');
        return;
    }
    
    const nicknameRegex = /^[가-힣a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
        Utils.showNotification('닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.', 'warning');
        return;
    }
    
    try {
        Utils.showNotification('닉네임 저장 중...', 'info');
        
        const response = await api.setNickname(nickname);
        
        if (response.success) {
            Utils.showNotification('닉네임이 저장되었습니다!', 'success');
            ui.closeModal('nicknameModal');
            
            // 닉네임 표시 업데이트
            updateNicknameDisplay(nickname);
        }
    } catch (error) {
        console.error('닉네임 저장 실패:', error);
        
        if (error.message.includes('already taken')) {
            Utils.showNotification('이미 사용 중인 닉네임입니다.', 'error');
        } else {
            Utils.showNotification('닉네임 저장 실패: ' + error.message, 'error');
        }
    }
}

/**
 * 닉네임 표시 업데이트
 */
function updateNicknameDisplay(nickname) {
    // 지갑 정보 영역에 닉네임 표시
    const walletInfo = document.querySelector('.wallet-info');
    if (walletInfo) {
        const nicknameSpan = walletInfo.querySelector('.user-nickname');
        if (nicknameSpan) {
            nicknameSpan.textContent = nickname;
        } else {
            // 닉네임 표시 요소 추가
            const addressSpan = walletInfo.querySelector('.wallet-address');
            if (addressSpan) {
                const newNicknameSpan = document.createElement('span');
                newNicknameSpan.className = 'user-nickname';
                newNicknameSpan.textContent = nickname;
                newNicknameSpan.style.marginRight = '0.5rem';
                newNicknameSpan.style.fontWeight = 'bold';
                addressSpan.parentNode.insertBefore(newNicknameSpan, addressSpan);
            }
        }
    }
}

/**
 * 사용자 닉네임 로드 및 표시
 */
async function loadAndDisplayNickname(address) {
    try {
        const response = await api.getUserProfile(address);
        if (response.user && response.user.nickname) {
            updateNicknameDisplay(response.user.nickname);
        }
    } catch (error) {
        console.error('닉네임 로드 실패:', error);
    }
}
