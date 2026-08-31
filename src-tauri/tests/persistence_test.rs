use std::fs;

#[path = "../src/db.rs"]
mod db;

fn temp_db_path(name: &str) -> String {
    let mut path = std::env::temp_dir();
    path.push(format!("cofora_test_{}_{}.sqlite", name, std::process::id()));
    path.to_string_lossy().to_string()
}

#[test]
fn init_db_creates_expected_tables() {
    let path = temp_db_path("init");
    let conn = db::init_db(&path).expect("init_db should succeed");
    conn.execute("INSERT INTO project_meta (key, value) VALUES ('name', 'Test Project')", [])
        .expect("project_meta table should exist and accept inserts");
    fs::remove_file(&path).ok();
}

#[test]
fn save_and_load_page_round_trips() {
    let path = temp_db_path("roundtrip");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{\"rootId\":\"r\",\"nodes\":{}}").expect("save_page should succeed");

    let loaded = db::load_page(&conn, "page1").expect("load_page should succeed");
    assert_eq!(loaded, Some(("Page 1".to_string(), "{\"rootId\":\"r\",\"nodes\":{}}".to_string())));
    fs::remove_file(&path).ok();
}

#[test]
fn save_page_upserts_on_conflict() {
    let path = temp_db_path("upsert");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{}").unwrap();
    db::save_page(&conn, "page1", "Renamed", "{\"a\":1}").unwrap();

    let loaded = db::load_page(&conn, "page1").unwrap();
    assert_eq!(loaded, Some(("Renamed".to_string(), "{\"a\":1}".to_string())));
    fs::remove_file(&path).ok();
}

#[test]
fn list_pages_returns_all_saved_pages() {
    let path = temp_db_path("list");
    let conn = db::init_db(&path).expect("init_db should succeed");
    db::save_page(&conn, "page1", "Page 1", "{}").unwrap();
    db::save_page(&conn, "page2", "Page 2", "{}").unwrap();

    let mut pages = db::list_pages(&conn).unwrap();
    pages.sort();
    assert_eq!(pages, vec![("page1".to_string(), "Page 1".to_string()), ("page2".to_string(), "Page 2".to_string())]);
    fs::remove_file(&path).ok();
}
