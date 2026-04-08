use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct LocalDirNames {
    pub books: String,
    pub progress: String,
    pub cached: String,
    pub system: String,
}

#[derive(Serialize, Clone)]
pub struct CloudDirNames {
    pub books: String,
    pub progress: String,
}
