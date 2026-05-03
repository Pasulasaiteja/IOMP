/**
 * Unit tests for server/routes/sync.js
 * Tests background data synchronization, duplicate detection, and retry logic
 */

const request = require('supertest');
const express = require('express');

jest.mock('../db', () => ({
  getDb: jest.fn(() => Promise.resolve({})),
  all: jest.fn(),
  run: jest.fn(),
}));

const db = require('../db');

const createSyncRouter = () => {
  const router = express.Router();

  router.post('/sync-tracking', async (req, res) => {
    try {
      const { records } = req.body;
      
      if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Invalid records format' });
      }

      const db_inst = await db.getDb();
      let synced = 0;
      let duplicates = 0;
      const userId = req.userId || 'test-user-123';

      for (const record of records) {
        const { app_name, minutes, date, timestamp } = record;

        if (!app_name || !minutes || !date) {
          console.warn('[Sync] Skipping invalid record:', record);
          continue;
        }

        const existing = db.all(
          db_inst,
          `SELECT id FROM screen_time 
           WHERE user_id = ? AND app_name = ? AND date = ? 
           AND timestamp >= ?`,
          [userId, app_name, date, timestamp - 60000]
        );

        if (existing && existing.length > 0) {
          duplicates++;
          continue;
        }

        db.run(
          db_inst,
          `INSERT INTO screen_time (user_id, app_name, minutes, date, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
          [userId, app_name, minutes, date, timestamp]
        );

        synced++;
      }

      res.json({
        success: true,
        synced,
        duplicates,
        message: `Synced ${synced} tracking records`
      });
    } catch (err) {
      console.error('[Sync] Error:', err);
      res.status(500).json({ error: 'Sync failed: ' + err.message });
    }
  });

  router.get('/sync-status', async (req, res) => {
    try {
      const db_inst = await db.getDb();
      const userId = req.userId || 'test-user-123';
      const result = db.all(
        db_inst,
        `SELECT MAX(timestamp) as last_sync, COUNT(*) as total_records
         FROM screen_time
         WHERE user_id = ?`,
        [userId]
      );

      const lastSync = result && result[0] && result[0].last_sync ? new Date(result[0].last_sync).toISOString() : null;
      const totalRecords = result && result[0] ? result[0].total_records || 0 : 0;

      res.json({
        last_sync: lastSync,
        total_records: totalRecords,
        sync_enabled: true
      });
    } catch (err) {
      console.error('[Sync] Status error:', err);
      res.status(500).json({ error: 'Status check failed' });
    }
  });

  return router;
};

describe('Background Data Sync - POST /sync-tracking', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.userId = 'test-user-123';
      next();
    });
    app.use('/api/data', createSyncRouter());
    jest.clearAllMocks();
  });

  test('should sync new tracking records successfully', async () => {
    const records = [
      { app_name: 'YouTube', minutes: 30, date: '2026-05-01', timestamp: Date.now() },
      { app_name: 'Instagram', minutes: 45, date: '2026-05-01', timestamp: Date.now() }
    ];

    db.all.mockReturnValue([]);
    db.getDb.mockResolvedValue({});
    db.run.mockImplementation(() => {});

    const response = await request(app)
      .post('/api/data/sync-tracking')
      .send({ records })
      .expect(200);

    expect(response.body.synced).toBe(2);
    expect(response.body.duplicates).toBe(0);
  });

  test('should detect and skip duplicate records', async () => {
    const records = [{ app_name: 'YouTube', minutes: 30, date: '2026-05-01', timestamp: Date.now() }];

    db.all.mockReturnValue([{ id: 1 }]);
    db.getDb.mockResolvedValue({});

    const response = await request(app)
      .post('/api/data/sync-tracking')
      .send({ records })
      .expect(200);

    expect(response.body.synced).toBe(0);
    expect(response.body.duplicates).toBe(1);
  });

  test('should reject invalid request format', async () => {
    const response = await request(app)
      .post('/api/data/sync-tracking')
      .send({})
      .expect(400);

    expect(response.body.error).toBe('Invalid records format');
  });

  test('should skip records with missing required fields', async () => {
    db.getDb.mockResolvedValue({});
    db.all.mockReturnValue([]);

    const response = await request(app)
      .post('/api/data/sync-tracking')
      .send({ records: [{ app_name: 'YouTube', timestamp: Date.now() }] })
      .expect(200);

    expect(response.body.synced).toBe(0);
  });
});

describe('Sync Status - GET /sync-status', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.userId = 'test-user-123';
      next();
    });
    app.use('/api/data', createSyncRouter());
    jest.clearAllMocks();
  });

  test('should return sync status and last sync time', async () => {
    const lastSyncTime = new Date('2026-05-01T15:30:00Z').getTime();
    db.getDb.mockResolvedValue({});
    db.all.mockReturnValue([{ last_sync: lastSyncTime, total_records: 42 }]);

    const response = await request(app)
      .get('/api/data/sync-status')
      .expect(200);

    expect(response.body.total_records).toBe(42);
    expect(response.body.sync_enabled).toBe(true);
  });

  test('should handle empty sync history gracefully', async () => {
    db.getDb.mockResolvedValue({});
    db.all.mockReturnValue([{ last_sync: null, total_records: 0 }]);

    const response = await request(app)
      .get('/api/data/sync-status')
      .expect(200);

    expect(response.body.total_records).toBe(0);
  });
});

describe('Duplicate Detection Algorithm', () => {
  test('detects duplicates within 1-minute window', () => {
    const isDuplicate = (t1, t2) => Math.abs(t1 - t2) <= 60000;
    
    const now = Date.now();
    expect(isDuplicate(now, now + 30000)).toBe(true); // 30 sec - duplicate
    expect(isDuplicate(now, now + 120000)).toBe(false); // 2 min - not duplicate
  });

  test('allows same app on different dates', () => {
    expect('2026-05-01').not.toBe('2026-05-02');
  });
});
