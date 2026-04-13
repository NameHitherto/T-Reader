use crate::{entities::FontNameEntry, repository::system::font_repository::load_system_fonts};

pub fn get_system_fonts() -> Vec<FontNameEntry> {
    load_system_fonts()
}
