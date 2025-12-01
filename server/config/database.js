/**
 * 데이터베이스 연결 설정
 * MySQL2 Promise 기반 연결 풀
 */

const mysql = require('mysql2/promise');

// 연결 풀 생성
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'bridge_user',
  password: process.env.DB_PASSWORD || 'bridge_password_2024',
  database: process.env.DB_NAME || 'blockchain_game',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

/**
 * 쿼리 실행 헬퍼
 * @param {string} sql - SQL 쿼리
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<Array>} 쿼리 결과
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * 단일 레코드 조회
 * @param {string} sql - SQL 쿼리
 * @param {Array} params - 쿼리 파라미터
 * @returns {Promise<Object|null>} 단일 레코드 또는 null
 */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * INSERT 쿼리 실행
 * @param {string} table - 테이블명
 * @param {Object} data - 삽입할 데이터
 * @returns {Promise<number>} 삽입된 레코드의 ID
 */
async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map(() => '?').join(', ');
  
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const [result] = await pool.execute(sql, values);
  
  return result.insertId;
}

/**
 * UPDATE 쿼리 실행
 * @param {string} table - 테이블명
 * @param {number} id - 레코드 ID
 * @param {Object} data - 업데이트할 데이터
 * @returns {Promise<boolean>} 성공 여부
 */
async function update(table, id, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map(key => `${key} = ?`).join(', ');
  
  const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
  const [result] = await pool.execute(sql, [...values, id]);
  
  return result.affectedRows > 0;
}

/**
 * DELETE 쿼리 실행
 * @param {string} table - 테이블명
 * @param {number} id - 레코드 ID
 * @returns {Promise<boolean>} 성공 여부
 */
async function deleteRecord(table, id) {
  const sql = `DELETE FROM ${table} WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  
  return result.affectedRows > 0;
}

/**
 * 트랜잭션 실행
 * @param {Function} callback - 트랜잭션 콜백 함수
 * @returns {Promise<any>} 콜백 결과
 */
async function transaction(callback) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 연결 풀 종료
 * @returns {Promise<void>}
 */
async function close() {
  try {
    await pool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  insert,
  update,
  delete: deleteRecord,
  transaction,
  close
};
