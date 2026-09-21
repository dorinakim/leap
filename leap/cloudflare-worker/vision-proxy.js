// vision-proxy.js — Cloudflare Worker
//
// 브라우저(정적 사이트)와 Google Cloud Vision API 사이의 프록시예요. 인증 정보
// (서비스 계정 키)는 이 Worker 안에만 있고, 브라우저 코드에는 절대 노출되지
// 않아요. 브라우저는 사진(base64)만 이 Worker로 보내고, Worker가 서비스 계정으로
// 서명한 JWT를 만들어 Google의 OAuth2 토큰 엔드포인트에서 액세스 토큰을 받은 뒤,
// 그 토큰으로 Vision API를 대신 호출해서 결과만 돌려줍니다.
//
// 필요한 설정 (README.md 참고):
//   - Secret:  GCP_SERVICE_ACCOUNT_JSON  (서비스 계정 키 JSON 파일 내용 전체)
//   - Secret:  ALLOWED_ORIGIN            (선택. 이 사이트 도메인으로 CORS 제한, 비우면 "*")

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, env);
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return jsonResponse({ error: "Invalid JSON body" }, 400, env);
    }

    const base64Image = body.image;
    if (!base64Image) {
      return jsonResponse({ error: "Missing 'image' (base64, no data: prefix) field" }, 400, env);
    }

    try {
      const accessToken = await getAccessToken(env);
      const visionRes = await fetch("https://vision.googleapis.com/v1/images:annotate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "LABEL_DETECTION", maxResults: 8 }],
            },
          ],
        }),
      });
      const data = await visionRes.json();
      return jsonResponse(data, visionRes.status, env);
    } catch (e) {
      console.error("vision-proxy error:", e);
      return jsonResponse({ error: String(e && e.message ? e.message : e) }, 500, env);
    }
  },
};

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": (env && env.ALLOWED_ORIGIN) || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(obj, status, env) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

// ---------- 서비스 계정 JWT → OAuth2 액세스 토큰 교환 ----------
// Worker 인스턴스가 재사용되는 동안은(요청마다 새로 만들지 않고) 캐시해서
// 토큰 발급 왕복을 줄여요. 인스턴스가 재활용되면 자연히 다시 발급받습니다.
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < cachedTokenExpiry - 60) return cachedToken;

  if (!env.GCP_SERVICE_ACCOUNT_JSON) {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON secret이 설정되지 않았어요 (wrangler secret put GCP_SERVICE_ACCOUNT_JSON)");
  }
  const key = JSON.parse(env.GCP_SERVICE_ACCOUNT_JSON);

  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedClaimSet = base64url(JSON.stringify(claimSet));
  const signingInput = `${encodedHeader}.${encodedClaimSet}`;

  const cryptoKey = await importPrivateKey(key.private_key);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );
  const jwt = `${signingInput}.${base64urlFromBuffer(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error("액세스 토큰 발급 실패: " + JSON.stringify(tokenData));
  }

  cachedToken = tokenData.access_token;
  cachedTokenExpiry = now + (tokenData.expires_in || 3600);
  return cachedToken;
}

function base64url(str) {
  return base64urlFromBuffer(new TextEncoder().encode(str));
}

function base64urlFromBuffer(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem) {
  const pemBody = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
