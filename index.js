const express = require('express');
const mysql = require('mysql2/promise');  // Use the promise version of mysql2
const cors = require('cors');

const app = express();
const PORT = 3010;

// Configuración de CORS
app.use(cors());
app.use(express.json());

// Conexión a MySQL usando pool
const db = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'admin123',
  database: 'ConcursoDB'
});

// Endpoint para obtener concursantes de un concurso
app.get('/api/concursantes/concurso/:concurso_id', async (req, res) => {
  const { concurso_id } = req.params;

  const query = `
    SELECT 
      c.concursante_id, 
      c.nombre, 
      COALESCE(cal.calificacion, 0) AS calificacion
    FROM concursantes c
    JOIN concursantes_concursos cc ON c.concursante_id = cc.concursante_id
    LEFT JOIN calificaciones cal ON c.concursante_id = cal.concursante_id 
        AND cal.concurso_id = ?
    WHERE cc.concurso_id = ?;
  `;

  try {
    const [results] = await db.query(query, [concurso_id, concurso_id]);
    
    if (results.length === 0) {
      return res.status(404).json({ error: `No se encontraron concursantes para el concurso con id ${concurso_id}` });
    }
    
    res.json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar concursantes: ' + err.message });
  }
});

// Obtener todos los concursos
app.get('/api/concursos', async (req, res) => {
  const query = 'SELECT concurso_id FROM concursos';

  try {
    const [results] = await db.query(query);
    res.json(results);
  } catch (err) {
    return res.status(500).json({ error: 'Error al consultar concursos: ' + err.message });
  }
});

// Registrar o actualizar calificación
app.post('/api/votar', async (req, res) => {
  const { calificacion, concursante_id, concurso_id } = req.body;

  if (!calificacion || !concursante_id || !concurso_id) {
    return res.status(400).json({ error: "Faltan datos requeridos" });
  }

  try {
    const [existing] = await db.query(
      "SELECT calificacion_id FROM calificaciones WHERE concursante_id = ? AND concurso_id = ?",
      [concursante_id, concurso_id]
    );

    if (existing.length > 0) {
      // Actualizar calificación existente
      await db.query(
        "UPDATE calificaciones SET calificacion = ? WHERE concursante_id = ? AND concurso_id = ?",
        [calificacion, concursante_id, concurso_id]
      );
      return res.json({ message: "✅ Calificación actualizada con éxito" });
    } else {
      // Insertar nueva calificación
      await db.query(
        "INSERT INTO calificaciones (concursante_id, concurso_id, calificacion) VALUES (?, ?, ?)",
        [concursante_id, concurso_id, calificacion]
      );
      return res.json({ message: "✅ Calificación registrada con éxito" });
    }
  } catch (error) {
    console.error("❌ Error al votar:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Crear o asignar concursante
app.post("/api/concursantes", async (req, res) => {
  const { nombre, concurso_id } = req.body;

  if (!nombre || !concurso_id) {
    return res.status(400).json({ error: "El nombre y el ID del concurso son requeridos" });
  }

  try {
    const checkQuery = "SELECT concursante_id FROM concursantes WHERE nombre = ?";
    const [results] = await db.query(checkQuery, [nombre]);

    if (results.length > 0) {
      // Concursante ya existe, asignarlo al concurso
      const concursante_id = results[0].concursante_id;
      const assignQuery = "INSERT IGNORE INTO concursantes_concursos (concursante_id, concurso_id) VALUES (?, ?)";
      await db.query(assignQuery, [concursante_id, concurso_id]);
      return res.json({ message: "✅ Concursante existente asignado al concurso", concursante_id });
    } else {
      // Concursante no existe, crearlo y asignarlo
      const insertQuery = "INSERT INTO concursantes (nombre) VALUES (?)";
      const [insertResult] = await db.query(insertQuery, [nombre]);

      const concursante_id = insertResult.insertId;
      const assignQuery = "INSERT INTO concursantes_concursos (concursante_id, concurso_id) VALUES (?, ?)";
      await db.query(assignQuery, [concursante_id, concurso_id]);
      return res.status(201).json({ message: "✅ Concursante creado y asignado al concurso", concursante_id });
    }
  } catch (err) {
    console.error("Error al crear o asignar concursante:", err);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Eliminar concursante


// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
