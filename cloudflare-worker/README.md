# LEAP Vision Proxy (Cloudflare Worker)

브라우저에서 Google Cloud Vision API를 직접 부르지 않고, 이 Worker를 거쳐서
호출하도록 하는 프록시예요. 인증 정보(서비스 계정 키)는 이 Worker에만 저장되고
브라우저 코드에는 전혀 노출되지 않습니다.

## 1. GCP 쪽 준비

```bash
# 프로젝트 ID로 바꿔서 실행하세요
export PROJECT_ID=your-project-id

# Vision API 활성화
gcloud services enable vision.googleapis.com --project=$PROJECT_ID

# 이 프록시 전용 서비스 계정 생성
gcloud iam service-accounts create leap-vision-proxy \
  --display-name="LEAP Vision Proxy" \
  --project=$PROJECT_ID

# (Vision API 호출에 필요한 최소 권한)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:leap-vision-proxy@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/serviceusage.serviceUsageConsumer"

# 키 발급 — ⚠️ 조직 정책(iam.disableServiceAccountKeyCreation)으로 막혀있을 수 있어요.
# 이 명령이 실패하면 이 방식은 못 쓰고, Workload Identity Federation처럼 조직
# GCP 관리자 설정이 필요한 방식으로 넘어가야 해요.
gcloud iam service-accounts keys create key.json \
  --iam-account="leap-vision-proxy@${PROJECT_ID}.iam.gserviceaccount.com"
```

`key.json` 파일이 생성되면 됩니다. **이 파일은 절대 git에 커밋하거나 다른 곳에
붙여넣지 마세요.**

## 2. Cloudflare 쪽 배포

```bash
cd cloudflare-worker
npm install -g wrangler   # 처음 한 번만
wrangler login

# 비밀 값 등록 (key.json 파일 내용 전체를 그대로 붙여넣으라고 물어봐요)
wrangler secret put GCP_SERVICE_ACCOUNT_JSON
# → 프롬프트가 뜨면 key.json 파일 내용을 통째로 붙여넣고 Enter

# (선택, 권장) 이 사이트 origin으로 CORS 제한
wrangler secret put ALLOWED_ORIGIN
# → 예: http://localhost:5174  (배포 후엔 실제 배포 도메인으로)

wrangler deploy
```

배포가 끝나면 `https://leap-vision-proxy.<your-subdomain>.workers.dev` 같은
URL이 출력돼요. 이 URL을 [wordpick.js](../wordpick.js)의
`VISION_PROXY_URL` 상수에 넣어주세요.

## 3. 로컬에서 테스트

```bash
wrangler dev
```

이러면 `http://localhost:8787`에서 로컬로 뜨니, 그 주소를 임시로
`VISION_PROXY_URL`에 넣고 테스트해볼 수 있어요.

## 4. `key.json` 뒷정리

Worker에 secret으로 등록했으면 로컬 `key.json` 파일은 더 이상 필요 없어요.
안전하게 삭제하세요:

```bash
rm key.json
```

## 서비스 계정 키 발급이 막혀있다면

`gcloud iam service-accounts keys create`가 조직 정책 위반으로 거부되면, 이
방식(정적 사이트 + Cloudflare Worker + 서비스 계정 키) 자체를 쓸 수 없어요.
그 경우엔 **Workload Identity Federation**으로 Cloudflare가 GCP 서비스 계정을
키 파일 없이 임시로 "대신 사용"하도록 설정해야 하는데, 이건 조직의 GCP
관리자가 IAM에서 별도로 설정해줘야 하는 더 복잡한 방식이에요. 이 경우 조직
관리자에게 문의해주세요.
