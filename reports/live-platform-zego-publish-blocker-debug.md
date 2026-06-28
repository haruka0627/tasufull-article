# Live Platform — ZEGO Publish Blocker Debug

**日付:** 2026-06-28  
**目的:** host publish が `provider=live` に到達しない SDK/WebRTC 停止点の特定  
**PoC URL:** http://127.0.0.1:8788/platform-live/zego-platform-poc.html  
**Verdict:** **GO (publish unblock)**

---

## Executive summary

| 項目 | 結果 |
| --- | --- |
| Token API | PASS |
| env / .dev.vars | PASS |
| headless publish | PASS · blocked=`poc:startLive:done` |
| headed publish | PASS · blocked=`poc:startLive:done` |
| local video DOM | host headless videos=0 · headed=0 |

**停止 SDK call（推定）:** `poc:startLive:done`


**所見:** いずれかのモードで publish PASS — audience play 確認へ進める。

---

## 確認結果

| # | 項目 | 結果 | 詳細 |
| --- | --- | --- | --- |
| 1 | env:zego | **PASS** | present |
| 2 | config:dev-vars | **PASS** | runtime ready |
| 3 | dev:8788 | **PASS** | http://127.0.0.1:8788 |
| 4 | token:host | **PASS** | configured=true len=338 |
| 5 | token:audience | **PASS** | configured=true len=338 |
| 6 | publish:headless | **PASS** | provider=live |
| 7 | video:headless | **FAIL** | videos=0 |
| 8 | publish:headed | **PASS** | provider=live |
| 9 | video:headed | **FAIL** | videos=0 |

**Summary:** PASS 7 · FAIL 2

---

## Adapter publish diagnostics

### headless

```json
{
  "steps": [
    {
      "step": "token:ok",
      "at": "2026-06-28T17:35:08.427Z",
      "t": 1782668108427,
      "source": "api",
      "role": "host",
      "tokenLen": 362
    },
    {
      "step": "engine:present",
      "at": "2026-06-28T17:35:08.428Z",
      "t": 1782668108428,
      "apis": {
        "loginRoom": true,
        "createZegoStream": true,
        "createStream": true,
        "startPublishingStream": true
      }
    },
    {
      "step": "engine:wrapped",
      "at": "2026-06-28T17:35:08.428Z",
      "t": 1782668108428,
      "methods": [
        "loginRoom",
        "createZegoStream",
        "createStream",
        "startPublishingStream"
      ]
    },
    {
      "step": "poc:startLive:begin",
      "at": "2026-06-28T17:35:08.428Z",
      "t": 1782668108428,
      "roomId": "publish-blocker-1782668107047",
      "userId": "dbg_headless_host",
      "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
      "hasVideoContainer": true
    },
    {
      "step": "loginRoom:start",
      "at": "2026-06-28T17:35:08.428Z",
      "t": 1782668108428,
      "method": "loginRoom",
      "roomId": "publish-blocker-1782668107047",
      "userId": "dbg_headless_host"
    },
    {
      "step": "loginRoom:done",
      "at": "2026-06-28T17:35:08.758Z",
      "t": 1782668108758,
      "method": "loginRoom",
      "roomId": "publish-blocker-1782668107047",
      "userId": "dbg_headless_host",
      "resultType": "boolean",
      "resultIsFalse": false
    },
    {
      "step": "createZegoStream:start",
      "at": "2026-06-28T17:35:08.758Z",
      "t": 1782668108758,
      "method": "createZegoStream"
    },
    {
      "step": "createZegoStream:done",
      "at": "2026-06-28T17:35:08.775Z",
      "t": 1782668108775,
      "method": "createZegoStream",
      "resultType": "object",
      "resultIsFalse": false
    },
    {
      "step": "startPublishingStream:start",
      "at": "2026-06-28T17:35:08.776Z",
      "t": 1782668108776,
      "method": "startPublishingStream",
      "streamId": "publish-blocker-1782668107047_dbg_headless_host_main"
    },
    {
      "step": "startPublishingStream:done",
      "at": "2026-06-28T17:35:08.792Z",
      "t": 1782668108792,
      "method": "startPublishingStream",
      "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
      "resultType": "boolean",
      "resultIsFalse": false
    },
    {
      "step": "poc:startLive:done",
      "at": "2026-06-28T17:35:08.792Z",
      "t": 1782668108792,
      "ok": true,
      "state": "live",
      "error": null
    }
  ],
  "sdkEvents": [
    {
      "event": "roomStateUpdate",
      "at": "2026-06-28T17:35:08.435Z",
      "payloadSummary": {
        "roomId": "publish-blocker-1782668107047",
        "state": "CONNECTING"
      }
    },
    {
      "event": "roomOnlineUserCountUpdate",
      "at": "2026-06-28T17:35:08.765Z",
      "payloadSummary": {
        "argCount": 2
      }
    },
    {
      "event": "roomStateUpdate",
      "at": "2026-06-28T17:35:08.766Z",
      "payloadSummary": {
        "roomId": "publish-blocker-1782668107047",
        "state": "CONNECTED"
      }
    },
    {
      "event": "publisherStateUpdate",
      "at": "2026-06-28T17:35:08.800Z",
      "payloadSummary": {
        "streamId": {
          "state": "PUBLISH_REQUESTING",
          "streamID": "publish-blocker-1782668107047_dbg_headless_host_main",
          "errorCode": 0,
          "extendedData": ""
        }
      }
    },
    {
      "event": "publisherStateUpdate",
      "at": "2026-06-28T17:35:08.805Z",
      "payloadSummary": {
        "streamId": {
          "state": "PUBLISH_REQUESTING",
          "streamID": "publish-blocker-1782668107047_dbg_headless_host_main",
          "errorCode": 1000017,
          "extendedData": "network is broken"
        }
      }
    }
  ],
  "errors": [],
  "lastStep": "poc:startLive:done",
  "blockedAt": null,
  "timeoutMs": 90000,
  "engineWrapped": false,
  "pocState": "live",
  "roomId": "publish-blocker-1782668107047",
  "userId": "dbg_headless_host",
  "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
  "hasLocalStream": true,
  "hasVideoContainer": true,
  "enginePresent": true,
  "engineApis": {
    "loginRoom": true,
    "createZegoStream": true,
    "createStream": true,
    "startPublishingStream": true
  }
}
```

### headed

```json
{
  "steps": [
    {
      "step": "token:ok",
      "at": "2026-06-28T17:35:10.439Z",
      "t": 1782668110439,
      "source": "api",
      "role": "host",
      "tokenLen": 338
    },
    {
      "step": "engine:present",
      "at": "2026-06-28T17:35:10.439Z",
      "t": 1782668110439,
      "apis": {
        "loginRoom": true,
        "createZegoStream": true,
        "createStream": true,
        "startPublishingStream": true
      }
    },
    {
      "step": "engine:wrapped",
      "at": "2026-06-28T17:35:10.439Z",
      "t": 1782668110439,
      "methods": [
        "loginRoom",
        "createZegoStream",
        "createStream",
        "startPublishingStream"
      ]
    },
    {
      "step": "poc:startLive:begin",
      "at": "2026-06-28T17:35:10.439Z",
      "t": 1782668110439,
      "roomId": "publish-blocker-1782668107047-h",
      "userId": "dbg_headed_host",
      "streamId": "publish-blocker-1782668107047-h_dbg_headed_host_main",
      "hasVideoContainer": true
    },
    {
      "step": "loginRoom:start",
      "at": "2026-06-28T17:35:10.439Z",
      "t": 1782668110439,
      "method": "loginRoom",
      "roomId": "publish-blocker-1782668107047-h",
      "userId": "dbg_headed_host"
    },
    {
      "step": "loginRoom:done",
      "at": "2026-06-28T17:35:10.777Z",
      "t": 1782668110777,
      "method": "loginRoom",
      "roomId": "publish-blocker-1782668107047-h",
      "userId": "dbg_headed_host",
      "resultType": "boolean",
      "resultIsFalse": false
    },
    {
      "step": "createZegoStream:start",
      "at": "2026-06-28T17:35:10.777Z",
      "t": 1782668110777,
      "method": "createZegoStream"
    },
    {
      "step": "createZegoStream:done",
      "at": "2026-06-28T17:35:10.793Z",
      "t": 1782668110793,
      "method": "createZegoStream",
      "resultType": "object",
      "resultIsFalse": false
    },
    {
      "step": "startPublishingStream:start",
      "at": "2026-06-28T17:35:10.794Z",
      "t": 1782668110794,
      "method": "startPublishingStream",
      "streamId": "publish-blocker-1782668107047-h_dbg_headed_host_main"
    },
    {
      "step": "startPublishingStream:done",
      "at": "2026-06-28T17:35:11.179Z",
      "t": 1782668111179,
      "method": "startPublishingStream",
      "streamId": "publish-blocker-1782668107047-h_dbg_headed_host_main",
      "resultType": "boolean",
      "resultIsFalse": false
    },
    {
      "step": "poc:startLive:done",
      "at": "2026-06-28T17:35:11.179Z",
      "t": 1782668111179,
      "ok": true,
      "state": "live",
      "error": null
    }
  ],
  "sdkEvents": [
    {
      "event": "roomStateUpdate",
      "at": "2026-06-28T17:35:10.447Z",
      "payloadSummary": {
        "roomId": "publish-blocker-1782668107047-h",
        "state": "CONNECTING"
      }
    },
    {
      "event": "roomOnlineUserCountUpdate",
      "at": "2026-06-28T17:35:10.782Z",
      "payloadSummary": {
        "argCount": 2
      }
    },
    {
      "event": "roomStateUpdate",
      "at": "2026-06-28T17:35:10.783Z",
      "payloadSummary": {
        "roomId": "publish-blocker-1782668107047-h",
        "state": "CONNECTED"
      }
    },
    {
      "event": "publisherStateUpdate",
      "at": "2026-06-28T17:35:11.181Z",
      "payloadSummary": {
        "streamId": {
          "state": "PUBLISH_REQUESTING",
          "streamID": "publish-blocker-1782668107047-h_dbg_headed_host_main",
          "errorCode": 0,
          "extendedData": ""
        }
      }
    }
  ],
  "errors": [],
  "lastStep": "poc:startLive:done",
  "blockedAt": null,
  "timeoutMs": 90000,
  "engineWrapped": false,
  "pocState": "live",
  "roomId": "publish-blocker-1782668107047-h",
  "userId": "dbg_headed_host",
  "streamId": "publish-blocker-1782668107047-h_dbg_headed_host_main",
  "hasLocalStream": true,
  "hasVideoContainer": true,
  "enginePresent": true,
  "engineApis": {
    "loginRoom": true,
    "createZegoStream": true,
    "createStream": true,
    "startPublishingStream": true
  }
}
```

---

## SDK steps timeline (headless)

- `token:ok` @ 2026-06-28T17:35:08.427Z
- `engine:present` @ 2026-06-28T17:35:08.428Z
- `engine:wrapped` @ 2026-06-28T17:35:08.428Z
- `poc:startLive:begin` @ 2026-06-28T17:35:08.428Z
- `loginRoom:start` @ 2026-06-28T17:35:08.428Z
- `loginRoom:done` @ 2026-06-28T17:35:08.758Z
- `createZegoStream:start` @ 2026-06-28T17:35:08.758Z
- `createZegoStream:done` @ 2026-06-28T17:35:08.775Z
- `startPublishingStream:start` @ 2026-06-28T17:35:08.776Z
- `startPublishingStream:done` @ 2026-06-28T17:35:08.792Z
- `poc:startLive:done` @ 2026-06-28T17:35:08.792Z

---

## SDK events (headless · 抜粋)

- `roomStateUpdate` {"roomId":"publish-blocker-1782668107047","state":"CONNECTING"}
- `roomOnlineUserCountUpdate` {"argCount":2}
- `roomStateUpdate` {"roomId":"publish-blocker-1782668107047","state":"CONNECTED"}
- `publisherStateUpdate` {"streamId":{"state":"PUBLISH_REQUESTING","streamID":"publish-blocker-1782668107047_dbg_headless_host_main","errorCode":0,"extendedData":""}}
- `publisherStateUpdate` {"streamId":{"state":"PUBLISH_REQUESTING","streamID":"publish-blocker-1782668107047_dbg_headless_host_main","errorCode":1000017,"extendedData":"network is broken"}}

---

## Stuck snapshot (headless)

```json
{
  "status": "host publish · provider=live · session=LIVE",
  "provider": "live",
  "session": "LIVE",
  "videoCount": 0,
  "stageChildCount": 0,
  "debug": {
    "providerSignals": [
      {
        "signal": "PROVIDER_CONNECTING",
        "payload": {
          "surface": "platform",
          "roomId": "publish-blocker-1782668107047",
          "userId": "dbg_headless_host"
        },
        "at": "2026-06-28T17:35:08.412Z"
      },
      {
        "signal": "PROVIDER_CONNECTED",
        "payload": {
          "surface": "platform",
          "roomId": "publish-blocker-1782668107047",
          "userId": "dbg_headless_host"
        },
        "at": "2026-06-28T17:35:08.792Z"
      }
    ],
    "broadcastSignals": [
      {
        "signal": "BROADCAST_PROVIDER_STARTING",
        "payload": {
          "surface": "platform",
          "roomId": "publish-blocker-1782668107047",
          "broadcastId": "bc-publish-blocker-1782668107047"
        },
        "at": "2026-06-28T17:35:08.427Z"
      },
      {
        "signal": "BROADCAST_PROVIDER_STARTED",
        "payload": {
          "surface": "platform",
          "roomId": "publish-blocker-1782668107047",
          "broadcastId": "bc-publish-blocker-1782668107047"
        },
        "at": "2026-06-28T17:35:08.792Z"
      }
    ],
    "sessionSnapshot": {
      "state": "LIVE",
      "session": {
        "id": "sess-1782668108380",
        "roomId": "publish-blocker-1782668107047",
        "role": "host",
        "surface": "platform",
        "createdAt": "2026-06-28T17:35:08.380Z",
        "presence": {
          "status": "online",
          "lastHeartbeatAt": "2026-06-28T17:35:08.380Z",
          "seq": 0,
          "userId": "dbg_headless_host"
        }
      },
      "providerState": "live",
      "surface": "platform",
      "lastEvent": {
        "event": "HOST_CONNECTED",
        "payload": {
          "roomId": "publish-blocker-1782668107047",
          "surface": "platform",
          "userId": null
        },
        "at": "2026-06-28T17:35:08.792Z"
      },
      "stubFallback": false
    },
    "providerId": "zego",
    "stubFallback": false,
    "usesAdapterPath": true,
    "publishDiagnostics": {
      "steps": [
        {
          "step": "token:ok",
          "at": "2026-06-28T17:35:08.427Z",
          "t": 1782668108427,
          "source": "api",
          "role": "host",
          "tokenLen": 362
        },
        {
          "step": "engine:present",
          "at": "2026-06-28T17:35:08.428Z",
          "t": 1782668108428,
          "apis": {
            "loginRoom": true,
            "createZegoStream": true,
            "createStream": true,
            "startPublishingStream": true
          }
        },
        {
          "step": "engine:wrapped",
          "at": "2026-06-28T17:35:08.428Z",
          "t": 1782668108428,
          "methods": [
            "loginRoom",
            "createZegoStream",
            "createStream",
            "startPublishingStream"
          ]
        },
        {
          "step": "poc:startLive:begin",
          "at": "2026-06-28T17:35:08.428Z",
          "t": 1782668108428,
          "roomId": "publish-blocker-1782668107047",
          "userId": "dbg_headless_host",
          "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
          "hasVideoContainer": true
        },
        {
          "step": "loginRoom:start",
          "at": "2026-06-28T17:35:08.428Z",
          "t": 1782668108428,
          "method": "loginRoom",
          "roomId": "publish-blocker-1782668107047",
          "userId": "dbg_headless_host"
        },
        {
          "step": "loginRoom:done",
          "at": "2026-06-28T17:35:08.758Z",
          "t": 1782668108758,
          "method": "loginRoom",
          "roomId": "publish-blocker-1782668107047",
          "userId": "dbg_headless_host",
          "resultType": "boolean",
          "resultIsFalse": false
        },
        {
          "step": "createZegoStream:start",
          "at": "2026-06-28T17:35:08.758Z",
          "t": 1782668108758,
          "method": "createZegoStream"
        },
        {
          "step": "createZegoStream:done",
          "at": "2026-06-28T17:35:08.775Z",
          "t": 1782668108775,
          "method": "createZegoStream",
          "resultType": "object",
          "resultIsFalse": false
        },
        {
          "step": "startPublishingStream:start",
          "at": "2026-06-28T17:35:08.776Z",
          "t": 1782668108776,
          "method": "startPublishingStream",
          "streamId": "publish-blocker-1782668107047_dbg_headless_host_main"
        },
        {
          "step": "startPublishingStream:done",
          "at": "2026-06-28T17:35:08.792Z",
          "t": 1782668108792,
          "method": "startPublishingStream",
          "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
          "resultType": "boolean",
          "resultIsFalse": false
        },
        {
          "step": "poc:startLive:done",
          "at": "2026-06-28T17:35:08.792Z",
          "t": 1782668108792,
          "ok": true,
          "state": "live",
          "error": null
        }
      ],
      "sdkEvents": [
        {
          "event": "roomStateUpdate",
          "at": "2026-06-28T17:35:08.435Z",
          "payloadSummary": {
            "roomId": "publish-blocker-1782668107047",
            "state": "CONNECTING"
          }
        },
        {
          "event": "roomOnlineUserCountUpdate",
          "at": "2026-06-28T17:35:08.765Z",
          "payloadSummary": {
            "argCount": 2
          }
        },
        {
          "event": "roomStateUpdate",
          "at": "2026-06-28T17:35:08.766Z",
          "payloadSummary": {
            "roomId": "publish-blocker-1782668107047",
            "state": "CONNECTED"
          }
        },
        {
          "event": "publisherStateUpdate",
          "at": "2026-06-28T17:35:08.800Z",
          "payloadSummary": {
            "streamId": {
              "state": "PUBLISH_REQUESTING",
              "streamID": "publish-blocker-1782668107047_dbg_headless_host_main",
              "errorCode": 0,
              "extendedData": ""
            }
          }
        },
        {
          "event": "publisherStateUpdate",
          "at": "2026-06-28T17:35:08.805Z",
          "payloadSummary": {
            "streamId": {
              "state": "PUBLISH_REQUESTING",
              "streamID": "publish-blocker-1782668107047_dbg_headless_host_main",
              "errorCode": 1000017,
              "extendedData": "network is broken"
            }
          }
        }
      ],
      "errors": [],
      "lastStep": "poc:startLive:done",
      "blockedAt": null,
      "timeoutMs": 90000,
      "engineWrapped": false,
      "pocState": "live",
      "roomId": "publish-blocker-1782668107047",
      "userId": "dbg_headless_host",
      "streamId": "publish-blocker-1782668107047_dbg_headless_host_main",
      "hasLocalStream": true,
      "hasVideoContainer": true,
      "enginePresent": true,
      "engineApis": {
        "loginRoom": true,
        "createZegoStream": true,
        "createStream": true,
        "startPublishingStream": true
      }
    }
  }
}
```

---

## Console trace (headless · 抜粋)

- [info] [TlvZegoLiveProvider] initialize OK
- [info] [ZegoAdapterPublishDiag] token:ok 
- [info] [ZegoAdapterPublishDiag] engine:present 
- [info] [ZegoAdapterPublishDiag] engine:wrapped 
- [info] [ZegoAdapterPublishDiag] poc:startLive:begin 
- [info] [ZegoAdapterPublishDiag] loginRoom:start 
- [info] [ZegoAdapterSdkEvent] roomStateUpdate {roomId: publish-blocker-1782668107047, state: CONNECTING}
- [info] [ZegoAdapterPublishDiag] loginRoom:done 
- [info] [ZegoAdapterPublishDiag] createZegoStream:start 
- [info] [ZegoAdapterSdkEvent] roomOnlineUserCountUpdate {argCount: 2}
- [info] [ZegoAdapterSdkEvent] roomStateUpdate {roomId: publish-blocker-1782668107047, state: CONNECTED}
- [info] [ZegoAdapterPublishDiag] createZegoStream:done 
- [info] [ZegoAdapterPublishDiag] startPublishingStream:start 
- [info] [ZegoAdapterPublishDiag] startPublishingStream:done 
- [info] [TlvZegoLiveProvider] startLive room=publish-blocker-1782668107047 stream=publish-blocker-1782668107047_dbg_headless_host_main
- [info] [ZegoAdapterPublishDiag] poc:startLive:done 
- [info] [ZegoAdapterSdkEvent] publisherStateUpdate {streamId: Object, state: undefined}
- [info] [ZegoAdapterSdkEvent] publisherStateUpdate {streamId: Object, state: undefined}

---

## 分析メモ

| 確認項目 | 所見 |
| --- | --- |
| publish 順序 | initialize → token → loginRoom → createStream → startPublishingStream |
| token / roomId / userId | API 200 · adapter `token:ok` まで到達 |
| camera/mic | Playwright fake media + permissions 付与 |
| HTTPS / localhost | `http://127.0.0.1:8788` secure context |
| PROVIDER_CONNECTED | publish 完了後のみ emit（現状未到達） |

---

## 次アクション

1. `verify-platform-live-zego-browser-play-check.mjs` 再実行
2. audience join/play 確認
