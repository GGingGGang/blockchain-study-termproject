/**
 * NFT 메타데이터 생성 헬퍼 함수
 * ERC-721 표준 준수
 */

/**
 * ERC-721 표준 메타데이터 생성
 * @param {Object} data - 메타데이터 입력
 * @param {string} data.name - NFT 이름
 * @param {string} data.description - NFT 설명
 * @param {string} data.imageCID - IPFS 이미지 CID
 * @param {Array} data.attributes - 속성 배열
 * @param {Object} data.gameData - 게임 데이터 (선택사항)
 * @returns {Object} ERC-721 표준 메타데이터
 */
function createNFTMetadata({ name, description, imageCID, attributes = [], gameData }) {
  const metadata = {
    name,
    description,
    image: `ipfs://${imageCID}`,
    attributes: attributes.map(attr => ({
      trait_type: attr.trait_type || attr.name,
      value: attr.value,
      ...(attr.display_type && { display_type: attr.display_type })
    }))
  };
  
  // 게임 데이터 추가 (선택사항)
  if (gameData) {
    metadata.game_data = gameData;
  }
  
  return metadata;
}

/**
 * 게임 아이템 메타데이터 생성
 * @param {Object} itemData - 아이템 데이터
 * @returns {Object} NFT 메타데이터
 */
function createGameItemMetadata(itemData) {
  const {
    name,
    description,
    imageCID,
    rarity,
    itemType,
    attackPower,
    defensePower,
    durability,
    levelRequirement,
    classRestriction,
    itemId
  } = itemData;
  
  const attributes = [];
  
  // 기본 속성
  if (rarity) attributes.push({ trait_type: 'Rarity', value: rarity });
  if (itemType) attributes.push({ trait_type: 'Type', value: itemType });
  
  // 전투 속성
  if (attackPower) attributes.push({ 
    trait_type: 'Attack Power', 
    value: attackPower,
    display_type: 'number'
  });
  if (defensePower) attributes.push({ 
    trait_type: 'Defense Power', 
    value: defensePower,
    display_type: 'number'
  });
  if (durability) attributes.push({ 
    trait_type: 'Durability', 
    value: durability,
    display_type: 'number'
  });
  
  // 요구사항
  if (levelRequirement) attributes.push({ 
    trait_type: 'Level Requirement', 
    value: levelRequirement,
    display_type: 'number'
  });
  if (classRestriction) attributes.push({ 
    trait_type: 'Class', 
    value: classRestriction 
  });
  
  // 게임 데이터
  const gameData = {
    item_id: itemId,
    ...(levelRequirement && { level_requirement: levelRequirement }),
    ...(classRestriction && { class_restriction: classRestriction })
  };
  
  return createNFTMetadata({
    name,
    description,
    imageCID,
    attributes,
    gameData
  });
}

/**
 * 몬스터 소환권 메타데이터 생성
 * @param {Object} ticketData - 소환권 데이터
 * @returns {Object} NFT 메타데이터
 */
function createSummonTicketMetadata(ticketData) {
  const {
    name,
    description,
    imageCID,
    monsterType,
    rarity,
    summonUses,
    itemId
  } = ticketData;
  
  const attributes = [
    { trait_type: 'Type', value: 'Summon Ticket' },
    { trait_type: 'Monster', value: monsterType },
    { trait_type: 'Rarity', value: rarity },
    { 
      trait_type: 'Summon Uses', 
      value: summonUses,
      display_type: 'number'
    },
    { trait_type: 'Source', value: 'Server Shop' }
  ];
  
  const gameData = {
    item_id: itemId,
    item_type: 'summon_ticket',
    monster_type: monsterType,
    summon_uses: summonUses
  };
  
  return createNFTMetadata({
    name,
    description,
    imageCID,
    attributes,
    gameData
  });
}

/**
 * 메타데이터 검증
 * @param {Object} metadata - 검증할 메타데이터
 * @returns {boolean} 유효성 여부
 */
function validateMetadata(metadata) {
  // 필수 필드 확인
  if (!metadata.name || typeof metadata.name !== 'string') {
    throw new Error('Metadata must have a valid name');
  }
  
  if (!metadata.description || typeof metadata.description !== 'string') {
    throw new Error('Metadata must have a valid description');
  }
  
  if (!metadata.image || !metadata.image.startsWith('ipfs://')) {
    throw new Error('Metadata must have a valid IPFS image URI');
  }
  
  // attributes 배열 확인
  if (metadata.attributes && !Array.isArray(metadata.attributes)) {
    throw new Error('Attributes must be an array');
  }
  
  // 각 attribute 검증
  if (metadata.attributes) {
    metadata.attributes.forEach((attr, index) => {
      if (!attr.trait_type || !('value' in attr)) {
        throw new Error(`Attribute at index ${index} must have trait_type and value`);
      }
    });
  }
  
  return true;
}

/**
 * Base64 이미지를 Buffer로 변환
 * @param {string} base64String - Base64 인코딩된 이미지
 * @returns {Buffer} 이미지 버퍼
 */
function base64ToBuffer(base64String) {
  // Base64 접두사 제거
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

module.exports = {
  createNFTMetadata,
  createGameItemMetadata,
  createSummonTicketMetadata,
  validateMetadata,
  base64ToBuffer
};
