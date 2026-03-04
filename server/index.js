const express = require('express');
const cors = require('cors');
const path = require('path');
const AudioSynthesizer = require('./services/audioSynthesizer');

const app = express();
app.use(cors()); // 允许跨域请求
const port = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;
const SOURCE_DIR = process.env.SOURCE_DIR || path.join(__dirname, 'sources');
const TEMP_DIR = process.env.TEMP_DIR || path.join(__dirname, 'temp');

// 初始化合成器
const synthesizer = new AudioSynthesizer({
    tempDir: TEMP_DIR,
    sourceDir: SOURCE_DIR
});

app.use(express.json());
app.use('/temp', express.static(TEMP_DIR));
app.use('/sounds', express.static(SOURCE_DIR)); // 允许通过后端直接访问原始音源

/**
 * 混音合成接口
 * POST /api/v1/synthesize
 * Payload: { tracks: [{id, vol}], duration: 1800 }
 */
app.post('/api/v1/synthesize', async (req, res) => {
    try {
        const { tracks, duration } = req.body;

        if (!tracks || !Array.isArray(tracks)) {
            return res.status(400).json({ error: 'Invalid tracks parameter' });
        }

        const result = await synthesizer.synthesize(tracks, duration);

        // 使用配置的 BASE_URL 构建完整的地址 (适配 NAS Lucky Proxy)
        const fullUrl = `${BASE_URL}${result.url}`;

        res.json({
            success: true,
            url: fullUrl,
            hash: result.hash,
            cached: result.cached
        });
    } catch (error) {
        console.error('Synthesis failed:', error);
        res.status(500).json({ 
            error: 'Internal server error during synthesis',
            message: error.message // 把错误详情发回前端
        });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`WhiteNoise Cloud Synthesis server running at http://localhost:${port}`);
});
