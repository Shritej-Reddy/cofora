use crate::db;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct PageData {
    pub id: String,
    pub name: String,
    pub graph_json: String,
}

#[derive(Serialize, Deserialize)]
pub struct ProjectData {
    pub pages: Vec<PageData>,
}

#[tauri::command]
pub fn create_project(path: String, project_name: String) -> Result<(), String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO project_meta (key, value) VALUES ('name', ?1)",
        [&project_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_project(path: String) -> Result<ProjectData, String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    let pages = db::list_pages(&conn).map_err(|e| e.to_string())?;
    let mut page_data = Vec::new();
    for (id, name) in pages {
        if let Some((_, graph_json)) = db::load_page(&conn, &id).map_err(|e| e.to_string())? {
            page_data.push(PageData { id, name, graph_json });
        }
    }
    Ok(ProjectData { pages: page_data })
}

#[tauri::command]
pub fn save_project(path: String, data: ProjectData) -> Result<(), String> {
    let conn = db::init_db(&path).map_err(|e| e.to_string())?;
    for page in data.pages {
        db::save_page(&conn, &page.id, &page.name, &page.graph_json).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn write_export_file(path: String, contents: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, contents).map_err(|e| e.to_string())
}
