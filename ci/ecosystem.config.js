// PM2 설정 파일
module.exports = {
  apps: [
    {
      name: 'blockchain-bridge',
      script: './server/index.js',
      instances: 2,  // 클러스터 모드 (CPU 코어 수에 맞게 조정)
      exec_mode: 'cluster',
      
      // 환경 변수
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      
      // 로그 설정
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 재시작 설정
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 4000,
      
      // 자동 재시작 조건
      min_uptime: '10s',
      max_restarts: 10,
      
      // 크론 재시작 (매일 새벽 4시)
      cron_restart: '0 4 * * *',
      
      // 헬스 체크
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // 환경별 설정
      instance_var: 'INSTANCE_ID'
    }
  ],
  
  deploy: {
    production: {
      user: 'root',
      host: 'bridge',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/blockchain-game.git',
      path: '/opt/blockchain-game',
      'post-deploy': 'npm ci --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /opt/blockchain-game'
    }
  }
};
