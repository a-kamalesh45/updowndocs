import express from 'express';
import { pool } from '../db.js'; 
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Stage 8: Centralized Role Checker
const getRole = async (userId, documentId) => {
  const res = await pool.query('SELECT role FROM collaborators WHERE user_id = $1 AND document_id = $2', [userId, documentId]);
  return res.rows.length ? res.rows[0].role : null;
};

// 1. Create Document (Automatically makes creator the 'owner')
router.post('/', requireAuth, async (req, res) => {
  try {
    await pool.query('BEGIN'); // Start transaction
    const docRes = await pool.query("INSERT INTO documents (title, owner_id) VALUES ('Untitled Document', $1) RETURNING *", [req.userId]);
    const doc = docRes.rows[0];
    
    await pool.query('INSERT INTO collaborators (document_id, user_id, role) VALUES ($1, $2, $3)', [doc.id, req.userId, 'owner']);
    await pool.query('COMMIT');
    
    res.status(201).json(doc);
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  }
});

// 2. Get My Documents (Now pulls anything shared with me)
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.id, d.title, d.updated_at, c.role
       FROM documents d
       JOIN collaborators c ON d.id = c.document_id
       WHERE c.user_id = $1
       ORDER BY d.updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 3. Get Single Document 
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    if (!role) return res.status(403).json({ error: 'Access denied' });

    const docRes = await pool.query('SELECT * FROM documents WHERE id = $1', [req.params.id]);
    res.json({ ...docRes.rows[0], myRole: role });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 4. Update Document (REST API Save)
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    // STAGE 8 ENFORCEMENT: Viewers cannot save to Postgres
    if (role !== 'owner' && role !== 'editor') return res.status(403).json({ error: 'Viewers cannot save' });

    const { title, content } = req.body;
    if (content) await pool.query('UPDATE documents SET content = $1, updated_at = now() WHERE id = $2', [content, req.params.id]);
    if (title) await pool.query('UPDATE documents SET title = $1, updated_at = now() WHERE id = $2', [title, req.params.id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 5. Delete Document
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    if (role !== 'owner') return res.status(403).json({ error: 'Only owners can delete' });

    await pool.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// 6. Share Document (Stage 8)
router.post('/:id/share', requireAuth, async (req, res) => {
  try {
    const myRole = await getRole(req.userId, req.params.id);
    if (myRole !== 'owner') return res.status(403).json({ error: 'Only owners can share' });

    const { email, role } = req.body;
    const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const targetUserId = userRes.rows[0].id;

    // GUARDRAIL 1: Prevent the owner from accidentally downgrading themselves
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'You are already the owner of this document.' });
    }

    // GUARDRAIL 2: Prevent modifying anyone else who might be an owner
    const targetRoleCheck = await getRole(targetUserId, req.params.id);
    if (targetRoleCheck === 'owner') {
      return res.status(400).json({ error: 'Cannot modify the role of a document owner.' });
    }

    await pool.query(
      `INSERT INTO collaborators (document_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (document_id, user_id) DO UPDATE SET role = $3`,
      [req.params.id, targetUserId, role]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- STAGE 7: VERSION HISTORY ROUTES (Secured) ---
router.get('/:id/versions', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    if (!role) return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      `SELECT v.id, v.created_at, u.name as author_name FROM versions v
       LEFT JOIN users u ON v.created_by = u.id
       WHERE v.document_id = $1 ORDER BY v.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id/versions/:versionId', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    if (!role) return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query('SELECT content FROM versions WHERE id = $1 AND document_id = $2', [req.params.versionId, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Version not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.post('/:id/versions', requireAuth, async (req, res) => {
  try {
    const role = await getRole(req.userId, req.params.id);
    if (role !== 'owner' && role !== 'editor') return res.status(403).json({ error: 'Unauthorized' });

    const result = await pool.query(
      'INSERT INTO versions (document_id, content, created_by) VALUES ($1, $2, $3) RETURNING id, created_at',
      [req.params.id, req.body.content, req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

export default router;