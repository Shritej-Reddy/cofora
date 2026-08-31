use rusqlite::{params, Connection, Result};

pub fn init_db(path: &str) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS pages (id TEXT PRIMARY KEY, name TEXT NOT NULL, graph_json TEXT NOT NULL)",
        [],
    )?;
    Ok(conn)
}

pub fn save_page(conn: &Connection, id: &str, name: &str, graph_json: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO pages (id, name, graph_json) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, graph_json = excluded.graph_json",
        params![id, name, graph_json],
    )?;
    Ok(())
}

pub fn load_page(conn: &Connection, id: &str) -> Result<Option<(String, String)>> {
    conn.query_row(
        "SELECT name, graph_json FROM pages WHERE id = ?1",
        params![id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map(Some)
    .or_else(|e| if e == rusqlite::Error::QueryReturnedNoRows { Ok(None) } else { Err(e) })
}

pub fn list_pages(conn: &Connection) -> Result<Vec<(String, String)>> {
    let mut stmt = conn.prepare("SELECT id, name FROM pages")?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
    rows.collect()
}
