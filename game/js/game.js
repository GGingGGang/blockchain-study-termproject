/**
 * Blockchain Web Game
 * MetaMask 로그인 + 몬스터 전투 + 드랍 시스템
 */

// === 설정 ===
const API_BASE = CONFIG.API_BASE_URL + "/api/game";
const AUTH_API = CONFIG.API_BASE_URL + "/api/marketplace/auth";
const MONSTER_TYPE = "training_dummy";
const MONSTER_LEVEL = 1;
const MONSTER_LOCATION = "test_room";

// === 상태 ===
let jwt = "";
let walletAddress = "";
let hp = 10;
const maxHp = 10;

// === DOM ===
const jwtInput = document.getElementById("jwtInput");
const loginBtn = document.getElementById("loginBtn");
const saveJwtBtn = document.getElementById("saveJwtBtn");
const loadInvBtn = document.getElementById("loadInvBtn");
const addressDisplay = document.getElementById("addressDisplay");
const monsterEl = document.getElementById("monster");
const hpBarEl = document.getElementById("hp-bar");
const hpTextEl = document.getElementById("monster-hp-text");
const logEl = document.getElementById("log");
const inventoryEl = document.getElementById("inventory");
const floatTextEl = document.getElementById("floating-text");

function log(msg) {
    const t = new Date().toLocaleTimeString();
    logEl.textContent += `[${t}] ${msg}\n`;
    logEl.scrollTop = logEl.scrollHeight;
}

function setJwt(newJwt, address = "") {
    jwt = newJwt.trim();
    walletAddress = address;
    
    if (jwt) {
        localStorage.setItem("game_jwt", jwt);
        if (address) {
            localStorage.setItem("game_address", address);
            addressDisplay.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
        }
        loadInvBtn.disabled = false;
        log("JWT 저장 완료");
    } else {
        loadInvBtn.disabled = true;
    }
}

// 초기 JWT 복원
const stored = localStorage.getItem("game_jwt");
const storedAddress = localStorage.getItem("game_address");
if (stored) {
    jwtInput.value = stored;
    setJwt(stored, storedAddress || "");
}

saveJwtBtn.addEventListener("click", () => {
    setJwt(jwtInput.value);
});

// === MetaMask 로그인 ===
loginBtn.addEventListener("click", async () => {
    try {
        log("MetaMask 로그인 중...");
        
        if (typeof window.ethereum === 'undefined') {
            alert('MetaMask를 설치해주세요!');
            return;
        }
        
        // 계정 연결
        const accounts = await window.ethereum.request({ 
            method: 'eth_requestAccounts' 
        });
        
        const address = accounts[0];
        log(`지갑 연결: ${address}`);
        
        // Ethers.js provider
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        
        // 인증 메시지 요청
        const messageRes = await fetch(`${AUTH_API}/request-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        
        const { message } = await messageRes.json();
        
        // 서명
        log("서명 요청 중...");
        const signature = await signer.signMessage(message);
        
        // 검증
        const verifyRes = await fetch(`${AUTH_API}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address, signature, message })
        });
        
        const { sessionToken } = await verifyRes.json();
        
        // JWT 저장
        jwtInput.value = sessionToken;
        setJwt(sessionToken, address);
        log("✅ 로그인 성공!");
        
        // 자동으로 인벤토리 로드
        loadInventory();
        
    } catch (err) {
        console.error(err);
        log("❌ 로그인 실패: " + err.message);
    }
});

// === 인벤토리 ===
async function loadInventory() {
    if (!jwt) {
        alert("JWT부터 입력하세요.");
        return;
    }
    
    try {
        log("인벤토리 조회 중...");
        const res = await fetch(`${API_BASE}/inventory`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${jwt}`
            }
        });
        
        const json = await res.json();
        
        if (!json.success) {
            log("인벤토리 조회 실패: " + JSON.stringify(json));
            return;
        }
        
        renderInventory(json.items || []);
        log(`인벤토리 로드 완료 (${(json.items || []).length}개)`);
        
    } catch (err) {
        console.error(err);
        log("인벤토리 조회 중 오류 발생");
    }
}

function renderInventory(items) {
    inventoryEl.innerHTML = "";
    
    if (!items.length) {
        inventoryEl.textContent = "아이템 없음";
        return;
    }
    
    for (const it of items) {
        const row = document.createElement("div");
        row.className = "item-row grade-" + (it.grade || "Common");
        row.textContent = `#${it.tokenId ?? "?"} ${it.name || "Unknown"} [${it.grade || "Common"}]`;
        inventoryEl.appendChild(row);
    }
}

loadInvBtn.addEventListener("click", loadInventory);

// === 몬스터 전투 ===
function updateHpUI() {
    hpTextEl.textContent = `HP: ${hp} / ${maxHp}`;
    hpBarEl.style.width = `${(hp / maxHp) * 100}%`;
}

function showDamageText(dmg) {
    floatTextEl.textContent = `-${dmg}`;
    floatTextEl.style.left = "50%";
    floatTextEl.style.opacity = "1";
    floatTextEl.style.transform = "translate(-50%, -20px)";
    
    setTimeout(() => {
        floatTextEl.style.opacity = "0";
        floatTextEl.style.transform = "translate(-50%, 0px)";
    }, 250);
}

async function onMonsterKilled() {
    log("몬스터 처치! 서버에 드랍 요청 보냄...");
    
    if (!jwt) {
        log("JWT 없음: 로그인 후 드랍을 받을 수 있습니다.");
        return;
    }
    
    try {
        const payload = {
            monsterType: MONSTER_TYPE,
            monsterLevel: MONSTER_LEVEL,
            location: MONSTER_LOCATION
        };
        
        const res = await fetch(`${API_BASE}/monster-kill`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${jwt}`,
            },
            body: JSON.stringify(payload)
        });
        
        const json = await res.json();
        
        if (!json.success) {
            log("몬스터 킬 처리 실패: " + JSON.stringify(json));
            return;
        }
        
        if (json.dropped) {
            const item = json.item || {};
            const name = item.name || "Unknown Item";
            const grade = item.grade || "Common";
            log(`🎉 드랍! ${name} [${grade}]`);
            
            // 드랍 알림
            showDropNotification(name, grade);
            
            // 드랍 후 인벤토리 자동 새로고침
            setTimeout(() => loadInventory(), 500);
        } else {
            log("이번에는 드랍 없음.");
        }
        
    } catch (err) {
        console.error(err);
        log("몬스터 킬 처리 중 오류");
    }
}

function showDropNotification(name, grade) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 30px;
        border-radius: 10px;
        border: 2px solid #fbbf24;
        color: white;
        font-size: 20px;
        font-weight: bold;
        z-index: 1000;
        text-align: center;
    `;
    notification.innerHTML = `
        🎉 아이템 획득!<br>
        <span style="color: ${getGradeColor(grade)}">${name}</span><br>
        <small style="color: #9ca3af">[${grade}]</small>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 2000);
}

function getGradeColor(grade) {
    const colors = {
        'Common': '#e5e7eb',
        'Rare': '#38bdf8',
        'Epic': '#a855f7',
        'Legendary': '#fbbf24'
    };
    return colors[grade] || '#e5e7eb';
}

monsterEl.addEventListener("click", () => {
    if (hp <= 0) {
        // 리스폰
        hp = maxHp;
        updateHpUI();
        log("몬스터 리스폰");
        return;
    }
    
    const dmg = 1;
    hp = Math.max(0, hp - dmg);
    updateHpUI();
    showDamageText(dmg);
    
    if (hp === 0) {
        onMonsterKilled();
    }
});

// 초기 HP 표시
updateHpUI();
log("게임 준비 완료. MetaMask 로그인 또는 JWT 입력 후 시작하세요.");
