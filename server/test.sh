# curl -X POST http://localhost:3000/api/v1/synthesize \
# -H "Content-Type: application/json" \
# -d '{
#   "tracks": [
#     {"id": "wind", "vol": 0.15},
#     {"id": "drizzle", "vol": 0.7},
#     {"id": "wave", "vol": 0.6},
#     {"id": "dream", "vol": 0.6}
#   ],
#   "duration": 600
# }'


curl -X POST https://sounds.zhuyin.pro:1024/api/v1/synthesize \
-H "Content-Type: application/json" \
-d '{
  "tracks": [
    {"id": "wind", "vol": 0.15},
    {"id": "drizzle", "vol": 0.7},
    {"id": "wave", "vol": 0.6},
    {"id": "dream", "vol": 0.65}
  ],
  "duration": 600
}'
