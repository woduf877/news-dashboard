# 맥미니 배포 가이드

## 1. 필수 설치 (맥미니에 한 번만)

```bash
# Node.js 설치 (없다면)
brew install node

# PM2 설치 (프로세스 관리자)
npm install -g pm2
```

## 2. 의존성 설치 + 빌드

```bash
cd ~/news-dashboard

# 의존성 설치
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# React 프론트엔드 빌드 (backend/public 으로 출력)
cd frontend && npm run build && cd ..
```

## 3. PM2로 서버 시작

```bash
cd ~/news-dashboard

# 시작
pm2 start ecosystem.config.js

# 로그 확인
pm2 logs news-dashboard

# 상태 확인
pm2 status
```

## 4. 맥 재부팅 후 자동 시작 설정

```bash
# PM2 시작 스크립트 등록
pm2 startup

# 위 명령어 출력에 나오는 sudo ... 명령어를 복사해서 실행

# 현재 상태 저장
pm2 save
```

## 5. 로컬 네트워크에서 접속

맥미니 IP 확인:
```bash
ipconfig getifaddr en0
```

다른 기기에서: `http://[맥미니IP]:3001`

## 6. 외부(인터넷)에서 접속하려면

### 방법 A: ngrok (간단, 무료)
```bash
brew install ngrok
ngrok http 3001
```

### 방법 B: 공유기 포트포워딩
- 공유기 설정에서 외부 포트 80 → 맥미니IP:3001 포워딩
- DDNS 서비스(No-IP, DuckDNS) 연결

## 7. 업데이트 방법

```bash
cd ~/news-dashboard/frontend && npm run build
pm2 restart news-dashboard
```

## 포트 변경

```bash
PORT=8080 pm2 start ecosystem.config.js
# 또는 ecosystem.config.js 의 PORT 값 수정
```
