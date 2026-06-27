import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Protect all document routes
router.use(requireAuth);

// 1. Create a new document
router.post('/', async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO documents (owner_id) 
       VALUES ($1) 
       RETURNING id, title, created_at`,
      [req.userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// 2. List all documents for the logged-in user
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, updated_at 
       FROM documents 
       WHERE owner_id = $1 
       ORDER BY updated_at DESC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// 3. Get a specific document
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM documents WHERE id = $1 AND owner_id = $2`,
      [id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// 4. Rename a document
// 4. Update a document (Rename OR save content)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  
  try {
    // If title is provided, update title. If content is provided, update content.
    if (title !== undefined) {
      const result = await pool.query(
        `UPDATE documents SET title = $1, updated_at = now() WHERE id = $2 AND owner_id = $3 RETURNING id, title`,
        [title, id, req.userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(result.rows[0]);
    }

    if (content !== undefined) {
      const result = await pool.query(
        `UPDATE documents SET content = $1, updated_at = now() WHERE id = $2 AND owner_id = $3 RETURNING id`,
        [content, id, req.userId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.json(result.rows[0]);
    }

    res.status(400).json({ error: 'No valid fields to update' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// 5. Delete a document
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `DELETE FROM documents WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

export default router;