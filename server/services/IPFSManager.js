/**
 * IPFS Manager
 * Pinata API를 사용하여 IPFS에 파일 업로드
 */

const axios = require('axios');
const FormData = require('form-data');

class IPFSManager {
  constructor() {
    this.pinataApiKey = process.env.PINATA_API_KEY;
    this.pinataSecretKey = process.env.PINATA_SECRET_KEY;
    this.pinataJWT = process.env.PINATA_JWT;
    
    if (!this.pinataJWT && (!this.pinataApiKey || !this.pinataSecretKey)) {
      console.warn('⚠️  Pinata credentials not configured. IPFS uploads will fail.');
    }
    
    this.pinataBaseUrl = 'https://api.pinata.cloud';
    this.pinataGateway = process.env.PINATA_GATEWAY || 'https://gateway.pinata.cloud';
  }

  /**
   * Pinata API 헤더 생성
   * @returns {Object} 헤더 객체
   */
  _getHeaders() {
    if (this.pinataJWT) {
      return {
        'Authorization': `Bearer ${this.pinataJWT}`
      };
    }
    
    return {
      'pinata_api_key': this.pinataApiKey,
      'pinata_secret_api_key': this.pinataSecretKey
    };
  }

  /**
   * 이미지 업로드 (Buffer 또는 Base64)
   * @param {Buffer|string} imageData - 이미지 데이터
   * @param {string} filename - 파일명
   * @returns {Promise<string>} IPFS CID
   */
  async uploadImage(imageData, filename = 'image.png') {
    try {
      const formData = new FormData();
      
      // Base64 문자열인 경우 Buffer로 변환
      let buffer = imageData;
      if (typeof imageData === 'string') {
        // Base64 접두사 제거 (data:image/png;base64, 등)
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        buffer = Buffer.from(base64Data, 'base64');
      }
      
      formData.append('file', buffer, filename);
      
      const metadata = JSON.stringify({
        name: filename,
        keyvalues: {
          type: 'image',
          uploadedAt: new Date().toISOString()
        }
      });
      formData.append('pinataMetadata', metadata);
      
      const response = await axios.post(
        `${this.pinataBaseUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            ...this._getHeaders(),
            ...formData.getHeaders()
          },
          maxBodyLength: Infinity
        }
      );
      
      const cid = response.data.IpfsHash;
      console.log(`✅ 이미지 업로드 성공: ${cid}`);
      
      return cid;
    } catch (error) {
      console.error('❌ 이미지 업로드 실패:', error.response?.data || error.message);
      throw new Error(`IPFS image upload failed: ${error.message}`);
    }
  }

  /**
   * JSON 메타데이터 업로드
   * @param {Object} metadata - NFT 메타데이터 객체
   * @returns {Promise<string>} IPFS CID
   */
  async uploadMetadata(metadata) {
    try {
      const response = await axios.post(
        `${this.pinataBaseUrl}/pinning/pinJSONToIPFS`,
        metadata,
        {
          headers: {
            ...this._getHeaders(),
            'Content-Type': 'application/json'
          }
        }
      );
      
      const cid = response.data.IpfsHash;
      console.log(`✅ 메타데이터 업로드 성공: ${cid}`);
      
      return cid;
    } catch (error) {
      console.error('❌ 메타데이터 업로드 실패:', error.response?.data || error.message);
      throw new Error(`IPFS metadata upload failed: ${error.message}`);
    }
  }

  /**
   * 재시도 로직을 포함한 업로드
   * @param {Function} uploadFn - 업로드 함수
   * @param {number} maxRetries - 최대 재시도 횟수
   * @returns {Promise<string>} IPFS CID
   */
  async uploadWithRetry(uploadFn, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 업로드 시도 ${attempt}/${maxRetries}...`);
        return await uploadFn();
      } catch (error) {
        lastError = error;
        console.warn(`⚠️  시도 ${attempt} 실패:`, error.message);
        
        if (attempt < maxRetries) {
          // 지수 백오프: 1초, 2초, 4초
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`⏳ ${delay}ms 후 재시도...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`Upload failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * 전체 NFT 업로드 (이미지 + 메타데이터)
   * @param {Object} nftData - NFT 데이터
   * @param {string|Buffer} nftData.image - 이미지 데이터
   * @param {string} nftData.name - NFT 이름
   * @param {string} nftData.description - NFT 설명
   * @param {Array} nftData.attributes - NFT 속성
   * @param {Object} nftData.gameData - 게임 데이터 (선택사항)
   * @returns {Promise<Object>} { imageCID, metadataCID, metadataURI }
   */
  async uploadNFT(nftData) {
    const { image, name, description, attributes, gameData } = nftData;
    
    // 1. 이미지 업로드 (재시도 포함)
    console.log(`📸 이미지 업로드 중: ${name}`);
    const imageCID = await this.uploadWithRetry(
      () => this.uploadImage(image, `${name}.png`)
    );
    
    // 2. 메타데이터 생성
    const metadata = {
      name,
      description,
      image: `ipfs://${imageCID}`,
      attributes: attributes || [],
      ...(gameData && { game_data: gameData })
    };
    
    // 3. 메타데이터 업로드 (재시도 포함)
    console.log(`📝 메타데이터 업로드 중: ${name}`);
    const metadataCID = await this.uploadWithRetry(
      () => this.uploadMetadata(metadata)
    );
    
    return {
      imageCID,
      metadataCID,
      metadataURI: `ipfs://${metadataCID}`,
      imageURL: `${this.pinataGateway}/ipfs/${imageCID}`,
      metadataURL: `${this.pinataGateway}/ipfs/${metadataCID}`
    };
  }

  /**
   * CID로 파일 조회
   * @param {string} cid - IPFS CID
   * @returns {string} 파일 URL
   */
  getFileURL(cid) {
    return `${this.pinataGateway}/ipfs/${cid}`;
  }

  /**
   * IPFS에서 메타데이터 가져오기
   * @param {string} cid - IPFS CID
   * @returns {Promise<Object>} 메타데이터 객체
   */
  async getMetadata(cid) {
    try {
      const url = `${this.pinataGateway}/ipfs/${cid}`;
      const response = await axios.get(url, {
        timeout: 10000 // 10초 타임아웃
      });
      
      return response.data;
    } catch (error) {
      console.error(`메타데이터 조회 실패 (${cid}):`, error.message);
      throw new Error(`Failed to fetch metadata from IPFS: ${error.message}`);
    }
  }

  /**
   * JSON 업로드 (uploadMetadata의 별칭)
   * @param {Object} json - JSON 객체
   * @returns {Promise<string>} IPFS CID
   */
  async uploadJSON(json) {
    return this.uploadMetadata(json);
  }

  /**
   * Pinata 연결 테스트
   * @returns {Promise<boolean>} 연결 성공 여부
   */
  async testConnection() {
    try {
      const response = await axios.get(
        `${this.pinataBaseUrl}/data/testAuthentication`,
        {
          headers: this._getHeaders()
        }
      );
      
      console.log('✅ Pinata 연결 성공:', response.data);
      return true;
    } catch (error) {
      console.error('❌ Pinata 연결 실패:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = IPFSManager;
