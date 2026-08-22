# HG-01 restore apply (Human / local)

Branch tip files `chat-supabase.js` + `chat-service.js` FINAL_TIP bytes are in local commit
`e47b9e7b854c8e0f47c5ddeddd51cc4f233bae13` (box: /tmp/tasufull-article).

## Option A — from box clone with GitHub PAT write
```bash
cd /tmp/tasufull-article
# ensure tips present (sha16 a214623399819cb7 / 22b4bd619e76c9ed)
git push origin hg01-phase0-auth-uid-rls-prep
```

## Option B — from this bundle (base64)
```bash
base64 -d _hg01_restore/hg01_restore.bundle.b64 > /tmp/hg01_restore.bundle
git fetch origin hg01-phase0-auth-uid-rls-prep
git checkout hg01-phase0-auth-uid-rls-prep
git pull /tmp/hg01_restore.bundle
git push origin HEAD:hg01-phase0-auth-uid-rls-prep
```

## Option C — copy FINAL_TIP composed files
From workspace:
`poc-evidence/.../FINAL_TIP/chat-supabase.js.composed` → `chat-supabase.js`
`.../chat-service.js.composed` → `chat-service.js`
